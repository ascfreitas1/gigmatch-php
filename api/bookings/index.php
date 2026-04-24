<?php
require_once __DIR__ . '/../../core/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$q      = getQuery();

switch ($action ?? '') {

    // GET /api/bookings/my
    case 'my':
        $user = requireAuth();
        $page=(int)($q['page']??1); $limit=(int)($q['limit']??20);
        if ($user['role'] === 'performer') {
            $perf = Database::queryOne('SELECT id FROM performers WHERE user_id=?',[$user['id']]);
            if (!$perf) jsonResponse(['items'=>[],'total'=>0]);
            $sql = 'SELECT b.*,e.title as event_title,e.event_date,e.city as event_city,e.event_type,
                    e.start_time,e.end_time,e.address as event_address,u.name as host_name,u.avatar_url as host_avatar
                    FROM bookings b JOIN events e ON b.event_id=e.id
                    JOIN hosts h ON b.host_id=h.id JOIN users u ON h.user_id=u.id WHERE b.performer_id=?';
            $params = [$perf['id']];
        } elseif ($user['role'] === 'host') {
            $host = Database::queryOne('SELECT id FROM hosts WHERE user_id=?',[$user['id']]);
            if (!$host) jsonResponse(['items'=>[],'total'=>0]);
            $sql = 'SELECT b.*,e.title as event_title,e.event_date,e.city as event_city,e.event_type,
                    e.start_time,e.end_time,p.act_name,p.act_type,pu.name as performer_name,pu.avatar_url as performer_avatar
                    FROM bookings b JOIN events e ON b.event_id=e.id
                    JOIN performers p ON b.performer_id=p.id JOIN users pu ON p.user_id=pu.id WHERE b.host_id=?';
            $params = [$host['id']];
        } else jsonError('Invalid role', 403);
        if (!empty($q['status'])) { $sql .= ' AND b.status=?'; $params[] = $q['status']; }
        $sql .= ' ORDER BY b.created_at DESC';
        jsonResponse(paginate(Database::query($sql,$params),$page,$limit));

    // POST /api/bookings/request
    case 'request':
        if ($method !== 'POST') jsonError('Method not allowed',405);
        $user = requireAuth(); requireRole($user,'performer');
        $b    = getBody();
        if (empty($b['event_id'])) jsonError('event_id required');
        $perf = Database::queryOne('SELECT * FROM performers WHERE user_id=?',[$user['id']]);
        if (!$perf) jsonError('Performer profile not found',404);
        if (!$perf['act_type'] || $perf['hourly_rate'] <= 0) jsonError('Please complete your performer profile before applying');
        $event = Database::queryOne("SELECT * FROM events WHERE id=? AND status='open'",[$b['event_id']]);
        if (!$event) jsonError('Event not found or no longer open',404);
        $existing = Database::queryOne('SELECT id FROM bookings WHERE event_id=? AND performer_id=?',[$b['event_id'],$perf['id']]);
        if ($existing) jsonError('You have already applied to this event',409);

        $bookingId = uuid();
        $amounts   = calculateBooking((float)$perf['hourly_rate'], (float)$event['duration_hours']);
        Database::execute(
            "INSERT INTO bookings (id,event_id,performer_id,host_id,hours_booked,hourly_rate,subtotal,commission,total_amount,performer_payout,status,notes)
             VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?)",
            [$bookingId,$b['event_id'],$perf['id'],$event['host_id'],$event['duration_hours'],$perf['hourly_rate'],
             $amounts['subtotal'],$amounts['commission'],$amounts['total'],$amounts['performerPayout'],$b['notes']??null]
        );
        $hostUser = Database::queryOne('SELECT user_id FROM hosts WHERE id=?',[$event['host_id']]);
        if ($hostUser) createNotification($hostUser['user_id'],'booking_request','🎸 New Booking Request!',
            "{$user['name']} ({$perf['act_type']}) applied for \"{$event['title']}\"",['booking_id'=>$bookingId,'event_id'=>$b['event_id']]);
        jsonResponse(['bookingId'=>$bookingId,'message'=>'Booking request sent!','amounts'=>$amounts],201);

    // Default: dynamic actions on /api/bookings/{id}/{subaction}
    default:
        $id        = $action;
        $subAction = $subAction ?? '';

        // PUT /api/bookings/{id}/status
        if ($method === 'PUT' && $subAction === 'status') {
            $user = requireAuth(); requireRole($user,'host');
            $b    = getBody();
            if (!in_array($b['action']??'',['accept','reject'])) jsonError('Action must be accept or reject');
            $host = Database::queryOne('SELECT * FROM hosts WHERE user_id=?',[$user['id']]);
            $booking = Database::queryOne(
                "SELECT b.*,e.title as event_title,p.user_id as performer_user_id,p.act_name
                 FROM bookings b JOIN events e ON b.event_id=e.id JOIN performers p ON b.performer_id=p.id
                 WHERE b.id=? AND b.host_id=? AND b.status='pending'", [$id,$host['id']??'']);
            if (!$booking) jsonError('Booking not found or not pending',404);
            $newStatus = $b['action']==='accept' ? 'accepted' : 'rejected';
            Database::execute("UPDATE bookings SET status=?,updated_at=NOW() WHERE id=?",[$newStatus,$id]);
            if ($b['action']==='accept')
                createNotification($booking['performer_user_id'],'booking_accepted','🎉 Booking Accepted!',
                    "Your application for \"{$booking['event_title']}\" was accepted!",['booking_id'=>$id]);
            else
                createNotification($booking['performer_user_id'],'booking_rejected','Booking Not Selected',
                    "Your application for \"{$booking['event_title']}\" was not selected.",['booking_id'=>$id]);
            jsonResponse(['message'=>"Booking $newStatus"]);
        }

        // POST /api/bookings/{id}/pay
        if ($method === 'POST' && $subAction === 'pay') {
            $user = requireAuth();
            $booking = Database::queryOne(
                "SELECT b.*,e.title as event_title,p.user_id as performer_user_id,p.act_name
                 FROM bookings b JOIN events e ON b.event_id=e.id JOIN performers p ON b.performer_id=p.id
                 WHERE b.id=? AND b.status='accepted'", [$id]);
            if (!$booking) jsonError('Booking not found or not in accepted status',404);
            $fakePI = 'pi_'.substr(str_replace('-','',uuid()),0,24);
            Database::execute("UPDATE bookings SET status='escrow',stripe_payment_intent_id=?,updated_at=NOW() WHERE id=?",[$fakePI,$id]);
            createNotification($booking['performer_user_id'],'payment_escrowed','💰 Payment in Escrow',
                "Payment for \"{$booking['event_title']}\" is secured in escrow!",['booking_id'=>$id]);
            jsonResponse(['message'=>'Payment in escrow','payment_intent'=>$fakePI,'amount'=>$booking['total_amount']]);
        }

        // POST /api/bookings/{id}/complete
        if ($method === 'POST' && $subAction === 'complete') {
            $user = requireAuth();
            $booking = Database::queryOne(
                "SELECT b.*,e.title as event_title,p.user_id as performer_user_id,h.user_id as host_user_id
                 FROM bookings b JOIN events e ON b.event_id=e.id JOIN performers p ON b.performer_id=p.id
                 JOIN hosts h ON b.host_id=h.id WHERE b.id=? AND b.status='escrow'", [$id]);
            if (!$booking) jsonError('Booking not in escrow',404);
            if ($user['id']!==$booking['performer_user_id'] && $user['id']!==$booking['host_user_id']) jsonError('Unauthorized',403);
            Database::execute("UPDATE bookings SET status='completed',updated_at=NOW() WHERE id=?",[$id]);
            Database::execute("UPDATE events SET status='completed',updated_at=NOW() WHERE id=?",[$booking['event_id']]);
            createNotification($booking['performer_user_id'],'rate_event','⭐ Rate Your Host',"Rate the host for \"{$booking['event_title']}\"",['booking_id'=>$id,'rate_type'=>'host']);
            createNotification($booking['host_user_id'],'rate_event','⭐ Rate Your Performer',"Rate the performer for \"{$booking['event_title']}\"",['booking_id'=>$id,'rate_type'=>'performer']);
            jsonResponse(['message'=>'Completed. Please rate each other.']);
        }

        // POST /api/bookings/{id}/rate
        if ($method === 'POST' && $subAction === 'rate') {
            $user = requireAuth();
            $b    = getBody();
            if (!isset($b['score']) || $b['score']<1 || $b['score']>5) jsonError('Score must be between 1 and 5');
            $booking = Database::queryOne(
                "SELECT b.*,p.user_id as performer_user_id,p.id as performer_id,h.user_id as host_user_id,h.id as host_id_ref,e.title as event_title
                 FROM bookings b JOIN performers p ON b.performer_id=p.id JOIN hosts h ON b.host_id=h.id
                 JOIN events e ON b.event_id=e.id WHERE b.id=? AND b.status='completed'", [$id]);
            if (!$booking) jsonError('Booking not completed',404);
            $isPerformer = $user['id']===$booking['performer_user_id'];
            $isHost      = $user['id']===$booking['host_user_id'];
            if (!$isPerformer && !$isHost) jsonError('Unauthorized',403);
            if ($isPerformer && $booking['performer_rated']) jsonError('Already rated',409);
            if ($isHost      && $booking['host_rated'])      jsonError('Already rated',409);
            $raterRole   = $isPerformer ? 'performer' : 'host';
            $ratedUserId = $isPerformer ? $booking['host_user_id'] : $booking['performer_user_id'];
            Database::execute('INSERT INTO ratings (id,booking_id,rater_user_id,rated_user_id,rater_role,score,comment) VALUES (?,?,?,?,?,?,?)',
                [uuid(),$id,$user['id'],$ratedUserId,$raterRole,$b['score'],$b['comment']??null]);
            if ($isPerformer) Database::execute("UPDATE bookings SET performer_rated=1,updated_at=NOW() WHERE id=?",[$id]);
            else              Database::execute("UPDATE bookings SET host_rated=1,updated_at=NOW() WHERE id=?",[$id]);
            $updated = Database::queryOne('SELECT * FROM bookings WHERE id=?',[$id]);
            if ($updated['performer_rated'] && $updated['host_rated']) {
                Database::execute("UPDATE bookings SET escrow_released=1,updated_at=NOW() WHERE id=?",[$id]);
                $pr = Database::queryOne('SELECT AVG(score) as avg FROM ratings WHERE rated_user_id=? AND rater_role=\'host\'',[$booking['performer_user_id']]);
                Database::execute('UPDATE performers SET avg_rating=?,total_gigs=total_gigs+1,updated_at=NOW() WHERE id=?',[$pr['avg']??$b['score'],$booking['performer_id']]);
                $hr = Database::queryOne('SELECT AVG(score) as avg FROM ratings WHERE rated_user_id=? AND rater_role=\'performer\'',[$booking['host_user_id']]);
                Database::execute('UPDATE hosts SET avg_rating=?,total_events=total_events+1,updated_at=NOW() WHERE id=?',[$hr['avg']??$b['score'],$booking['host_id_ref']]);
                createNotification($booking['performer_user_id'],'payment_released','💸 Payment Released!',
                    "Your payment for \"{$booking['event_title']}\" was released!",['booking_id'=>$id]);
            }
            Database::execute('UPDATE users SET social_score=social_score+5 WHERE id=?',[$user['id']]);
            jsonResponse(['message'=>'Rating submitted','escrow_released'=>(bool)($updated['performer_rated']&&$updated['host_rated'])]);
        }

        // POST /api/bookings/{id}/dispute
        if ($method === 'POST' && $subAction === 'dispute') {
            $user = requireAuth();
            $b    = getBody();
            if (empty($b['reason'])||empty($b['description'])) jsonError('Reason and description required');
            $booking = Database::queryOne(
                "SELECT b.*,p.user_id as performer_user_id,h.user_id as host_user_id
                 FROM bookings b JOIN performers p ON b.performer_id=p.id JOIN hosts h ON b.host_id=h.id
                 WHERE b.id=? AND b.status IN ('escrow','completed')", [$id]);
            if (!$booking) jsonError('Booking not eligible for dispute',404);
            if ($user['id']!==$booking['performer_user_id'] && $user['id']!==$booking['host_user_id']) jsonError('Unauthorized',403);
            $disputeId = uuid();
            Database::execute('INSERT INTO disputes (id,booking_id,raised_by_user_id,reason,description) VALUES (?,?,?,?,?)',
                [$disputeId,$id,$user['id'],$b['reason'],$b['description']]);
            Database::execute("UPDATE bookings SET status='disputed',updated_at=NOW() WHERE id=?",[$id]);
            $admin = Database::queryOne("SELECT id FROM users WHERE role='admin' LIMIT 1",[]);
            if ($admin) createNotification($admin['id'],'new_dispute','⚠️ New Dispute',
                "User {$user['name']} opened a dispute for booking ".substr($id,0,8)."...",['dispute_id'=>$disputeId,'booking_id'=>$id]);
            jsonResponse(['message'=>'Dispute opened.','dispute_id'=>$disputeId]);
        }

        // GET /api/bookings/{id}
        if ($method === 'GET') {
            $user = requireAuth();
            $booking = Database::queryOne(
                'SELECT b.*,e.title as event_title,e.event_date,e.city as event_city,e.event_type,e.start_time,e.end_time,e.address as event_address,e.venue_name,
                 p.act_name,p.act_type,pu.name as performer_name,pu.avatar_url as performer_avatar,
                 hu.name as host_name,hu.avatar_url as host_avatar
                 FROM bookings b JOIN events e ON b.event_id=e.id
                 JOIN performers p ON b.performer_id=p.id JOIN users pu ON p.user_id=pu.id
                 JOIN hosts h ON b.host_id=h.id JOIN users hu ON h.user_id=hu.id WHERE b.id=?', [$id]);
            if (!$booking) jsonError('Booking not found',404);
            jsonResponse($booking);
        }
        jsonError('Not found',404);
}

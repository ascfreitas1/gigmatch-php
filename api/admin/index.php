<?php
require_once __DIR__ . '/../../core/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$q      = getQuery();
$user   = requireAuth(); requireRole($user,'admin');

switch ($action ?? '') {

    // GET /api/admin/stats
    case 'stats':
        jsonResponse([
            'users'               => (int)(Database::queryOne("SELECT COUNT(*) as c FROM users WHERE role!='admin'",[])['c']??0),
            'performers'          => (int)(Database::queryOne('SELECT COUNT(*) as c FROM performers',[])['c']??0),
            'hosts'               => (int)(Database::queryOne('SELECT COUNT(*) as c FROM hosts',[])['c']??0),
            'events'              => (int)(Database::queryOne('SELECT COUNT(*) as c FROM events',[])['c']??0),
            'open_events'         => (int)(Database::queryOne("SELECT COUNT(*) as c FROM events WHERE status='open'",[])['c']??0),
            'bookings'            => (int)(Database::queryOne('SELECT COUNT(*) as c FROM bookings',[])['c']??0),
            'escrow_total'        => (float)(Database::queryOne("SELECT COALESCE(SUM(total_amount),0) as s FROM bookings WHERE status='escrow'",[])['s']??0),
            'revenue'             => (float)(Database::queryOne("SELECT COALESCE(SUM(commission),0) as s FROM bookings WHERE status='completed' AND escrow_released=1",[])['s']??0),
            'completed_bookings'  => (int)(Database::queryOne("SELECT COUNT(*) as c FROM bookings WHERE status='completed' AND escrow_released=1",[])['c']??0),
            'open_disputes'       => (int)(Database::queryOne("SELECT COUNT(*) as c FROM disputes WHERE status='open'",[])['c']??0),
            'avg_rating'          => round((float)(Database::queryOne('SELECT AVG(score) as a FROM ratings',[])['a']??0),2),
        ]);

    // GET /api/admin/users
    case 'users':
        if ($method !== 'GET') jsonError('Method not allowed',405);
        $sql="SELECT id,email,name,role,city,country,is_verified,is_active,created_at FROM users WHERE role!='admin'";
        $params=[];
        if (!empty($q['role'])) { $sql.=' AND role=?'; $params[]=$q['role']; }
        if (!empty($q['q'])) { $sql.=' AND (name LIKE ? OR email LIKE ?)'; $like='%'.$q['q'].'%'; $params=array_merge($params,[$like,$like]); }
        $page=(int)($q['page']??1); $limit=(int)($q['limit']??30);
        $sql.=' ORDER BY created_at DESC LIMIT ? OFFSET ?'; $params[]=$limit; $params[]=($page-1)*$limit;
        $total=Database::queryOne("SELECT COUNT(*) as c FROM users WHERE role!='admin'",[]);
        jsonResponse(['items'=>Database::query($sql,$params),'total'=>(int)($total['c']??0)]);

    // PUT /api/admin/users/{id}/toggle  or  /verify
    case 'toggle':
        if ($method !== 'PUT') jsonError('Method not allowed',405);
        $uid  = $subAction ?? ''; // id passed via subAction
        $u    = Database::queryOne('SELECT * FROM users WHERE id=?',[$uid]);
        if (!$u) jsonError('User not found',404);
        Database::execute('UPDATE users SET is_active=?,updated_at=NOW() WHERE id=?',[$u['is_active']?0:1,$uid]);
        jsonResponse(['message'=>'User '.($u['is_active']?'deactivated':'activated')]);

    case 'verify':
        if ($method !== 'PUT') jsonError('Method not allowed',405);
        $uid = $subAction ?? '';
        Database::execute('UPDATE users SET is_verified=1,updated_at=NOW() WHERE id=?',[$uid]);
        jsonResponse(['message'=>'User verified']);

    // GET /api/admin/bookings
    case 'bookings':
        $sql='SELECT b.*,e.title as event_title,e.event_date,e.city as event_city,pu.name as performer_name,hu.name as host_name,p.act_type
              FROM bookings b JOIN events e ON b.event_id=e.id JOIN performers p ON b.performer_id=p.id
              JOIN users pu ON p.user_id=pu.id JOIN hosts h ON b.host_id=h.id JOIN users hu ON h.user_id=hu.id';
        $params=[];
        if (!empty($q['status'])) { $sql.=' WHERE b.status=?'; $params[]=$q['status']; }
        $page=(int)($q['page']??1); $limit=(int)($q['limit']??30);
        $sql.=' ORDER BY b.created_at DESC LIMIT ? OFFSET ?'; $params[]=$limit; $params[]=($page-1)*$limit;
        jsonResponse(Database::query($sql,$params));

    // GET /api/admin/disputes
    case 'disputes':
        jsonResponse(Database::query(
            'SELECT d.*,b.total_amount,b.performer_payout,e.title as event_title,u.name as raised_by_name,u.email as raised_by_email
             FROM disputes d JOIN bookings b ON d.booking_id=b.id JOIN events e ON b.event_id=e.id
             JOIN users u ON d.raised_by_user_id=u.id ORDER BY d.created_at DESC',[]));

    // PUT /api/admin/disputes/{id}/resolve
    case 'resolve':
        if ($method !== 'PUT') jsonError('Method not allowed',405);
        $b = getBody();
        if (!in_array($b['resolution']??'',['resolved_performer','resolved_host','refunded'])) jsonError('Invalid resolution');
        $disputeId = $subAction ?? '';
        $dispute = Database::queryOne(
            'SELECT d.*,b.performer_payout,b.total_amount,p.user_id as performer_user_id,h.user_id as host_user_id
             FROM disputes d JOIN bookings b ON d.booking_id=b.id JOIN performers p ON b.performer_id=p.id
             JOIN hosts h ON b.host_id=h.id WHERE d.id=?',[$disputeId]);
        if (!$dispute) jsonError('Dispute not found',404);
        Database::execute('UPDATE disputes SET status=?,resolution_notes=?,resolved_by=?,updated_at=NOW() WHERE id=?',
            [$b['resolution'],$b['resolution_notes']??null,$user['id'],$disputeId]);
        $bookingStatus = $b['resolution']==='refunded' ? 'refunded' : 'completed';
        Database::execute('UPDATE bookings SET status=?,escrow_released=1,updated_at=NOW() WHERE id=?',[$bookingStatus,$dispute['booking_id']]);
        if ($b['resolution']==='resolved_performer') {
            createNotification($dispute['performer_user_id'],'dispute_resolved','✅ Dispute Resolved in Your Favor','Payment will be released to you.',['booking_id'=>$dispute['booking_id']]);
            createNotification($dispute['host_user_id'],'dispute_resolved','Dispute Resolved','Resolved in performer\'s favor.',['booking_id'=>$dispute['booking_id']]);
        } elseif ($b['resolution']==='resolved_host') {
            createNotification($dispute['host_user_id'],'dispute_resolved','✅ Dispute Resolved in Your Favor','Payment will be refunded.',['booking_id'=>$dispute['booking_id']]);
            createNotification($dispute['performer_user_id'],'dispute_resolved','Dispute Resolved','Resolved in host\'s favor.',['booking_id'=>$dispute['booking_id']]);
        } else {
            createNotification($dispute['performer_user_id'],'dispute_resolved','Dispute Closed','The dispute has been resolved.',['booking_id'=>$dispute['booking_id']]);
            createNotification($dispute['host_user_id'],'dispute_resolved','Dispute Closed','Payment refunded.',['booking_id'=>$dispute['booking_id']]);
        }
        jsonResponse(['message'=>'Dispute resolved: '.$b['resolution']]);

    // GET /api/admin/events
    case 'events':
        $evs = Database::query('SELECT e.*,u.name as host_name,h.company_name FROM events e
            JOIN hosts h ON e.host_id=h.id JOIN users u ON h.user_id=u.id ORDER BY e.created_at DESC LIMIT 100',[]);
        jsonResponse(array_map(fn($e)=>array_merge($e,['act_types_needed'=>safeJson($e['act_types_needed']??null)]),$evs));

    // GET /api/admin/users/me (current admin)
    case 'me':
        jsonResponse(['user'=>array_intersect_key($user,array_flip(['id','email','name','role','avatar_url']))]);

    default:
        jsonError('Not found',404);
}

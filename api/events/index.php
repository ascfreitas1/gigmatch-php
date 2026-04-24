<?php
require_once __DIR__ . '/../../core/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$q      = getQuery();

switch ($action ?? '') {

    // GET /api/events
    case '':
    case 'list':
        if ($method !== 'GET') jsonError('Method not allowed', 405);
        $sql    = 'SELECT e.*,h.company_name,h.host_type,u.name as host_name,u.city as host_city,u.avatar_url as host_avatar
                   FROM events e JOIN hosts h ON e.host_id=h.id JOIN users u ON h.user_id=u.id WHERE e.status=\'open\'';
        $params = [];
        if (!empty($q['event_type'])) { $sql .= ' AND e.event_type=?';           $params[] = $q['event_type']; }
        if (!empty($q['act_type']))   { $sql .= ' AND e.act_types_needed LIKE ?'; $params[] = '%'.$q['act_type'].'%'; }
        if (!empty($q['date_from']))  { $sql .= ' AND e.event_date>=?';           $params[] = $q['date_from']; }
        if (!empty($q['date_to']))    { $sql .= ' AND e.event_date<=?';           $params[] = $q['date_to']; }
        if (!empty($q['q'])) {
            $sql .= ' AND (e.title LIKE ? OR e.description LIKE ? OR e.city LIKE ?)';
            $like = '%'.$q['q'].'%'; $params = array_merge($params, [$like,$like,$like]);
        }
        $sql .= ' ORDER BY e.event_date ASC, e.created_at DESC';
        $results = Database::query($sql, $params);

        if (!empty($q['lat']) && !empty($q['lon'])) {
            $cLat=$q['lat']; $cLon=$q['lon']; $maxR=(float)($q['radius']??100);
            $results = array_values(array_filter($results, fn($e) =>
                $e['latitude'] && $e['longitude'] &&
                getDistanceKm($cLat,$cLon,$e['latitude'],$e['longitude']) <= $maxR));
            foreach ($results as &$e) $e['distance_km'] = round(getDistanceKm($cLat,$cLon,$e['latitude'],$e['longitude']),1);
            unset($e);
        }
        $page=(int)($q['page']??1); $limit=(int)($q['limit']??20);
        $paged = paginate($results, $page, $limit);
        $paged['items'] = array_map('parseEventJson', $paged['items']);
        jsonResponse($paged);

    // GET /api/events/meta/event-types
    case 'meta':
        jsonResponse([
            'eventTypes'     => ['Wedding','Corporate Event','Birthday Party','Anniversary','Bar/Club Night',
                'Store Launch','Small Get-Together','Concert','Festival','Private Party',
                'Restaurant Event','Holiday Party','Graduation','Charity Event','Other'],
            'infrastructure' => ['PA System','Stage','Lighting Rig','Microphones','Piano/Keyboard',
                'Drum Kit','Amplifiers','Mixing Board','Generator','Security','Parking','Dressing Room','Catering'],
        ]);

    // GET /api/events/host/my-events
    case 'my-events':
        $user = requireAuth(); requireRole($user,'host','admin');
        $host = Database::queryOne('SELECT * FROM hosts WHERE user_id=?', [$user['id']]);
        if (!$host) jsonError('Host not found', 404);
        $sql = 'SELECT * FROM events WHERE host_id=?'; $params = [$host['id']];
        if (!empty($q['status'])) { $sql .= ' AND status=?'; $params[] = $q['status']; }
        $sql .= ' ORDER BY event_date DESC';
        jsonResponse(array_map('parseEventJson', Database::query($sql, $params)));

    // POST /api/events
    case 'create':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $user = requireAuth(); requireRole($user,'host','admin');
        $b    = getBody();

        foreach (['title','event_type','address','city','country','event_date','start_time','end_time','duration_hours'] as $f)
            if (empty($b[$f])) jsonError("Missing required field: $f");

        if (empty($b['act_types_needed']) || !is_array($b['act_types_needed']))
            jsonError('At least one act type is required');

        $lat = !empty($b['latitude'])  ? (float)$b['latitude']  : null;
        $lon = !empty($b['longitude']) ? (float)$b['longitude'] : null;
        if (!$lat || !$lon) {
            $geo = geocodeCity($b['city'], $b['country'] ?? '');
            if ($geo) { $lat = $geo['lat']; $lon = $geo['lon']; }
        }
        $lat = $lat ?: 0; $lon = $lon ?: 0;

        $host = Database::queryOne('SELECT * FROM hosts WHERE user_id=?', [$user['id']]);
        if (!$host) jsonError('Host profile not found', 404);

        $eventId = uuid();
        Database::execute(
            'INSERT INTO events (id,host_id,title,event_type,description,venue_name,address,city,state,country,
             latitude,longitude,event_date,start_time,end_time,duration_hours,expected_audience,infrastructure,
             musical_taste,act_types_needed,genres_preferred,budget_min,budget_max,objective,dress_code)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$eventId,$host['id'],$b['title'],$b['event_type'],$b['description']??null,$b['venue_name']??null,
             $b['address'],$b['city'],$b['state']??null,$b['country'],$lat,$lon,
             $b['event_date'],$b['start_time'],$b['end_time'],$b['duration_hours'],$b['expected_audience']??null,
             json_encode(is_array($b['infrastructure']??null)?$b['infrastructure']:[]),
             $b['musical_taste']??null, json_encode($b['act_types_needed']),
             json_encode(is_array($b['genres_preferred']??null)?$b['genres_preferred']:[]),
             $b['budget_min']??null,$b['budget_max']??null,$b['objective']??null,$b['dress_code']??null]
        );
        notifyMatchingPerformers($eventId, $lat, $lon, $b['act_types_needed'], $b['genres_preferred']??[]);
        $event = Database::queryOne('SELECT * FROM events WHERE id=?', [$eventId]);
        jsonResponse(array_merge(parseEventJson($event), ['message'=>'Event created successfully']), 201);

    // Dynamic: PUT /api/events/{id}, DELETE /api/events/{id}, GET /api/events/{id}
    default:
        $id = $action;
        if ($method === 'GET') {
            $event = Database::queryOne(
                'SELECT e.*,h.company_name,h.host_type,h.avg_rating as host_rating,h.total_events,
                 u.name as host_name,u.city as host_city,u.avatar_url as host_avatar,u.is_verified as host_verified
                 FROM events e JOIN hosts h ON e.host_id=h.id JOIN users u ON h.user_id=u.id WHERE e.id=?', [$id]);
            if (!$event) jsonError('Event not found', 404);
            $bc = Database::queryOne("SELECT COUNT(*) as c FROM bookings WHERE event_id=? AND status NOT IN ('rejected','cancelled')", [$id]);
            jsonResponse(array_merge(parseEventJson($event), ['bookings_count'=>(int)($bc['c']??0)]));
        }
        if ($method === 'PUT') {
            $user = requireAuth(); requireRole($user,'host','admin');
            $b    = getBody();
            $host = Database::queryOne('SELECT * FROM hosts WHERE user_id=?', [$user['id']]);
            $event = Database::queryOne('SELECT * FROM events WHERE id=? AND host_id=?', [$id,$host['id']??'']);
            if (!$event) jsonError('Event not found or unauthorized', 404);
            if ($event['status'] !== 'open') jsonError('Cannot edit non-open event');
            Database::execute(
                'UPDATE events SET title=?,event_type=?,description=?,venue_name=?,address=?,city=?,state=?,country=?,
                 latitude=?,longitude=?,event_date=?,start_time=?,end_time=?,duration_hours=?,expected_audience=?,
                 infrastructure=?,musical_taste=?,act_types_needed=?,genres_preferred=?,budget_min=?,budget_max=?,
                 objective=?,dress_code=?,updated_at=NOW() WHERE id=?',
                [$b['title']??$event['title'],$b['event_type']??$event['event_type'],
                 $b['description']??$event['description'],$b['venue_name']??$event['venue_name'],
                 $b['address']??$event['address'],$b['city']??$event['city'],$b['state']??$event['state'],
                 $b['country']??$event['country'],$b['latitude']??$event['latitude'],$b['longitude']??$event['longitude'],
                 $b['event_date']??$event['event_date'],$b['start_time']??$event['start_time'],$b['end_time']??$event['end_time'],
                 $b['duration_hours']??$event['duration_hours'],$b['expected_audience']??$event['expected_audience'],
                 json_encode(is_array($b['infrastructure']??null)?$b['infrastructure']:safeJson($event['infrastructure'])),
                 $b['musical_taste']??$event['musical_taste'],
                 json_encode(is_array($b['act_types_needed']??null)?$b['act_types_needed']:safeJson($event['act_types_needed'])),
                 json_encode(is_array($b['genres_preferred']??null)?$b['genres_preferred']:safeJson($event['genres_preferred'])),
                 $b['budget_min']??$event['budget_min'],$b['budget_max']??$event['budget_max'],
                 $b['objective']??$event['objective'],$b['dress_code']??$event['dress_code'],$id]
            );
            jsonResponse(['message'=>'Event updated','event'=>parseEventJson(Database::queryOne('SELECT * FROM events WHERE id=?',[$id]))]);
        }
        if ($method === 'DELETE') {
            $user = requireAuth(); requireRole($user,'host','admin');
            $host = Database::queryOne('SELECT * FROM hosts WHERE user_id=?', [$user['id']]);
            $event = Database::queryOne('SELECT * FROM events WHERE id=? AND host_id=?', [$id,$host['id']??'']);
            if (!$event) jsonError('Event not found', 404);
            Database::execute("UPDATE events SET status='cancelled',updated_at=NOW() WHERE id=?", [$id]);
            $bks = Database::query("SELECT b.*,p.user_id as puid FROM bookings b JOIN performers p ON b.performer_id=p.id
                WHERE b.event_id=? AND b.status NOT IN ('rejected','cancelled')", [$id]);
            foreach ($bks as $bk)
                createNotification($bk['puid'],'event_cancelled','Event Cancelled',"The event \"{$event['title']}\" was cancelled.",['event_id'=>$id]);
            jsonResponse(['message'=>'Event cancelled']);
        }
        jsonError('Method not allowed', 405);
}

function parseEventJson(array $e): array {
    $e['act_types_needed'] = safeJson($e['act_types_needed'] ?? null);
    $e['genres_preferred'] = safeJson($e['genres_preferred'] ?? null);
    $e['infrastructure']   = safeJson($e['infrastructure'] ?? null);
    return $e;
}

function notifyMatchingPerformers(string $eventId, float $lat, float $lon, array $actTypes, array $genres): void {
    $event = Database::queryOne('SELECT * FROM events WHERE id=?', [$eventId]);
    if (!$event) return;
    $performers = Database::query('SELECT p.*,u.latitude,u.longitude,u.id as user_id FROM performers p
        JOIN users u ON p.user_id=u.id WHERE u.is_active=1 AND p.is_available=1 AND u.latitude IS NOT NULL', []);
    foreach ($performers as $p) {
        if ($actTypes && !in_array($p['act_type'], $actTypes)) continue;
        if ($genres) {
            $pGenres = safeJson($p['genres']); $match = false;
            foreach ($genres as $g) if (in_array($g,$pGenres)) { $match=true; break; }
            if (!$match) continue;
        }
        if ($p['latitude'] && $p['longitude']) {
            $dist = getDistanceKm($lat,$lon,(float)$p['latitude'],(float)$p['longitude']);
            if ($dist > ($p['max_travel_km']??50)) continue;
        }
        createNotification($p['user_id'],'new_event','🎵 New Event Match!',
            "A new event \"{$event['title']}\" in {$event['city']} matches your profile!",['event_id'=>$eventId]);
    }
}

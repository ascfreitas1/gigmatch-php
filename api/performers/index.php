<?php
require_once __DIR__ . '/../../core/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$q      = getQuery();

switch ($action ?? '') {

    // GET /api/performers — public list with geo filter
    case '':
    case 'list':
        if ($method !== 'GET') jsonError('Method not allowed', 405);

        $sql    = 'SELECT p.*,u.name,u.email,u.city,u.state,u.country,u.latitude,u.longitude,u.avatar_url,u.is_verified,u.bio
                   FROM performers p JOIN users u ON p.user_id=u.id
                   WHERE u.is_active=1 AND p.is_available=1';
        $params = [];
        if (!empty($q['act_type']))  { $sql .= ' AND p.act_type=?';           $params[] = $q['act_type']; }
        if (!empty($q['genre']))     { $sql .= ' AND p.genres LIKE ?';        $params[] = '%'.$q['genre'].'%'; }
        if (!empty($q['min_rate']))  { $sql .= ' AND p.hourly_rate>=?';       $params[] = (float)$q['min_rate']; }
        if (!empty($q['max_rate']))  { $sql .= ' AND p.hourly_rate<=?';       $params[] = (float)$q['max_rate']; }
        if (!empty($q['q'])) {
            $sql .= ' AND (p.act_name LIKE ? OR u.name LIKE ? OR p.profile_headline LIKE ?)';
            $like = '%'.$q['q'].'%'; $params = array_merge($params, [$like,$like,$like]);
        }
        $sql .= ' ORDER BY p.platform_score DESC, p.avg_rating DESC';

        $results = Database::query($sql, $params);

        // Geo filter
        if (!empty($q['lat']) && !empty($q['lon'])) {
            $cLat = (float)$q['lat']; $cLon = (float)$q['lon']; $maxR = (float)($q['radius'] ?? 100);
            $results = array_values(array_filter($results, function($p) use ($cLat,$cLon,$maxR) {
                if (!$p['latitude'] || !$p['longitude']) return false;
                return getDistanceKm($cLat,$cLon,(float)$p['latitude'],(float)$p['longitude']) <= min((int)($p['max_travel_km']??50),$maxR);
            }));
            foreach ($results as &$p) {
                $p['distance_km'] = round(getDistanceKm($cLat,$cLon,(float)$p['latitude'],(float)$p['longitude']),1);
            } unset($p);
        }

        $page  = (int)($q['page'] ?? 1);
        $limit = (int)($q['limit'] ?? 20);
        jsonResponse(paginate(array_map('parsePerformerJson', $results), $page, $limit));

    // GET /api/performers/meta/act-types
    case 'meta':
        jsonResponse([
            'actTypes' => ['Banda / Band','Artista Solo / Solo Artist','DJ','Violinista / Violinist',
                'Pequena Orquestra / Small Orchestra','Banda de Jazz / Jazz Band','Cantor(a) / Singer',
                'Guitarrista / Guitarist','Pianista / Pianist','Baterista / Drummer',
                'Quarteto de Cordas / String Quartet','Banda Cover / Cover Band',
                'Dupla Acústica / Acoustic Duo','Artista Eletrônico / Electronic Artist',
                'Mariachi','Conjunto Clássico / Classical Ensemble','Coral / Choir',
                'Percussionista / Percussionist','Saxofonista / Saxophonist','Acordeonista / Accordionist','Outro / Other'],
            'genres' => ['Pop','Rock','Jazz','Clássico / Classical','Eletrônico / Electronic','Hip-Hop',
                'R&B / Soul','Sertanejo','Forró','Samba','MPB','Bossa Nova','Pagode','Axé','Funk',
                'Baile Funk','Country','Folk','Blues','Latin / Latino','Reggae','Metal','Indie',
                'Música de Casamento / Wedding Music','Corporativo / Corporate','Dance',
                'Música do Mundo / World Music','Gospel','Alternativo / Alternative','Trap','K-Pop'],
        ]);

    // GET /api/performers/me/profile
    case 'me':
        $user = requireAuth(); requireRole($user, 'performer', 'admin');
        $profile = Database::queryOne(
            'SELECT p.*,u.name,u.email,u.city,u.state,u.country,u.latitude,u.longitude,u.avatar_url,u.bio,u.phone,u.is_verified
             FROM performers p JOIN users u ON p.user_id=u.id WHERE p.user_id=?', [$user['id']]);
        if (!$profile) jsonError('Profile not found', 404);
        jsonResponse(parsePerformerJson($profile));

    // PUT /api/performers/profile
    case 'profile':
        if ($method !== 'PUT') jsonError('Method not allowed', 405);
        $user = requireAuth(); requireRole($user, 'performer', 'admin');
        $b    = getBody();
        $perf = Database::queryOne('SELECT * FROM performers WHERE user_id=?', [$user['id']]);
        if (!$perf) jsonError('Performer profile not found', 404);

        Database::execute(
            'UPDATE users SET name=?,bio=?,phone=?,city=?,state=?,country=?,latitude=?,longitude=?,avatar_url=?,updated_at=NOW() WHERE id=?',
            [$b['name']??$user['name'],$b['bio']??null,$b['phone']??null,$b['city']??null,$b['state']??null,
             $b['country']??null,$b['latitude']??null,$b['longitude']??null,$b['avatar_url']??null,$user['id']]
        );
        Database::execute(
            'UPDATE performers SET act_type=?,act_name=?,genres=?,experience_years=?,experience_description=?,
             hourly_rate=?,min_hours=?,max_travel_km=?,equipment=?,youtube_links=?,audio_links=?,youtube_channel=?,
             profile_headline=?,website_url=?,whatsapp=?,spotify_url=?,soundcloud_url=?,bandcamp_url=?,apple_music_url=?,
             setlist=?,languages=?,performance_types=?,awards=?,press_quotes=?,rider_requirements=?,cancellation_policy=?,
             instagram_handle=?,facebook_handle=?,tiktok_handle=?,twitter_handle=?,updated_at=NOW() WHERE user_id=?',
            [
                $b['act_type']??$perf['act_type'], $b['act_name']??$perf['act_name'],
                json_encode($b['genres']??safeJson($perf['genres'])),
                $b['experience_years']??$perf['experience_years'], $b['experience_description']??$perf['experience_description'],
                $b['hourly_rate']??$perf['hourly_rate'], $b['min_hours']??$perf['min_hours'],
                $b['max_travel_km']??$perf['max_travel_km'], $b['equipment']??$perf['equipment'],
                json_encode($b['youtube_links']??safeJson($perf['youtube_links'])),
                json_encode($b['audio_links']??safeJson($perf['audio_links'])),
                $b['youtube_channel']??$perf['youtube_channel'],
                $b['profile_headline']??$perf['profile_headline'], $b['website_url']??$perf['website_url'],
                $b['whatsapp']??$perf['whatsapp'], $b['spotify_url']??$perf['spotify_url'],
                $b['soundcloud_url']??$perf['soundcloud_url'], $b['bandcamp_url']??$perf['bandcamp_url'],
                $b['apple_music_url']??$perf['apple_music_url'],
                json_encode($b['setlist']??safeJson($perf['setlist'])),
                json_encode($b['languages']??safeJson($perf['languages'])),
                json_encode($b['performance_types']??safeJson($perf['performance_types'])),
                $b['awards']??$perf['awards'], $b['press_quotes']??$perf['press_quotes'],
                $b['rider_requirements']??$perf['rider_requirements'], $b['cancellation_policy']??$perf['cancellation_policy'],
                $b['instagram_handle']??$perf['instagram_handle'], $b['facebook_handle']??$perf['facebook_handle'],
                $b['tiktok_handle']??$perf['tiktok_handle'], $b['twitter_handle']??$perf['twitter_handle'],
                $user['id']
            ]
        );
        $updated = Database::queryOne('SELECT p.*,u.name,u.email,u.city,u.state,u.country,u.latitude,u.longitude,u.avatar_url,u.bio
            FROM performers p JOIN users u ON p.user_id=u.id WHERE p.user_id=?', [$user['id']]);
        jsonResponse(array_merge(parsePerformerJson($updated), ['message' => 'Profile updated']));

    // POST /api/performers/social-share
    case 'social-share':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $user = requireAuth(); requireRole($user, 'performer');
        $b    = getBody();
        if (!in_array($b['platform']??'', ['instagram','facebook','tiktok','twitter','linkedin','youtube'])) jsonError('Invalid platform');
        $perf = Database::queryOne('SELECT * FROM performers WHERE user_id=?', [$user['id']]);
        if (!$perf) jsonError('Performer not found', 404);
        Database::execute('INSERT INTO social_shares (id,performer_id,platform,post_url,points_awarded,verified) VALUES (?,?,?,?,10,1)',
            [uuid(),$perf['id'],$b['platform'],$b['post_url']??null]);
        Database::execute('UPDATE performers SET platform_score=platform_score+10,updated_at=NOW() WHERE id=?', [$perf['id']]);
        jsonResponse(['message' => '+10 points awarded for '.$b['platform'].'!', 'points' => 10]);

    // GET /api/performers/{id}
    default:
        if ($method !== 'GET') jsonError('Method not allowed', 405);
        $id = $action;
        $p  = Database::queryOne(
            'SELECT p.*,u.name,u.email,u.city,u.state,u.country,u.latitude,u.longitude,u.avatar_url,u.is_verified,u.bio,u.phone
             FROM performers p JOIN users u ON p.user_id=u.id WHERE p.id=? AND u.is_active=1', [$id]);
        if (!$p) jsonError('Performer not found', 404);
        $ratings = Database::query(
            'SELECT r.*,u.name as rater_name,u.avatar_url as rater_avatar FROM ratings r
             JOIN users u ON r.rater_user_id=u.id WHERE r.rated_user_id=? ORDER BY r.created_at DESC LIMIT 10',
            [$p['user_id']]);
        $shares  = Database::queryOne('SELECT COUNT(*) as count FROM social_shares WHERE performer_id=?', [$p['id']]);
        jsonResponse(array_merge(parsePerformerJson($p), ['ratings'=>$ratings,'social_shares_count'=>(int)($shares['count']??0)]));
}

function parsePerformerJson(array $p): array {
    $p['youtube_links']     = safeJson($p['youtube_links'] ?? null);
    $p['audio_links']       = safeJson($p['audio_links'] ?? null);
    $p['genres']            = safeJson($p['genres'] ?? null);
    $p['setlist']           = safeJson($p['setlist'] ?? null);
    $p['languages']         = safeJson($p['languages'] ?? null);
    $p['performance_types'] = safeJson($p['performance_types'] ?? null);
    return $p;
}

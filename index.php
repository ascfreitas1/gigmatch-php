<?php
/**
 * GigMatch PHP — Front Controller
 * All requests pass through here. .htaccess rewrites /api/* to this file.
 */

require_once __DIR__ . '/core/config.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/helpers.php';

setCorsHeaders();

// Only handle /api/* here — static files served directly by Apache/Nginx
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = rtrim($uri, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Remove /api prefix
if (strpos($uri, '/api') === 0) {
    $uri = substr($uri, 4);
} else {
    // Serve frontend SPA for all non-API routes
    readfile(__DIR__ . '/public/index.html');
    exit;
}

// Split URI: /resource/action/subaction
$parts     = array_values(array_filter(explode('/', $uri)));
$resource  = $parts[0] ?? '';
$action    = $parts[1] ?? '';
$subAction = $parts[2] ?? '';

// ── Built-in routes (users/me, health) ───────────────────────────────────────

if ($uri === '/health') {
    jsonResponse(['status' => 'ok', 'version' => '1.0.0', 'service' => 'GigMatch PHP API']);
}

if ($resource === 'users') {
    $user = requireAuth();
    if ($action === 'me') {
        if ($method === 'GET') {
            $profile = null;
            if ($user['role'] === 'performer') {
                $profile = Database::queryOne(
                    'SELECT p.*,u.name,u.email,u.city,u.state,u.country,u.latitude,u.longitude,
                     u.avatar_url,u.bio,u.phone,u.is_verified,u.social_score
                     FROM performers p JOIN users u ON p.user_id=u.id WHERE p.user_id=?', [$user['id']]);
                if ($profile) {
                    $profile['genres']        = json_decode($profile['genres'] ?? '[]', true);
                    $profile['youtube_links'] = json_decode($profile['youtube_links'] ?? '[]', true);
                }
            } elseif ($user['role'] === 'host') {
                $profile = Database::queryOne(
                    'SELECT h.*,u.name,u.email,u.city,u.state,u.country,u.latitude,u.longitude,u.avatar_url,u.bio,u.phone,u.is_verified
                     FROM hosts h JOIN users u ON h.user_id=u.id WHERE h.user_id=?', [$user['id']]);
            }
            jsonResponse([
                'user'    => array_intersect_key($user, array_flip(['id','email','name','role','avatar_url','city','is_verified','social_score'])),
                'profile' => $profile,
            ]);
        }
        if ($method === 'PUT') {
            $b = getBody();
            Database::execute(
                "UPDATE users SET name=?,bio=?,phone=?,city=?,state=?,country=?,latitude=?,longitude=?,avatar_url=?,updated_at=NOW() WHERE id=?",
                [$b['name']??$user['name'],$b['bio']??null,$b['phone']??null,$b['city']??null,$b['state']??null,
                 $b['country']??null,$b['latitude']??null,$b['longitude']??null,$b['avatar_url']??null,$user['id']]
            );
            if ($user['role'] === 'host' && (!empty($b['company_name']) || !empty($b['host_type']))) {
                Database::execute("UPDATE hosts SET company_name=?,host_type=?,updated_at=NOW() WHERE user_id=?",
                    [$b['company_name']??null,$b['host_type']??null,$user['id']]);
            }
            jsonResponse(['message' => 'Profile updated']);
        }
    }
    jsonError('Not found', 404);
}

// ── Delegate to route files ───────────────────────────────────────────────────

$routeMap = [
    'auth'          => __DIR__ . '/api/auth/index.php',
    'performers'    => __DIR__ . '/api/performers/index.php',
    'events'        => __DIR__ . '/api/events/index.php',
    'bookings'      => __DIR__ . '/api/bookings/index.php',
    'messages'      => __DIR__ . '/api/messages/index.php',
    'notifications' => __DIR__ . '/api/notifications/index.php',
    'admin'         => __DIR__ . '/api/admin/index.php',
];

// Normalise action for routes that use it as an identifier
// e.g. GET /api/performers → action=''
// e.g. GET /api/performers/meta/act-types → action='meta'
// e.g. GET /api/performers/abc-123 → action='abc-123'

if (isset($routeMap[$resource])) {
    require $routeMap[$resource];
} else {
    jsonError('API endpoint not found', 404);
}

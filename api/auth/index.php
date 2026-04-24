<?php
require_once __DIR__ . '/../../core/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];

// Route: /api/auth/{action}
switch ($action ?? '') {

    // ── POST /api/auth/register ───────────────────────────────────────────────
    case 'register':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $b = getBody();
        ['email' => $email, 'password' => $password, 'name' => $name, 'role' => $role] = $b + ['email'=>'','password'=>'','name'=>'','role'=>''];

        if (!$email || !$password || !$name || !$role) jsonError('Missing required fields');
        if (!in_array($role, ['performer','host'])) jsonError('Role must be performer or host');
        if (strlen($password) < 8) jsonError('Password must be at least 8 characters');

        $existing = Database::queryOne('SELECT id FROM users WHERE email = ?', [strtolower($email)]);
        if ($existing) jsonError('Email already registered', 409);

        $userId = uuid();
        $hash   = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        Database::execute(
            'INSERT INTO users (id,email,password_hash,role,name,phone,city,state,country,latitude,longitude)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [$userId, strtolower($email), $hash, $role, $name,
             $b['phone'] ?? null, $b['city'] ?? null, $b['state'] ?? null, $b['country'] ?? null,
             $b['latitude'] ?? null, $b['longitude'] ?? null]
        );
        createProfileRow($userId, $role);
        $user = Database::queryOne('SELECT * FROM users WHERE id = ?', [$userId]);
        jsonResponse(buildLoginResponse($user), 201);

    // ── POST /api/auth/login ──────────────────────────────────────────────────
    case 'login':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $b = getBody();
        $email = $b['email'] ?? ''; $password = $b['password'] ?? '';
        if (!$email || !$password) jsonError('Email and password required');

        $user = Database::queryOne('SELECT * FROM users WHERE email = ? AND is_active = 1', [strtolower($email)]);
        if (!$user) jsonError('Invalid credentials', 401);
        if (empty($user['password_hash'])) jsonError('This account uses ' . ($user['oauth_provider'] ?? 'social') . ' login', 401);
        if (!password_verify($password, $user['password_hash'])) jsonError('Invalid credentials', 401);

        jsonResponse(buildLoginResponse($user));

    // ── POST /api/auth/google ─────────────────────────────────────────────────
    case 'google':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $b = getBody();
        $idToken = $b['id_token'] ?? ''; $role = $b['role'] ?? null;
        if (!$idToken) jsonError('Google id_token required');

        $gRes  = @file_get_contents("https://oauth2.googleapis.com/tokeninfo?id_token=$idToken");
        if (!$gRes) jsonError('Invalid Google token', 401);
        $gData = json_decode($gRes, true);
        if (!empty($gData['error'])) jsonError('Google token rejected: ' . $gData['error'], 401);

        $googleId  = $gData['sub'];
        $email     = strtolower($gData['email'] ?? '');
        $name      = $gData['name'] ?? explode('@', $email)[0];
        $avatarUrl = $gData['picture'] ?? null;

        $user = Database::queryOne('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?', ['google', $googleId]);
        if (!$user) $user = Database::queryOne('SELECT * FROM users WHERE email = ?', [$email]);

        if ($user) {
            Database::execute('UPDATE users SET oauth_provider=?,oauth_id=?,avatar_url=COALESCE(avatar_url,?),updated_at=NOW() WHERE id=?',
                ['google', $googleId, $avatarUrl, $user['id']]);
            $user = Database::queryOne('SELECT * FROM users WHERE id = ?', [$user['id']]);
        } else {
            $userRole = ($role && in_array($role, ['performer','host'])) ? $role : null;
            if (!$userRole) jsonResponse(['needs_role' => true, 'google_id' => $googleId, 'email' => $email, 'name' => $name, 'avatar_url' => $avatarUrl]);
            $userId = uuid();
            Database::execute("INSERT INTO users (id,email,password_hash,role,name,avatar_url,oauth_provider,oauth_id) VALUES (?,?,'',?,?,?,'google',?)",
                [$userId, $email, $userRole, $name, $avatarUrl, $googleId]);
            createProfileRow($userId, $userRole);
            $user = Database::queryOne('SELECT * FROM users WHERE id = ?', [$userId]);
        }
        jsonResponse(buildLoginResponse($user));

    // ── POST /api/auth/facebook ───────────────────────────────────────────────
    case 'facebook':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $b = getBody();
        $accessToken = $b['access_token'] ?? ''; $role = $b['role'] ?? null;
        if (!$accessToken) jsonError('Facebook access_token required');

        $fbRes = @file_get_contents("https://graph.facebook.com/me?fields=id,name,email,picture.width(200)&access_token=$accessToken");
        if (!$fbRes) jsonError('Invalid Facebook token', 401);
        $fbData = json_decode($fbRes, true);
        if (!empty($fbData['error'])) jsonError('Facebook token rejected: ' . $fbData['error']['message'], 401);

        $fbId      = $fbData['id'];
        $email     = strtolower($fbData['email'] ?? "fb_{$fbId}@gigmatch.app");
        $name      = $fbData['name'] ?? explode('@', $email)[0];
        $avatarUrl = $fbData['picture']['data']['url'] ?? null;

        $user = Database::queryOne('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?', ['facebook', $fbId]);
        if (!$user && !empty($fbData['email'])) $user = Database::queryOne('SELECT * FROM users WHERE email = ?', [$email]);

        if ($user) {
            Database::execute('UPDATE users SET oauth_provider=?,oauth_id=?,avatar_url=COALESCE(avatar_url,?),updated_at=NOW() WHERE id=?',
                ['facebook', $fbId, $avatarUrl, $user['id']]);
            $user = Database::queryOne('SELECT * FROM users WHERE id = ?', [$user['id']]);
        } else {
            $userRole = ($role && in_array($role, ['performer','host'])) ? $role : null;
            if (!$userRole) jsonResponse(['needs_role' => true, 'fb_id' => $fbId, 'email' => $email, 'name' => $name, 'avatar_url' => $avatarUrl]);
            $userId = uuid();
            Database::execute("INSERT INTO users (id,email,password_hash,role,name,avatar_url,oauth_provider,oauth_id) VALUES (?,?,'',?,?,?,'facebook',?)",
                [$userId, $email, $userRole, $name, $avatarUrl, $fbId]);
            createProfileRow($userId, $userRole);
            $user = Database::queryOne('SELECT * FROM users WHERE id = ?', [$userId]);
        }
        jsonResponse(buildLoginResponse($user));

    // ── POST /api/auth/change-password ────────────────────────────────────────
    case 'change-password':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $b = getBody();
        $user = Database::queryOne('SELECT * FROM users WHERE email = ?', [$b['email'] ?? '']);
        if (!$user || !password_verify($b['oldPassword'] ?? '', $user['password_hash'])) jsonError('Invalid credentials', 401);
        if (strlen($b['newPassword'] ?? '') < 8) jsonError('New password must be at least 8 characters');
        Database::execute('UPDATE users SET password_hash=?,updated_at=NOW() WHERE id=?',
            [password_hash($b['newPassword'], PASSWORD_BCRYPT, ['cost'=>12]), $user['id']]);
        jsonResponse(['message' => 'Password changed successfully']);

    default:
        jsonError('Not found', 404);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createProfileRow(string $userId, string $role): void {
    if ($role === 'performer') {
        Database::execute(
            "INSERT IGNORE INTO performers (id,user_id,act_type,act_name,genres,hourly_rate) VALUES (?,?,'','','[]',0)",
            [uuid(), $userId]
        );
    } elseif ($role === 'host') {
        Database::execute('INSERT IGNORE INTO hosts (id,user_id) VALUES (?,?)', [uuid(), $userId]);
    }
}

function buildLoginResponse(array $user): array {
    $token   = generateToken($user['id'], $user['role']);
    $profile = null;
    if ($user['role'] === 'performer') {
        $profile = Database::queryOne('SELECT * FROM performers WHERE user_id = ?', [$user['id']]);
        if ($profile) { $profile['genres'] = safeJson($profile['genres']); $profile['youtube_links'] = safeJson($profile['youtube_links']); }
    } elseif ($user['role'] === 'host') {
        $profile = Database::queryOne('SELECT * FROM hosts WHERE user_id = ?', [$user['id']]);
    }
    return [
        'token'   => $token,
        'user'    => array_intersect_key($user, array_flip(['id','email','name','role','avatar_url','city','is_verified','oauth_provider'])),
        'profile' => $profile,
    ];
}

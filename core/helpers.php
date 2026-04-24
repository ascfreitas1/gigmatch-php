<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

// ─── JSON response helpers ────────────────────────────────────────────────────

function jsonResponse(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $message, int $status = 400): never {
    jsonResponse(['error' => $message], $status);
}

// ─── Request helpers ──────────────────────────────────────────────────────────

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

function getQuery(): array {
    return $_GET;
}

function uuid(): string {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// ─── JWT (pure PHP, no external lib) ─────────────────────────────────────────

function jwtEncode(array $payload): string {
    $header  = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url(json_encode($payload));
    $sig     = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwtDecode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    if (!$data || (isset($data['exp']) && $data['exp'] < time())) return null;
    return $data;
}

function base64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function generateToken(string $userId, string $role): string {
    return jwtEncode([
        'userId' => $userId,
        'role'   => $role,
        'iat'    => time(),
        'exp'    => time() + JWT_EXPIRE,
    ]);
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    $token  = str_replace('Bearer ', '', $header);
    if (!$token) jsonError('Unauthorized - No token provided', 401);

    $decoded = jwtDecode($token);
    if (!$decoded) jsonError('Unauthorized - Invalid token', 401);

    $user = Database::queryOne(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        [$decoded['userId']]
    );
    if (!$user) jsonError('Unauthorized - User not found', 401);
    return $user;
}

function requireRole(array $user, string ...$roles): void {
    if (!in_array($user['role'], $roles, true)) {
        jsonError('Forbidden', 403);
    }
}

// ─── Business helpers ─────────────────────────────────────────────────────────

function calculateBooking(float $hourlyRate, float $hours): array {
    $subtotal        = $hourlyRate * $hours;
    $commission      = $subtotal * PLATFORM_FEE;
    $total           = $subtotal;
    $performerPayout = $subtotal - $commission;
    return compact('subtotal', 'commission', 'total', 'performerPayout');
}

function getDistanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float {
    $R    = 6371;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a    = sin($dLat / 2) ** 2
          + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function createNotification(string $userId, string $type, string $title, string $message, ?array $data = null): void {
    Database::execute(
        'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?,?,?,?,?,?)',
        [uuid(), $userId, $type, $title, $message, $data ? json_encode($data) : null]
    );
}

function geocodeCity(string $city, string $country = ''): ?array {
    $q   = urlencode(trim("$city $country"));
    $url = "https://nominatim.openstreetmap.org/search?q=$q&format=json&limit=1";
    $ctx = stream_context_create(['http' => ['header' => "User-Agent: GigMatch/1.0\r\n", 'timeout' => 5]]);
    $res = @file_get_contents($url, false, $ctx);
    if (!$res) return null;
    $data = json_decode($res, true);
    if (empty($data[0])) return null;
    return ['lat' => (float)$data[0]['lat'], 'lon' => (float)$data[0]['lon']];
}

function safeJson(mixed $val, mixed $fallback = []): mixed {
    if (is_array($val)) return $val;
    if (!$val) return $fallback;
    $decoded = json_decode($val, true);
    return ($decoded !== null) ? $decoded : $fallback;
}

function paginate(array $items, int $page, int $limit): array {
    $total = count($items);
    $slice = array_slice($items, ($page - 1) * $limit, $limit);
    return ['items' => $slice, 'total' => $total, 'page' => $page, 'totalPages' => (int)ceil($total / $limit)];
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

function setCorsHeaders(): void {
    $origin = CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN;
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, x-auth-token');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

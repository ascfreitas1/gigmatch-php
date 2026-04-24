<?php
require_once __DIR__ . '/../../core/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$q      = getQuery();

switch ($action ?? '') {

    // GET /api/notifications
    case '':
    case 'list':
        $user   = requireAuth();
        $page   = (int)($q['page']??1); $limit = (int)($q['limit']??20);
        $sql    = 'SELECT * FROM notifications WHERE user_id=?';
        $params = [$user['id']];
        if (!empty($q['unread_only']) && $q['unread_only']==='true') { $sql .= ' AND is_read=0'; }
        $sql .= ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        $params[] = $limit; $params[] = ($page-1)*$limit;
        $notifs = Database::query($sql,$params);
        $unread = Database::queryOne('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0',[$user['id']]);
        jsonResponse([
            'items'        => array_map(fn($n) => array_merge($n, ['data'=>$n['data']?json_decode($n['data'],true):null]), $notifs),
            'unread_count' => (int)($unread['c']??0),
        ]);

    // PUT /api/notifications/read/all
    case 'read-all':
        $user = requireAuth();
        Database::execute('UPDATE notifications SET is_read=1 WHERE user_id=?',[$user['id']]);
        jsonResponse(['message'=>'All notifications marked as read']);

    // PUT /api/notifications/{id}/read
    default:
        $user = requireAuth();
        Database::execute('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?',[$action,$user['id']]);
        jsonResponse(['message'=>'Marked as read']);
}

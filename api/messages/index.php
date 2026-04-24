<?php
require_once __DIR__ . '/../../core/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$q      = getQuery();

switch ($action ?? '') {

    // GET /api/messages/conversations
    case 'conversations':
        $user = requireAuth();
        $uid  = $user['id'];
        $convos = Database::query(
            'SELECT
               CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END as other_user_id,
               u.name as other_name, u.avatar_url as other_avatar, u.role as other_role,
               MAX(m.created_at) as last_message_at,
               SUM(CASE WHEN m.receiver_id=? AND m.is_read=0 THEN 1 ELSE 0 END) as unread_count,
               (SELECT message FROM messages m2
                WHERE (m2.sender_id=? AND m2.receiver_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END)
                   OR (m2.sender_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END AND m2.receiver_id=?)
                ORDER BY m2.created_at DESC LIMIT 1) as last_message
             FROM messages m
             JOIN users u ON u.id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END
             WHERE m.sender_id=? OR m.receiver_id=?
             GROUP BY other_user_id
             ORDER BY last_message_at DESC',
            [$uid,$uid,$uid,$uid,$uid,$uid,$uid,$uid,$uid]
        );
        jsonResponse($convos);

    // GET /api/messages/unread/count
    case 'unread':
        $user  = requireAuth();
        $count = Database::queryOne('SELECT COUNT(*) as c FROM messages WHERE receiver_id=? AND is_read=0',[$user['id']]);
        jsonResponse(['count' => (int)($count['c']??0)]);

    // POST /api/messages — send a message
    case 'send':
        if ($method !== 'POST') jsonError('Method not allowed',405);
        $user = requireAuth();
        $b    = getBody();
        if (empty($b['receiver_id'])||empty($b['message'])) jsonError('receiver_id and message required');
        if (!Database::queryOne('SELECT id FROM users WHERE id=?',[$b['receiver_id']])) jsonError('Recipient not found',404);
        $msgId = uuid();
        Database::execute('INSERT INTO messages (id,booking_id,sender_id,receiver_id,message) VALUES (?,?,?,?,?)',
            [$msgId,$b['booking_id']??null,$user['id'],$b['receiver_id'],$b['message']]);
        jsonResponse(['id'=>$msgId,'message'=>'Message sent'],201);

    // GET /api/messages/{userId}
    default:
        $user   = requireAuth();
        $userId = $action;
        $page   = (int)($q['page']??1); $limit = (int)($q['limit']??50);
        $msgs   = Database::query(
            'SELECT m.*,u.name as sender_name,u.avatar_url as sender_avatar FROM messages m
             JOIN users u ON m.sender_id=u.id
             WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
             ORDER BY m.created_at DESC LIMIT ? OFFSET ?',
            [$user['id'],$userId,$userId,$user['id'],$limit,($page-1)*$limit]
        );
        Database::execute('UPDATE messages SET is_read=1 WHERE sender_id=? AND receiver_id=? AND is_read=0',
            [$userId,$user['id']]);
        jsonResponse(array_reverse($msgs));
}

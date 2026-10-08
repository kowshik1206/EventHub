<?php
require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}
$input = json_decode(file_get_contents('php://input'), true);
$email = trim((string)(is_array($input) ? ($input['email'] ?? '') : ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
    respond(422, ['success' => false, 'message' => 'Please enter a valid email address.']);
}
try {
    $stmt = $pdo->prepare('INSERT INTO newsletter_subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE email=VALUES(email)');
    $stmt->execute([$email]);
    respond(200, ['success' => true, 'message' => 'You are subscribed to the EventHub newsletter.']);
} catch (Throwable $e) {
    respond(500, ['success' => false, 'message' => 'Subscription failed. Please try again.']);
}

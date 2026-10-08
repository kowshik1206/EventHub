<?php
require __DIR__ . '/config.php';
// Ensure cookies are used for session IDs and that they are not marked
// Secure (which breaks on plain HTTP localhost). Must be set before
// session_start(). SameSite=Lax keeps cross-site request forgery in check
// while still allowing the session cookie to be sent on same-site links.
if (session_status() !== PHP_SESSION_ACTIVE) {
    $cookieParams = [
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'path' => '/',
    ];
    session_set_cookie_params($cookieParams);
    session_start();
}
$action = $_GET['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'me') {
    if (!empty($_SESSION['user'])) respond(200, ['success' => true, 'user' => $_SESSION['user']]);
    respond(200, ['success' => false, 'user' => null]);
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    respond(200, ['success' => true, 'message' => 'Signed out']);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['success' => false, 'message' => 'Method not allowed']);
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) respond(400, ['success' => false, 'message' => 'Invalid request']);
$action = (string)($body['action'] ?? '');
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$name = trim((string)($body['name'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190 || strlen($password) < 8 || strlen($password) > 200) {
    respond(422, ['success' => false, 'message' => 'Enter a valid email and a password of at least 8 characters.']);
}
if ($action === 'signup') {
    if ($name === '' || mb_strlen($name) > 120) respond(422, ['success' => false, 'message' => 'Enter your full name.']);
    $check = $pdo->prepare('SELECT id FROM users WHERE email=?');
    $check->execute([$email]);
    if ($check->fetch()) respond(409, ['success' => false, 'message' => 'An account with this email already exists. Please sign in.']);
    $stmt = $pdo->prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)');
    try { $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]); }
    catch (PDOException $e) { respond(409, ['success' => false, 'message' => 'Could not create account. This email may already be registered.']); }
    $id = (int)$pdo->lastInsertId();
    // Attach the fresh session to the newly created account so the next
    // request is recognised as logged in (the session cookie should already
    // be set from the signup response's session_start() call above).
} elseif ($action === 'signin') {
    $stmt = $pdo->prepare('SELECT id,name,email,password_hash FROM users WHERE email=?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) respond(401, ['success' => false, 'message' => 'Incorrect email or password.']);
    $id = (int)$user['id'];
    $name = $user['name'];
} else {
    respond(422, ['success' => false, 'message' => 'Unknown authentication action.']);
}
session_regenerate_id(true);
$_SESSION['user'] = ['id' => $id, 'name' => $name, 'email' => $email];
respond(200, ['success' => true, 'user' => $_SESSION['user']]);

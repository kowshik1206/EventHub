<?php
require __DIR__ . '/config.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
    session_start();
}

$action = $_GET['action'] ?? '';

/**
 * Admin session guard. Every action except "login" and "me" requires it.
 */
function requireAdmin(): array {
    if (empty($_SESSION['admin'])) {
        respond(401, ['success' => false, 'message' => 'Admin sign in required.']);
    }
    return $_SESSION['admin'];
}

// ---- Login ----
if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) respond(400, ['success' => false, 'message' => 'Invalid request']);

    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 200) {
        respond(422, ['success' => false, 'message' => 'Enter a valid email and password.']);
    }

    $stmt = $pdo->prepare('SELECT id, email, password_hash, display_name FROM admins WHERE email=?');
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        respond(401, ['success' => false, 'message' => 'Incorrect admin email or password.']);
    }

    session_regenerate_id(true);
    $_SESSION['admin'] = ['id' => (int)$admin['id'], 'email' => $admin['email'], 'name' => $admin['display_name']];
    respond(200, ['success' => true, 'admin' => $_SESSION['admin']]);
}

// ---- Session probe ----
if ($action === 'me') {
    respond(200, empty($_SESSION['admin'])
        ? ['success' => false, 'admin' => null]
        : ['success' => true, 'admin' => $_SESSION['admin']]);
}

// ---- Logout ----
if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    respond(200, ['success' => true, 'message' => 'Signed out']);
}

$admin = requireAdmin();

// ---- Overview stats ----
if ($action === 'stats') {
    $counts = $pdo->query(
        "SELECT
           (SELECT COUNT(*) FROM events WHERE is_active=1)                 AS events,
           (SELECT COUNT(*) FROM bookings WHERE status='confirmed')        AS bookings,
           (SELECT COALESCE(SUM(total_amount),0) FROM bookings WHERE status='confirmed') AS revenue,
           (SELECT COUNT(*) FROM users)                                    AS customers,
           (SELECT COUNT(*) FROM newsletter_subscribers)                   AS subscribers,
           (SELECT COUNT(*) FROM enquiries WHERE status='new')             AS new_enquiries,
           (SELECT COUNT(*) FROM enquiries)                                AS enquiries"
    )->fetch();

    // Top selling events so the dashboard has something to chart.
    $top = $pdo->query(
        "SELECT e.name, e.event_key, COUNT(b.id) AS seats_sold, COALESCE(SUM(b.total_amount),0) AS revenue
         FROM bookings b JOIN events e ON e.id=b.event_id
         WHERE b.status='confirmed'
         GROUP BY e.id ORDER BY seats_sold DESC LIMIT 5"
    )->fetchAll();

    // Recent activity feed.
    $recent = $pdo->query(
        "SELECT b.booking_code, b.customer_name, b.seats, b.total_amount, b.created_at, e.name AS event_name
         FROM bookings b JOIN events e ON e.id=b.event_id
         ORDER BY b.created_at DESC LIMIT 8"
    )->fetchAll();

    respond(200, ['success' => true, 'stats' => [
        'events'      => (int)$counts['events'],
        'bookings'    => (int)$counts['bookings'],
        'revenue'     => (float)$counts['revenue'],
        'customers'   => (int)$counts['customers'],
        'subscribers' => (int)$counts['subscribers'],
        'newEnquiries'=> (int)$counts['new_enquiries'],
        'enquiries'   => (int)$counts['enquiries'],
    ], 'top' => $top, 'recent' => $recent]);
}

// ---- Enquiries ----
if ($action === 'enquiries') {
    $rows = $pdo->query(
        'SELECT id, reference, name, email, phone, event_name, category, city, venue,
                event_date, expected_seats, message, status, admin_note, created_at, updated_at
         FROM enquiries ORDER BY created_at DESC LIMIT 200'
    )->fetchAll();
    respond(200, ['success' => true, 'enquiries' => $rows]);
}

if ($action === 'enquiry-update' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) respond(400, ['success' => false, 'message' => 'Invalid request']);

    $id = filter_var($body['id'] ?? null, FILTER_VALIDATE_INT);
    $status = (string)($body['status'] ?? '');
    $note = trim((string)($body['note'] ?? ''));
    $allowed = ['new', 'reviewing', 'approved', 'rejected'];

    if (!$id) respond(422, ['success' => false, 'message' => 'Missing enquiry id.']);
    if (!in_array($status, $allowed, true)) {
        respond(422, ['success' => false, 'message' => 'Status must be one of: ' . implode(', ', $allowed) . '.']);
    }
    if (mb_strlen($note) > 4000) respond(422, ['success' => false, 'message' => 'Note is too long.']);

    $stmt = $pdo->prepare('UPDATE enquiries SET status=?, admin_note=? WHERE id=?');
    $stmt->execute([$status, $note, $id]);
    if ($stmt->rowCount() === 0) {
        // Still fine if only the note changed and status matched — confirm it exists.
        $check = $pdo->prepare('SELECT 1 FROM enquiries WHERE id=?');
        $check->execute([$id]);
        if (!$check->fetch()) respond(404, ['success' => false, 'message' => 'Enquiry not found.']);
    }
    respond(200, ['success' => true, 'message' => 'Enquiry updated.']);
}

// ---- Bookings & customers ----
if ($action === 'bookings') {
    $rows = $pdo->query(
        "SELECT b.id, b.booking_code, b.seats, b.quantity, b.total_amount, b.status,
                b.customer_name, b.customer_email, b.created_at,
                e.name AS event_name, e.event_key, e.event_date, e.venue, e.city,
                t.label AS ticket_label
         FROM bookings b
         JOIN events e ON e.id=b.event_id
         JOIN ticket_types t ON t.id=b.ticket_type_id
         ORDER BY b.created_at DESC LIMIT 200"
    )->fetchAll();
    respond(200, ['success' => true, 'bookings' => $rows]);
}

if ($action === 'customers') {
    $rows = $pdo->query(
        "SELECT u.id, u.name, u.email, u.created_at,
                COUNT(b.id) AS bookings, COALESCE(SUM(b.total_amount),0) AS spend
         FROM users u LEFT JOIN bookings b ON b.user_id=u.id AND b.status='confirmed'
         GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200"
    )->fetchAll();
    respond(200, ['success' => true, 'customers' => $rows]);
}

if ($action === 'subscribers') {
    $rows = $pdo->query('SELECT email, subscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC LIMIT 200')->fetchAll();
    respond(200, ['success' => true, 'subscribers' => $rows]);
}

respond(404, ['success' => false, 'message' => 'Unknown admin action.']);

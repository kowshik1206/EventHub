<?php
require __DIR__ . '/config.php';

// Public endpoint: anyone can submit a "list an event" enquiry.
// Admins read these from the dashboard.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) respond(400, ['success' => false, 'message' => 'Invalid JSON body']);

$trim = static fn ($k) => trim((string)($input[$k] ?? ''));

$name       = $trim('name');
$email      = $trim('email');
$phone      = $trim('phone');
$eventName  = $trim('event_name');
$category   = $trim('category');
$city       = $trim('city');
$venue      = $trim('venue');
$eventDate  = $trim('event_date');
$seatsRaw   = $trim('expected_seats');
$message    = $trim('message');

// Keep failures quiet and specific so the form can show one clear line.
$errors = [];
if ($name === '' || mb_strlen($name) > 120) $errors[] = 'Enter your name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) $errors[] = 'Enter a valid email address.';
if ($eventName === '' || mb_strlen($eventName) > 180) $errors[] = 'Enter your event name.';
if ($city === '' || mb_strlen($city) > 100) $errors[] = 'Enter a city.';
if ($phone !== '' && !preg_match('/^[0-9+\-\s()]{6,40}$/', $phone)) $errors[] = 'Enter a valid phone number.';
if ($eventDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $eventDate)) $errors[] = 'Enter a valid date.';
if ($seatsRaw !== '' && (!ctype_digit($seatsRaw) || (int)$seatsRaw > 1000000)) $errors[] = 'Enter a valid expected attendance.';
if (mb_strlen($message) > 4000) $errors[] = 'Message is too long (4000 characters max).';

$allowedCategories = ['music', 'tech', 'food', 'art', 'sports', 'comedy', 'other'];
if (!in_array($category, $allowedCategories, true)) $category = 'other';

if ($errors) respond(422, ['success' => false, 'message' => implode(' ', $errors)]);

// Reference code the enquirer can quote back, e.g. EV-4K2M-9QX7.
$alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
$refStmt = $pdo->prepare('SELECT 1 FROM enquiries WHERE reference=?');
do {
    $blocks = [];
    for ($b = 0; $b < 2; $b++) {
        $block = '';
        for ($i = 0; $i < 4; $i++) $block .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $blocks[] = $block;
    }
    $reference = 'EV-' . implode('-', $blocks);
    $refStmt->execute([$reference]);
} while ($refStmt->fetch());

try {
    $stmt = $pdo->prepare(
        'INSERT INTO enquiries (reference,name,email,phone,event_name,category,city,venue,event_date,expected_seats,message)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([
        $reference, $name, $email, $phone, $eventName, $category, $city, $venue,
        $eventDate !== '' ? $eventDate : null,
        $seatsRaw !== '' ? (int)$seatsRaw : 0,
        $message,
    ]);
} catch (Throwable $e) {
    respond(500, ['success' => false, 'message' => 'Could not send your enquiry. Please try again.']);
}

respond(201, [
    'success' => true,
    'reference' => $reference,
    'message' => "Thanks {$name} — your enquiry is with our team. Reference {$reference}.",
]);

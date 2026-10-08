<?php
require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}

$where = ['e.is_active = 1'];
$params = [];

$q = trim((string)($_GET['q'] ?? ''));
$city = trim((string)($_GET['city'] ?? ''));
$date = trim((string)($_GET['date'] ?? ''));
$category = trim((string)($_GET['category'] ?? ''));

if ($q !== '') {
    $where[] = '(e.name LIKE ? OR e.venue LIKE ? OR e.city LIKE ? OR e.category LIKE ?)';
    $like = '%' . $q . '%';
    array_push($params, $like, $like, $like, $like);
}
if ($city !== '') { $where[] = 'e.city = ?'; $params[] = $city; }
if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $where[] = 'e.event_date = ?'; $params[] = $date;
}
if ($category !== '' && $category !== 'all') { $where[] = 'e.category = ?'; $params[] = $category; }

$sql = 'SELECT e.* FROM events e WHERE ' . implode(' AND ', $where) . ' ORDER BY e.event_date, e.id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$events = $stmt->fetchAll();

// Seats already reserved through real bookings, grouped by event key.
// These are separate from events.sold_seats (pre-sold seed inventory), so the
// seat map has to show the union of both.
$bookedStmt = $pdo->query(
    "SELECT e.event_key, b.seats FROM bookings b
     JOIN events e ON e.id = b.event_id
     WHERE b.status = 'confirmed' AND b.seats <> ''"
);
$bookedByEvent = [];
foreach ($bookedStmt->fetchAll() as $row) {
    foreach (explode(',', $row['seats']) as $seat) {
        $seat = trim($seat);
        if ($seat !== '') {
            $bookedByEvent[$row['event_key']][$seat] = true;
        }
    }
}

$ticketStmt = $pdo->query(
    'SELECT e.event_key, t.id, t.label, t.price, t.row_from, t.row_to
     FROM ticket_types t JOIN events e ON e.id = t.event_id ORDER BY e.id, t.id'
);
$typesByEvent = [];
foreach ($ticketStmt->fetchAll() as $row) {
    $typesByEvent[$row['event_key']][] = $row;
}

foreach ($events as &$event) {
    $key = $event['event_key'];

    $event['id'] = $key;
    $event['date'] = $event['event_date'];
    $event['time'] = $event['event_time'];
    $event['seatsLeft'] = (int)$event['seats_left'];
    $event['art'] = $event['art_class'];
    $event['image'] = $event['image_url'];

    // Seat map geometry.
    $event['rows'] = (int)$event['seat_rows'];
    $event['seatsPerRow'] = (int)$event['seats_per_row'];

    // Pricing zones: which rows belong to which ticket type.
    $zones = [];
    foreach ($typesByEvent[$key] ?? [] as $t) {
        $zones[] = [
            'id' => (int)$t['id'],
            'label' => $t['label'],
            'price' => (float)$t['price'],
            'rowFrom' => (int)$t['row_from'],
            'rowTo' => (int)$t['row_to'],
        ];
    }
    $event['zones'] = $zones;
    $event['types'] = array_map(static function ($z) {
        return ['id' => $z['id'], 'label' => $z['label'], 'price' => $z['price']];
    }, $zones);

    // Union of pre-sold seed seats and seats held by confirmed bookings.
    $sold = [];
    foreach (explode(',', (string)$event['sold_seats']) as $seat) {
        $seat = trim($seat);
        if ($seat !== '') { $sold[$seat] = true; }
    }
    foreach ($bookedByEvent[$key] ?? [] as $seat => $_) {
        $sold[$seat] = true;
    }
    $event['soldSeats'] = array_keys($sold);

    unset(
        $event['event_key'], $event['event_date'], $event['event_time'],
        $event['seat_rows'], $event['seats_per_row'], $event['sold_seats'],
        $event['seats_left'], $event['art_class'], $event['image_url'],
        $event['is_active'], $event['created_at']
    );
}
unset($event);

respond(200, ['success' => true, 'events' => $events]);

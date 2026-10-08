<?php
require __DIR__ . '/config.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
if (empty($_SESSION['user']['id'])) respond(401, ['success' => false, 'message' => 'Please sign in before booking.']);
$user = $_SESSION['user'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) respond(400, ['success' => false, 'message' => 'Invalid JSON body']);

$eventKey = trim((string)($input['event_id'] ?? ''));
$name = $user['name'];
$email = $user['email'];
$seats = $input['seats'] ?? null;

// Seat labels look like "A1" .. "AA12": row letters then seat number.
function seat_row(string $label): int {
    preg_match('/^([A-Z]+)(\d+)$/', $label, $m);
    if (!$m) return 0;
    $n = 0;
    foreach (str_split($m[1]) as $ch) { $n = $n * 26 + (ord($ch) - 64); }
    return $n;
}
function seat_number(string $label): int {
    return (int)preg_replace('/^[A-Z]+/', '', $label);
}

// Normalise the seat list.
$seatList = [];
if (is_string($seats)) {
    $seatList = array_filter(array_map('trim', explode(',', $seats)), 'strlen');
} elseif (is_array($seats)) {
    foreach ($seats as $s) { $s = trim((string)$s); if ($s !== '') $seatList[] = $s; }
}
$seatList = array_values(array_unique($seatList));
$quantity = count($seatList);

if ($eventKey === '' || $name === '' || mb_strlen($name) > 120 ||
    !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
    respond(422, ['success' => false, 'message' => 'Enter a valid name, email, and event.']);
}
if ($quantity < 1 || $quantity > 10) {
    respond(422, ['success' => false, 'message' => 'Choose between 1 and 10 seats.']);
}
foreach ($seatList as $label) {
    if (!preg_match('/^[A-Z]{1,3}\d{1,3}$/', $label)) {
        respond(422, ['success' => false, 'message' => 'That seat label is not valid.']);
    }
}

try {
    $pdo->beginTransaction();

    // Lock the event row so concurrent bookings cannot oversell.
    $eventStmt = $pdo->prepare(
        'SELECT id, name, seat_rows, seats_per_row, sold_seats
         FROM events WHERE event_key=? AND is_active=1 FOR UPDATE'
    );
    $eventStmt->execute([$eventKey]);
    $event = $eventStmt->fetch();
    if (!$event) { $pdo->rollBack(); respond(404, ['success' => false, 'message' => 'Event not found']); }

    $maxRow = (int)$event['seat_rows'];
    $maxSeat = (int)$event['seats_per_row'];

    // Every requested seat must exist on the map.
    foreach ($seatList as $label) {
        if (seat_row($label) < 1 || seat_row($label) > $maxRow || seat_number($label) < 1 || seat_number($label) > $maxSeat) {
            $pdo->rollBack();
            respond(422, ['success' => false, 'message' => "Seat {$label} does not exist at {$event['name']}."]);
        }
    }

    // Seats held by confirmed bookings are unavailable.
    $heldStmt = $pdo->prepare(
        "SELECT seats FROM bookings WHERE event_id=? AND status='confirmed'"
    );
    $heldStmt->execute([$event['id']]);
    $taken = [];
    foreach ($heldStmt->fetchAll() as $row) {
        foreach (explode(',', $row['seats']) as $s) { $s = trim($s); if ($s !== '') $taken[$s] = true; }
    }
    // Pre-sold seed inventory.
    foreach (explode(',', (string)$event['sold_seats']) as $s) {
        $s = trim($s); if ($s !== '') $taken[$s] = true;
    }

    $clash = array_values(array_intersect($seatList, array_keys($taken)));
    if ($clash) {
        $pdo->rollBack();
        respond(409, ['success' => false, 'message' => 'Seats ' . implode(', ', $clash) . ' were just taken. Pick another.']);
    }

    // Resolve pricing zones: which rows belong to which ticket type.
    $zoneStmt = $pdo->prepare(
        'SELECT id, label, price, row_from, row_to FROM ticket_types WHERE event_id=? ORDER BY id'
    );
    $zoneStmt->execute([$event['id']]);
    $zones = $zoneStmt->fetchAll();
    if (!$zones) { $pdo->rollBack(); respond(500, ['success' => false, 'message' => 'This event has no ticket types configured.']); }

    $findZone = static function (int $row) use ($zones): ?array {
        foreach ($zones as $z) {
            if ($row >= (int)$z['row_from'] && $row <= (int)$z['row_to']) return $z;
        }
        return null;
    };

    // Price each seat from its own row zone, so a basket can span tiers.
    $total = 0.0;
    $seatInfo = [];
    $primaryZone = null;
    foreach ($seatList as $label) {
        $zone = $findZone(seat_row($label));
        if (!$zone) { $pdo->rollBack(); respond(500, ['success' => false, 'message' => 'No pricing zone for seat ' . $label . '.']); }
        if ($primaryZone === null) $primaryZone = $zone;
        $total += (float)$zone['price'];
        $seatInfo[] = ['seat' => $label, 'zone' => $zone['label'], 'price' => (float)$zone['price']];
    }
    $unitPrice = $total / $quantity;

    // Human-readable random code, e.g. EH-7K3M-92QD (unambiguous alphabet).
    $alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    $codeStmt = $pdo->prepare('SELECT 1 FROM bookings WHERE booking_code=?');
    do {
        $blocks = [];
        for ($b = 0; $b < 2; $b++) {
            $block = '';
            for ($i = 0; $i < 4; $i++) {
                $block .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $blocks[] = $block;
        }
        $code = 'EH-' . implode('-', $blocks);
        $codeStmt->execute([$code]);
    } while ($codeStmt->fetch());

    $seatsCsv = implode(',', $seatList);
    $insert = $pdo->prepare(
        'INSERT INTO bookings (booking_code,event_id,ticket_type_id,user_id,customer_name,customer_email,seats,quantity,unit_price,total_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?)'
    );
    $insert->execute([
        $code, $event['id'], $primaryZone['id'], $user['id'],
        $name, $email, $seatsCsv, $quantity, round($unitPrice, 2), round($total, 2),
    ]);

    // Keep the denormalised counter in sync; sold_seats stays as seed inventory.
    $update = $pdo->prepare('UPDATE events SET seats_left = GREATEST(0, seats_left - ?) WHERE id=?');
    $update->execute([$quantity, $event['id']]);

    $pdo->commit();

    respond(201, [
        'success' => true,
        'message' => 'Booking confirmed',
        'booking' => [
            'booking_code' => $code,
            'event' => $event['name'],
            'seats' => $seatList,
            'seat_info' => $seatInfo,
            'quantity' => $quantity,
            'total' => round($total, 2),
        ],
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(500, ['success' => false, 'message' => 'Could not complete booking. Please try again.']);
}

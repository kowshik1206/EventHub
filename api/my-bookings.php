<?php
require __DIR__ . '/config.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
if (empty($_SESSION['user']['id'])) respond(401, ['success' => false, 'message' => 'Please sign in to view your bookings.']);

$stmt = $pdo->prepare(
    'SELECT b.booking_code, b.seats, b.quantity, b.total_amount, b.status, b.created_at,
            e.name AS event_name, e.event_date, e.event_time, e.venue, e.city,
            e.seat_rows, e.seats_per_row,
            t.label AS ticket_label
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     JOIN ticket_types t ON t.id = b.ticket_type_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC'
);
$stmt->execute([$_SESSION['user']['id']]);
$bookings = $stmt->fetchAll();

// Expand the stored CSV so the client gets a real array of seat labels.
foreach ($bookings as &$booking) {
    $booking['quantity'] = (int)$booking['quantity'];
    $booking['total_amount'] = (float)$booking['total_amount'];
    $booking['seat_list'] = array_values(array_filter(array_map('trim', explode(',', (string)$booking['seats']))));
}
unset($booking);

respond(200, ['success' => true, 'bookings' => $bookings]);

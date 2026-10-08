EVENTHUB — PHP + MySQL BACKEND
================================

Included:
- api/config.php       PDO database connection
- api/events.php       Reads and filters events from MySQL
- api/auth.php         Sign up, sign in, current session, sign out
- api/my-bookings.php  Lists bookings for the signed-in user
- api/bookings.php     Authenticated bookings; decreases available seats
- api/newsletter.php   Saves newsletter subscriptions
- database/eventhub.sql Database schema and sample events/ticket types
- index.html, css/, js/ Your supplied frontend, connected to the API

QUICK START (macOS / Linux, PHP built-in server)
------------------------------------------------
1. Start MySQL (e.g. `brew services start mysql`).
2. Import the schema. IMPORTANT: pass --default-character-set=utf8mb4,
   otherwise the mysql client defaults to latin1 and every non-ASCII
   character (em dashes, apostrophes) is double-encoded and renders as
   mojibake such as "â€”" in the site:

   mysql -uroot --default-character-set=utf8mb4 < database/eventhub.sql

   If the data already looks corrupted, drop and re-import:

   mysql -uroot -e "DROP DATABASE IF EXISTS eventhub;"
   mysql -uroot --default-character-set=utf8mb4 < database/eventhub.sql

3. Serve the project (do NOT open index.html via file:// — the API
   calls need http):

   php -S 127.0.0.1:8000 -t .

4. Open http://127.0.0.1:8000/index.html

RUN WITH XAMPP (Windows)
------------------------
1. Extract the ZIP.
2. Copy the folder named "event-booking" into:
   C:\xampp\htdocs\
   The final path should be C:\xampp\htdocs\event-booking\index.html
3. Open XAMPP Control Panel and start Apache and MySQL.
4. Visit http://localhost/phpmyadmin/
5. Choose Import, select:
   C:\xampp\htdocs\event-booking\database\eventhub.sql
   then click Import/Go.
   The SQL creates the "eventhub" database and inserts the sample events.
6. Open the project ONLY through:
   http://localhost/event-booking/
   Do not double-click index.html or open it as file://.

DATABASE SETTINGS
-----------------
The default XAMPP setup is configured in api/config.php:
host: 127.0.0.1
database: eventhub
username: root
password: (blank)
If your MySQL root account has a password, update $pass in api/config.php.

API ENDPOINTS
-------------
GET  /event-booking/api/events.php
GET  /event-booking/api/events.php?q=music&city=Hyderabad
POST /event-booking/api/auth.php (signup/signin)
GET  /event-booking/api/auth.php?action=me
POST /event-booking/api/auth.php?action=logout
GET  /event-booking/api/my-bookings.php
POST /event-booking/api/bookings.php
POST /event-booking/api/newsletter.php

Booking request JSON (must be signed in):
{
  "event_id": "ev1",
  "ticket_type_id": 1,
  "quantity": 2
}

Sign-up/sign-in uses the form in the website. Passwords are stored as secure password hashes.
The account button in the navbar opens the signed-in user's booking history.

Notes:
- This demo records bookings but does not process real payments or send email/QR tickets.
- Booking requires a signed-in account. The original event card and booking preview styling are retained.
- For production use, add login, payment gateway integration, email delivery, CSRF/rate limiting, and organizer/admin access.

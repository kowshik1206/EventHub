CREATE DATABASE IF NOT EXISTS eventhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eventhub;

-- Fresh seed: drop first so the seat-map schema is applied cleanly.

DROP TABLE IF EXISTS booking_seats;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS newsletter_subscribers;
DROP TABLE IF EXISTS enquiries;
DROP TABLE IF EXISTS ticket_types;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_key VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(40) NOT NULL,
  icon VARCHAR(20) NOT NULL DEFAULT '🎟',
  art_class VARCHAR(40) NOT NULL DEFAULT 'art-music',
  city VARCHAR(100) NOT NULL,
  venue VARCHAR(180) NOT NULL,
  event_date DATE NOT NULL,
  event_time VARCHAR(40) NOT NULL,
  seat_rows TINYINT UNSIGNED NOT NULL DEFAULT 8,
  seats_per_row TINYINT UNSIGNED NOT NULL DEFAULT 10,
  sold_seats TEXT NOT NULL,
  seats_left INT UNSIGNED NOT NULL DEFAULT 0,
  image_url VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  row_from TINYINT UNSIGNED NOT NULL DEFAULT 1,
  row_to TINYINT UNSIGNED NOT NULL DEFAULT 99,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(32) NOT NULL UNIQUE,
  event_id INT UNSIGNED NOT NULL,
  ticket_type_id INT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  seats VARCHAR(500) NOT NULL DEFAULT '',
  quantity TINYINT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS enquiries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  event_name VARCHAR(180) NOT NULL,
  category VARCHAR(40) NOT NULL,
  city VARCHAR(100) NOT NULL,
  venue VARCHAR(180) NOT NULL DEFAULT '',
  event_date DATE DEFAULT NULL,
  expected_seats INT UNSIGNED NOT NULL DEFAULT 0,
  message TEXT,
  status ENUM('new','reviewing','approved','rejected') NOT NULL DEFAULT 'new',
  admin_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Events + seat maps ----------

INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev1','Midnight Frequencies — Live','music','🎧','art-music','Hyderabad','Skyline Arena','2026-10-04','8:00 PM',7,7,'C5,D5,E6,F3,F6',42,'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Front row',1899,1,2 FROM events WHERE event_key='ev1';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'General admission',799,3,7 FROM events WHERE event_key='ev1';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev2','BuildStack Dev Summit','tech','💻','art-tech','Bengaluru','Innovate Convention Center','2026-10-11','9:30 AM',11,11,'B6,E1,E6',118,'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Full summit + workshops',3499,1,2 FROM events WHERE event_key='ev2';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Day pass',1499,3,11 FROM events WHERE event_key='ev2';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev3','Street Food Carnival','food','🍜','art-food','Vijayawada','Riverfront Grounds','2026-09-27','5:00 PM',4,5,'A1,A3,A4,A5,B2,B3,B4,B5,C1,C2,D1,D2,D3,D5',6,'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Entry + tasting coupons',599,1,2 FROM events WHERE event_key='ev3';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Entry pass',249,3,4 FROM events WHERE event_key='ev3';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev4','Brushstrokes: A Modern Art Walk','art','🎨','art-art','Mumbai','Harbour Gallery','2026-10-18','11:00 AM',6,5,'B3,B5,C2',27,'https://images.unsplash.com/photo-1531913764164-f85c52e6e654?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Guided tour',699,1,2 FROM events WHERE event_key='ev4';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'General entry',349,3,6 FROM events WHERE event_key='ev4';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev5','City League Finals','sports','🏸','art-sports','Chennai','Marina Sports Complex','2026-10-09','6:30 PM',5,6,'A3,A4,A5,A6,B1,B3,B4,B5,B6,C1,C3,C4,C5,C6,D1,D2,D3,D4,D6,E1,E2,E3,E4,E5,E6',3,'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Courtside',1299,1,2 FROM events WHERE event_key='ev5';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Stand seating',399,3,5 FROM events WHERE event_key='ev5';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev6','Open Mic & Roast Night','comedy','🎤','art-comedy','Hyderabad','The Laugh Cellar','2026-09-30','9:00 PM',5,4,'C1,C2,C3,D3,E2',15,'https://images.unsplash.com/photo-1585974738771-84483dd9f89f?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Reserved table (2 seats)',899,1,2 FROM events WHERE event_key='ev6';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Standard seat',349,3,5 FROM events WHERE event_key='ev6';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev7','Analog Synth Jam','music','🎹','art-music','Bengaluru','The Warehouse','2026-10-16','7:30 PM',8,7,'B4,D2',54,'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'General admission',599,1,8 FROM events WHERE event_key='ev7';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev8','AI x Design Workshop','tech','🧠','art-tech','Mumbai','Studio 9 Coworks','2026-10-22','10:00 AM',5,5,'A2,A3,B3,E3',21,'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Workshop seat',1199,1,5 FROM events WHERE event_key='ev8';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev9','Spice Route Food Festival','food','🌶','art-food','Chennai','Marina Beach Expo','2026-10-05','12:00 PM',15,14,'A5,C5,E7,F4,H9,I14,J7,J10,L2,M3',200,'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'VIP + Chef\'s Table',1499,1,2 FROM events WHERE event_key='ev9';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Day entry',199,3,15 FROM events WHERE event_key='ev9';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev10','Rock the Stage — Battle of Bands','music','🎸','art-music','Mumbai','Phoenix Arena','2026-10-25','7:00 PM',8,7,'A2,A3,A4,A5,A6,A7,B1,B2,B3,B4,B5,B7,C2,C3,C4,C5,C6,C7,D1,D2,D3,D4,D5,D6,E2,E3,E4,E5,E6,E7,F1,F2,F3,F4,F6,F7,G2,G3,G4,G5,G6,G7,H1,H3,H4,H5,H6',9,'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'VIP Lounge',2499,1,2 FROM events WHERE event_key='ev10';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Standing',649,3,8 FROM events WHERE event_key='ev10';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev11','Startup Pitch Night','tech','🚀','art-tech','Hyderabad','THub Auditorium','2026-10-14','6:00 PM',10,8,'',80,'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Investor pass',2999,1,2 FROM events WHERE event_key='ev11';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Attendee pass',499,3,10 FROM events WHERE event_key='ev11';
INSERT INTO events (event_key,name,category,icon,art_class,city,venue,event_date,event_time,seat_rows,seats_per_row,sold_seats,seats_left,image_url) VALUES ('ev12','Laugh Out Loud Comedy Special','comedy','😂','art-comedy','Bengaluru','Comedy Factory','2026-10-20','8:30 PM',6,6,'D3,E2,F3',33,'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=700&q=80');
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Premium seat',999,1,2 FROM events WHERE event_key='ev12';
INSERT INTO ticket_types (event_id,label,price,row_from,row_to) SELECT id,'Regular seat',499,3,6 FROM events WHERE event_key='ev12';

-- ---------- Demo account (password: eventhub123) ----------

INSERT INTO users (name,email,password_hash) VALUES ('Demo User','demo@eventhub.test','$2y$10$OE6W302hzKtWIL0twSqh4eP5w86LMCw/rCEk6EC0cw6/34kotN8ce');

-- ---------- Admin dashboard account (password: Admin@2026) ----------

INSERT INTO admins (email,password_hash,display_name) VALUES ('admin@eventhub.test','$2y$10$1X1rkpmEY2IpyecWpAhafO5cmBQ/iJqFF0LpKXR3cwbNeWyroK8KS','EventHub Admin');

-- ---------- Existing bookings for the demo account ----------

INSERT INTO bookings (booking_code,event_id,ticket_type_id,user_id,customer_name,customer_email,seats,quantity,unit_price,total_amount) SELECT 'EH-DEMO-7K3M',(SELECT id FROM events WHERE event_key='ev1'),(SELECT t.id FROM ticket_types t JOIN events ev ON ev.id=t.event_id WHERE ev.event_key='ev1' AND t.label='Front row'),(SELECT id FROM users WHERE email='demo@eventhub.test'),'Demo User','demo@eventhub.test','A5,B3',2,1899,3798;
INSERT INTO bookings (booking_code,event_id,ticket_type_id,user_id,customer_name,customer_email,seats,quantity,unit_price,total_amount) SELECT 'EH-DEMO-4T9B',(SELECT id FROM events WHERE event_key='ev5'),(SELECT t.id FROM ticket_types t JOIN events ev ON ev.id=t.event_id WHERE ev.event_key='ev5' AND t.label='Courtside'),(SELECT id FROM users WHERE email='demo@eventhub.test'),'Demo User','demo@eventhub.test','A1,A2',2,1299,2598;

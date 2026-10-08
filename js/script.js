/* =========================================================
   EventHub front-end logic — Live search + rich card render
   ========================================================= */

(function () {
  "use strict";

  // ---------- Event data (expanded) ----------
  let EVENTS = [];

  // ---------- Unsplash image map per event ----------
  const EVENT_IMAGES = {
    ev1:  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=700&q=80",  // concert
    ev2:  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=700&q=80",  // tech conference
    ev3:  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&q=80",  // food
    ev4:  "https://images.unsplash.com/photo-1531913764164-f85c52e6e654?w=700&q=80",  // art gallery
    ev5:  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=700&q=80",  // sports
    ev6:  "https://images.unsplash.com/photo-1585974738771-84483dd9f89f?w=700&q=80",  // comedy stage
    ev7:  "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=700&q=80",  // synth/music
    ev8:  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=700&q=80",  // AI/design
    ev9:  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=700&q=80",     // spice food
    ev10: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=700&q=80",  // rock concert
    ev11: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=700&q=80",  // startup pitch
    ev12: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=700&q=80",  // comedy show
  };

  const CATEGORY_LABEL = {
    music: "Music", tech: "Tech", food: "Food & drink",
    art: "Art & culture", sports: "Sports", comedy: "Comedy",
  };

  // ---------- State ----------
  let activeCategory = "all";
  let activeSearch   = "";
  let activeCity     = "";
  let activeDate     = "";
  let currentEvent   = null;
  let debounceTimer  = null;

  // ---------- Helpers ----------
  const formatDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };
  const formatPrice = (n) => "₹" + n.toLocaleString("en-IN");

  function matchesFilters(ev) {
    const inCategory = activeCategory === "all" || ev.category === activeCategory;
    const inCity     = !activeCity || ev.city === activeCity;
    const q          = activeSearch.trim().toLowerCase();
    const inSearch   = !q ||
      ev.name.toLowerCase().includes(q)   ||
      ev.venue.toLowerCase().includes(q)  ||
      ev.city.toLowerCase().includes(q)   ||
      CATEGORY_LABEL[ev.category].toLowerCase().includes(q);
    const inDate     = !activeDate || ev.date === activeDate;
    return inCategory && inCity && inSearch && inDate;
  }

  function renderEvents() {
    const grid    = document.getElementById("eventGrid");
    const empty   = document.getElementById("emptyState");
    const countEl = document.getElementById("resultCount");
    const filtered = EVENTS.filter(matchesFilters);

    grid.innerHTML = "";

    if (filtered.length === 0) {
      empty.classList.remove("d-none");
    } else {
      empty.classList.add("d-none");
    }

    countEl.textContent = filtered.length
      ? `${filtered.length} event${filtered.length > 1 ? "s" : ""} found`
      : "";

    filtered.forEach((ev, idx) => {
      const lowestPrice = Math.min(...ev.types.map((t) => t.price));
      const imgUrl = ev.image || EVENT_IMAGES[ev.id] || "";
      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4";
      col.style.animation = "slide-up 0.5s ease both";
      col.style.animationDelay = `${idx * 0.06}s`;

      col.innerHTML = `
        <article class="ticket ${ev.art}">
          ${imgUrl ? `<img class="ticket-bg-img" src="${imgUrl}" alt="${ev.name}" loading="lazy" onerror="this.style.display='none'">` : ""}
          <div class="ticket-overlay"></div>
          <div class="ticket-content">
            <div class="ticket-top">
              <span class="cat-tag">${CATEGORY_LABEL[ev.category]}</span>
              <span class="art-icon">${ev.icon}</span>
            </div>
            ${ev.seatsLeft <= 10 ? `<div class="seats-badge">🔥 Only ${ev.seatsLeft} left!</div>` : ""}
            <div class="ticket-bottom">
              <h3>${ev.name}</h3>
              <div class="ticket-meta">
                <span>📅 ${formatDate(ev.date)} · ${ev.time}</span>
                <span>📍 ${ev.venue}, ${ev.city}</span>
              </div>
              <div class="ticket-footer-row">
                <div class="ticket-price-block">
                  <span class="ticket-price-label">From</span>
                  <span class="ticket-price-value">${formatPrice(lowestPrice)}</span>
                </div>
                <button class="btn-book-card" data-book="${ev.id}" data-tooltip="Pick seats & confirm">
                  🎟 Book
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
      grid.appendChild(col);
    });
  }

  // ---------- Live search (debounced) ----------
  function triggerLiveSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      activeSearch = document.getElementById("searchInput").value;
      activeCity   = document.getElementById("cityInput").value;
      activeDate   = document.getElementById("dateInput").value;
      loadEvents();
    }, 250);
  }

  document.getElementById("searchInput").addEventListener("input",  triggerLiveSearch);
  document.getElementById("cityInput").addEventListener("change",   triggerLiveSearch);
  document.getElementById("dateInput").addEventListener("change",   triggerLiveSearch);

  // ---------- Search form submit (scroll to results) ----------
  document.getElementById("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    activeSearch = document.getElementById("searchInput").value;
    activeCity   = document.getElementById("cityInput").value;
    activeDate   = document.getElementById("dateInput").value;
    loadEvents();
    document.getElementById("browse").scrollIntoView({ behavior: "smooth" });
  });

  // ---------- Category chips ----------
  document.getElementById("categoryChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeCategory = chip.dataset.cat;
    loadEvents();
  });

  // ---------- Reset filters ----------
  document.getElementById("resetFilters").addEventListener("click", () => {
    activeCategory = "all";
    activeSearch   = "";
    activeCity     = "";
    activeDate     = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("cityInput").value   = "";
    document.getElementById("dateInput").value   = "";
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    document.querySelector('.chip[data-cat="all"]').classList.add("active");
    loadEvents();
  });

  // ---------- Account state and authentication ----------
  let currentUser = null;
  const authModalEl = document.getElementById("authModal");
  const authModal = new bootstrap.Modal(authModalEl);

  function setAuthMode(mode) {
    document.getElementById("authTitle").textContent = mode === "signup" ? "Create your account" : "Welcome back";
    document.getElementById("authSubmit").textContent = mode === "signup" ? "Create account" : "Sign in";
    document.getElementById("authNameField").classList.toggle("d-none", mode !== "signup");
    document.getElementById("authSwitchText").textContent = mode === "signup" ? "Already have an account?" : "New to EventHub?";
    document.getElementById("authSwitch").textContent = mode === "signup" ? "Sign in" : "Create account";
    document.getElementById("authMode").value = mode;
    document.getElementById("authError").textContent = "";
  }

  function openAuthModal(mode = "signin") {
    setAuthMode(mode);
    authModal.show();
  }

  function updateAccountUI() {
    const signIn = document.getElementById("signInButton");
    const account = document.getElementById("accountButton");
    const signOut = document.getElementById("signOutButton");
    const myBookings = document.getElementById("myBookingsButton");
    signIn.classList.toggle("d-none", !!currentUser);
    account.classList.toggle("d-none", !currentUser);
    signOut.classList.toggle("d-none", !currentUser);
    // My bookings is its own navbar item so it is always one click away.
    myBookings.classList.toggle("d-none", !currentUser);
    if (currentUser) {
      account.textContent = `👤 ${currentUser.name.split(" ")[0]}`;
      myBookings.textContent = "🎫 My bookings";
    }
  }

  async function checkSession() {
    try {
      const res = await fetch("api/auth.php?action=me");
      const data = await res.json();
      currentUser = data.success ? data.user : null;
    } catch (_) { currentUser = null; }
    updateAccountUI();
  }

  document.getElementById("signInButton").addEventListener("click", () => openAuthModal("signin"));

  // "List an event" now opens a real enquiry form that reaches the admin team,
  // instead of the old placeholder toast.
  const listEventModalEl = document.getElementById("listEventModal");
  const listEventModal = new bootstrap.Modal(listEventModalEl);
  document.getElementById("listEventButton").addEventListener("click", () => {
    document.getElementById("listEventError").textContent = "";
    // Pre-fill contact details for anyone already signed in.
    if (currentUser) {
      document.getElementById("leName").value = currentUser.name || "";
      document.getElementById("leEmail").value = currentUser.email || "";
    }
    listEventModal.show();
  });

  document.getElementById("listEventForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("listEventSubmit");
    const errEl = document.getElementById("listEventError");
    errEl.textContent = "";
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    // Drop blanks so the API applies its own defaults.
    Object.keys(payload).forEach(k => { payload[k] = String(payload[k] ?? "").trim(); });

    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const res = await fetch("api/enquiries.php", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not send your enquiry.");
      e.target.reset();
      listEventModal.hide();
      showToast(`📬 ${data.message}`);
    } catch (ex) {
      errEl.textContent = ex.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Send to the EventHub team";
    }
  });
  document.getElementById("authSwitch").addEventListener("click", () => {
    setAuthMode(document.getElementById("authMode").value === "signup" ? "signin" : "signup");
  });
  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = document.getElementById("authMode").value;
    const payload = {
      action: mode,
      name: document.getElementById("authName").value.trim(),
      email: document.getElementById("authEmail").value.trim(),
      password: document.getElementById("authPassword").value
    };
    const submit = document.getElementById("authSubmit");
    submit.disabled = true;
    document.getElementById("authError").textContent = "";
    try {
      const res = await fetch("api/auth.php", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Authentication failed");
      currentUser = data.user;
      updateAccountUI();
      authModal.hide();
      e.target.reset();
      showToast(mode === "signup" ? "Welcome to EventHub! Your account is ready." : `Welcome back, ${currentUser.name}!`);
    } catch (err) {
      document.getElementById("authError").textContent = err.message;
    } finally { submit.disabled = false; }
  });

  document.getElementById("signOutButton").addEventListener("click", async () => {
    try {
      await fetch("api/auth.php?action=logout", { method: "POST" });
      currentUser = null;
      updateAccountUI();
      showToast("You have signed out.");
    } catch (_) { showToast("Could not sign out. Please try again."); }
  });

    // Shared by both the "My bookings" navbar button and the account button.
  // Renders a deterministic fallback immediately, then paints the QR canvas on
  // top so the slot is never left blank (the canvas paints asynchronously).
  function renderBookingQr(container, code) {
    container.innerHTML = "";
    // Payload carries everything a door scanner would need.
    const payload = [
      "EVENTHUB",
      code,
      (document.getElementById("ticketSeats").textContent || "").replace(/\\s+/g, ""),
    ].join("|");

    // Fallback is painted immediately so the slot is never left blank while
    // the asynchronous QR canvas finishes rendering. The canvas paints on
    // top, so the fallback is only visible for a frame or never if the
    // library is present.
    container.innerHTML = `<div class="booking-qr"><div class="qr-fallback">${escapeHtml(code)}</div></div>`;

    if (typeof QRCode === "undefined") return;
    try {
      new QRCode(container, {
        text: payload,
        width: 132,
        height: 132,
        colorDark: "#0f0c14",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (_) {
      container.innerHTML = `<div class="booking-qr"><div class="qr-fallback">${escapeHtml(code)}</div></div>`;
    }
  }

  async function openMyBookings() {
    if (!currentUser) { openAuthModal("signin"); return; }
    try {
      const res = await fetch("api/my-bookings.php");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not load bookings");
      const list = document.getElementById("myBookingsList");
      list.innerHTML = data.bookings.length ? data.bookings.map(b => {
        const seats = (b.seat_list && b.seat_list.length)
          ? b.seat_list.join(", ")
          : `${b.ticket_label} × ${Number(b.quantity)}`;
        return `
        <div class="booking-row">
          <div class="booking-row-top">
            <span class="fw-bold">${escapeHtml(b.event_name)}</span>
            <span class="booking-status status-${escapeHtml(b.status)}">${escapeHtml(b.status)}</span>
          </div>
          <div class="small text-muted">${escapeHtml(b.event_date)} · ${escapeHtml(b.event_time)} · ${escapeHtml(b.venue)}, ${escapeHtml(b.city)}</div>
          <div class="booking-code-line">
            <span class="small text-muted">Seats</span>
            <strong>${escapeHtml(seats)}</strong>
          </div>
          <div class="booking-code-line">
            <span class="small text-muted">Code</span>
            <strong class="booking-code">${escapeHtml(b.booking_code)}</strong>
            <span class="small text-muted ms-auto">${formatPrice(Number(b.total_amount))}</span>
          </div>
          <div class="booking-qr-line">
            <span class="small text-muted">Scan</span>
            <div id="bookingQr-${b.booking_code.replace(/[^A-Za-z0-9]/g, '-')}" class="booking-qr-slot" data-code="${escapeHtml(b.booking_code)}"></div>
          </div>
        </div>`;
      }).join("") : '<p class="text-muted">You have no bookings yet. Browse events to book your first ticket.</p>';

      // Paint a real QR into each booking card (the canvas paints async, so
      // the fallback keeps the slot occupied until it lands on top).
      document.querySelectorAll(".booking-qr-slot").forEach(el => {
        const code = el.dataset.code || el.id.replace('bookingQr-', '');
        renderBookingQr(el, code);
      });

      new bootstrap.Modal(document.getElementById("myBookingsModal")).show();
    } catch (err) { showToast(err.message); }
  }

  document.getElementById("myBookingsButton").addEventListener("click", openMyBookings);
  document.getElementById("accountButton").addEventListener("click", openMyBookings);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }

  // ---------- Booking modal: seat map ----------
  const bookingModalEl = document.getElementById("bookingModal");
  const bookingModal   = new bootstrap.Modal(bookingModalEl);
  const ticketModalEl  = document.getElementById("ticketModal");
  const ticketModal    = new bootstrap.Modal(ticketModalEl);

  const MAX_SEATS = 10;
  let selectedSeats = [];   // seat labels chosen for the open event
  let seatSoldSet   = new Set();

  document.getElementById("eventGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book]");
    if (!btn) return;
    const ev = EVENTS.find((x) => x.id === btn.dataset.book);
    if (!ev) return;
    openBookingModal(ev);
  });

  // Row letters: A..Z, AA.. for tall halls.
  function rowLetter(n) {
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function zoneForSeat(ev, row) {
    return (ev.zones || []).find(z => row >= z.rowFrom && row <= z.rowTo) || (ev.zones || [])[0];
  }

  function openBookingModal(ev) {
    currentEvent = ev;
    selectedSeats = [];
    seatSoldSet = new Set(ev.soldSeats || []);

    document.getElementById("modalEventName").textContent = ev.name;
    document.getElementById("modalEventMeta").textContent =
      `${formatDate(ev.date)} · ${ev.time} · ${ev.venue}, ${ev.city}`;

    renderLegend(ev);
    renderSeatMap(ev);
    updateSelection();
    bookingModal.show();
  }

  function renderLegend(ev) {
    const legend = document.getElementById("seatLegend");
    legend.innerHTML = "";
    (ev.zones || []).forEach((z, i) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<i class="legend-swatch zone-${i}"></i>${escapeHtml(z.label)} <b>${formatPrice(z.price)}</b>`;
      legend.appendChild(item);
    });
    const taken = document.createElement("span");
    taken.className = "legend-item";
    taken.innerHTML = `<i class="legend-swatch legend-sold"></i>Taken`;
    legend.appendChild(taken);
  }

  function renderSeatMap(ev) {
    const map = document.getElementById("seatMap");
    map.innerHTML = "";

    const rows  = Number(ev.rows) || 1;
    const perRow = Number(ev.seatsPerRow) || 1;

    for (let r = 1; r <= rows; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "seat-row";

      const label = document.createElement("span");
      label.className = "seat-row-label";
      label.textContent = rowLetter(r);
      rowEl.appendChild(label);

      const zone = zoneForSeat(ev, r);
      const zoneIdx = (ev.zones || []).indexOf(zone);

      for (let c = 1; c <= perRow; c++) {
        const name = `${rowLetter(r)}${c}`;
        const seat = document.createElement("button");
        seat.type = "button";
        seat.className = `seat zone-${zoneIdx}`;
        seat.dataset.seat = name;
        seat.dataset.row = String(r);
        seat.textContent = c;
        seat.setAttribute("aria-label", `Seat ${name}, ${zone ? zone.label : ""}`);

        if (seatSoldSet.has(name)) {
          seat.classList.add("is-sold");
          seat.disabled = true;
          seat.title = `${name} — taken`;
        } else {
          seat.title = `${name} — ${zone ? zone.label : ""} ${zone ? formatPrice(zone.price) : ""}`;
        }
        rowEl.appendChild(seat);
      }
      map.appendChild(rowEl);
    }

    map.querySelectorAll(".seat:not(.is-sold)").forEach(btn => {
      btn.addEventListener("click", () => toggleSeat(btn));
    });
  }

  function toggleSeat(btn) {
    const name = btn.dataset.seat;
    const idx = selectedSeats.indexOf(name);
    if (idx >= 0) {
      selectedSeats.splice(idx, 1);
      btn.classList.remove("is-selected");
    } else {
      if (selectedSeats.length >= MAX_SEATS) {
        showToast(`You can book up to ${MAX_SEATS} seats at once.`);
        return;
      }
      selectedSeats.push(name);
      btn.classList.add("is-selected");
    }
    // Keep display order left-to-right / front-to-back regardless of tap order.
    selectedSeats.sort((a, b) => {
      const ra = seatRowOf(a), rb = seatRowOf(b);
      return ra - rb || seatNumOf(a) - seatNumOf(b);
    });
    updateSelection();
  }

  function seatRowOf(label) {
    const m = /^([A-Z]+)/.exec(label);
    if (!m) return 0;
    let n = 0;
    for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  }
  function seatNumOf(label) {
    return parseInt(label.replace(/^[A-Z]+/, ""), 10) || 0;
  }

  function updateSelection() {
    const ev = currentEvent;
    if (!ev) return;

    let total = 0;
    selectedSeats.forEach(name => {
      const zone = zoneForSeat(ev, seatRowOf(name));
      total += zone ? zone.price : 0;
    });

    document.getElementById("selectedSeatList").textContent =
      selectedSeats.length ? selectedSeats.join(", ") : "None yet";
    document.getElementById("modalTotal").textContent = formatPrice(total);

    const hint = document.getElementById("seatHint");
    if (!selectedSeats.length) {
      hint.textContent = "Tap seats to choose where you sit. Up to 10 per booking.";
      hint.classList.remove("is-active");
    } else {
      hint.textContent = `${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""} selected · ${selectedSeats.join(", ")}`;
      hint.classList.add("is-active");
    }

    document.getElementById("confirmBooking").disabled = selectedSeats.length === 0;
  }

  document.getElementById("confirmBooking").addEventListener("click", async () => {
    if (!currentEvent) return;
    if (!selectedSeats.length) return;

    if (!currentUser) {
      bookingModal.hide();
      openAuthModal("signin");
      showToast("Please sign in before booking tickets.");
      return;
    }

    const button = document.getElementById("confirmBooking");
    button.disabled = true;
    const seatsChosen = [...selectedSeats];
    try {
      const response = await fetch("api/bookings.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: currentEvent.id,
          seats: seatsChosen
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Booking failed");

      // Close the booking modal first, then build the ticket stub and show it.
      bookingModal.hide();
      // The QR is async; the fallback is painted in renderTicketQr before the
      // modal opens, so the area is never empty.
      showTicket(currentEvent, result.booking, seatsChosen);
      await loadEvents();
    } catch (error) {
      showToast(`⚠️ ${error.message || "Booking failed. Please try again."}`);
      // Seats may have changed under us — refresh the map so stale picks clear.
      if (currentEvent) {
        const fresh = EVENTS.find(x => x.id === currentEvent.id);
        if (fresh) {
          currentEvent = fresh;
          seatSoldSet = new Set(fresh.soldSeats || []);
          selectedSeats = selectedSeats.filter(s => !seatSoldSet.has(s));
          renderSeatMap(fresh);
          selectedSeats.forEach(s => {
            const el = freshSeatEl(s);
            if (el) el.classList.add("is-selected");
          });
          updateSelection();
        }
      }
    } finally {
      button.disabled = selectedSeats.length === 0;
    }
  });

  function freshSeatEl(name) {
    return document.querySelector(`#seatMap .seat[data-seat="${name}"]`);
  }

  // ---------- Ticket stub ----------
  function showTicket(ev, booking, seats) {
    document.getElementById("ticketEvent").textContent = booking.event || ev.name;
    document.getElementById("ticketMeta").textContent =
      `${formatDate(ev.date)} · ${ev.time} · ${ev.venue}, ${ev.city}`;
    document.getElementById("ticketSeats").textContent = (booking.seats || seats).join(", ");
    document.getElementById("ticketQty").textContent = String(booking.quantity || seats.length);
    document.getElementById("ticketTotal").textContent = formatPrice(booking.total || 0);
    document.getElementById("ticketGuest").textContent = currentUser ? currentUser.name : "Guest";
    document.getElementById("ticketCode").textContent = booking.booking_code;

    // Build the ticket stub first, then show it. The QR canvas paints
    // asynchronously, so the deterministic fallback above keeps the slot
    // occupied until the canvas lands on top.
    renderTicketQr(booking.booking_code, ev);
    ticketModal.show();
  }

  function renderTicketQr(code, ev) {
    const host = document.getElementById("ticketQr");
    host.innerHTML = "";
    // Payload carries everything a door scanner would need.
    const payload = [
      "EVENTHUB",
      code,
      ev.id,
      (document.getElementById("ticketSeats").textContent || "").replace(/\\s+/g, ""),
    ].join("|");

    // Fallback is painted immediately so the slot is never left blank while
    // the asynchronous QR canvas finishes rendering. The canvas paints on
    // top, so the fallback is only visible for a frame or never if the
    // library is present.
    host.innerHTML = `<div class="qr-fallback">${escapeHtml(code)}</div>`;

    if (typeof QRCode === "undefined") return;
    try {
      new QRCode(host, {
        text: payload,
        width: 132,
        height: 132,
        colorDark: "#0f0c14",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (_) {
      host.innerHTML = `<div class="qr-fallback">${escapeHtml(code)}</div>`;
    }
  }

  document.getElementById("ticketViewBookings").addEventListener("click", () => {
    ticketModal.hide();
    setTimeout(() => document.getElementById("accountButton").click(), 350);
  });

  // ---------- Toast ----------
  function showToast(message) {
    document.getElementById("toastBody").textContent = message;
    const toastEl = document.getElementById("bookingToast");
    const toast   = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 5500 });
    toast.show();
  }

  // ---------- Newsletter ----------
  document.getElementById("newsletterForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = e.target.querySelector("input[type=email]");
    try {
      const response = await fetch("api/newsletter.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.value.trim() })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Subscription failed");
      e.target.reset();
      showToast(`📧 ${result.message}`);
    } catch (error) {
      showToast(`⚠️ ${error.message || "Subscription failed. Please try again."}`);
    }
  });

  // ---------- Active nav link on scroll ----------
  const sections = ["top", "browse", "how", "reviews"].map((id) => document.getElementById(id));
  const navLinks = document.querySelectorAll(".nav-links a");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${id}`));
        }
      });
    },
    { rootMargin: "-40% 0px -50% 0px" }
  );
  sections.forEach((s) => s && observer.observe(s));

  // ---------- Navbar scroll effect ----------
  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar-box");
    if (window.scrollY > 60) {
      navbar.style.background = "rgba(253,248,239,0.97)";
      navbar.style.boxShadow  = "0 4px 28px rgba(15,12,20,0.12)";
    } else {
      navbar.style.background = "";
      navbar.style.boxShadow  = "";
    }
  });


  // ---------- Hero Slideshow ----------
  (function() {
    const slides = document.querySelectorAll(".hero-slide");
    const dots   = document.querySelectorAll(".hero-dot");
    let current  = 0;
    let timer    = null;

    function goTo(n) {
      slides[current].classList.remove("active");
      dots[current].classList.remove("active");
      current = (n + slides.length) % slides.length;
      slides[current].classList.add("active");
      dots[current].classList.add("active");
    }

    function next() { goTo(current + 1); }

    function startAuto() {
      clearInterval(timer);
      timer = setInterval(next, 4500);
    }

    // Dot click
    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        goTo(parseInt(dot.dataset.slide));
        startAuto();
      });
    });

    startAuto();
  })();

  // ---------- Load events from PHP/MySQL ----------
  async function loadEvents() {
    const params = new URLSearchParams();
    if (activeSearch.trim()) params.set("q", activeSearch.trim());
    if (activeCity) params.set("city", activeCity);
    if (activeDate) params.set("date", activeDate);
    if (activeCategory && activeCategory !== "all") params.set("category", activeCategory);
    try {
      const response = await fetch("api/events.php?" + params.toString());
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not load events");
      EVENTS = result.events;
      renderEvents();
    } catch (error) {
      document.getElementById("eventGrid").innerHTML =
        '<div class="col-12"><div class="alert alert-warning">Could not connect to the PHP backend. Please run this project through XAMPP at http://localhost/event-booking/.</div></div>';
      document.getElementById("resultCount").textContent = "";
    }
  }

  // ---------- Init ----------
  checkSession();
  loadEvents();
})();

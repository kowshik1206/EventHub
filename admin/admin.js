/* =========================================================
   EventHub admin console — login, overview, enquiries
   ========================================================= */
(function () {
  "use strict";

  const API = "../api/admin.php";
  const state = { admin: null, enquiries: [], filter: "all", activeEnquiry: null };

  const $ = (id) => document.getElementById(id);
  const fmtMoney = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function toast(message) {
    $("adminToastBody").textContent = message;
    bootstrap.Toast.getOrCreateInstance($("adminToast"), { delay: 4500 }).show();
  }

  async function call(action, opts = {}) {
    const res = await fetch(API + (action ? `?action=${action}` : ""), {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* non-JSON error body */ }
    if (res.status === 401) {
      showLogin();
      throw new Error((data && data.message) || "Session expired. Please sign in again.");
    }
    if (!res.ok || !data || !data.success) {
      throw new Error((data && data.message) || "Request failed.");
    }
    return data;
  }

  // ---------- Views ----------
  function showLogin() {
    state.admin = null;
    $("loginView").classList.remove("d-none");
    $("dashView").classList.add("d-none");
  }

  function showDash(admin) {
    state.admin = admin;
    $("loginView").classList.add("d-none");
    $("dashView").classList.remove("d-none");
    $("adminWho").textContent = admin.name || admin.email;
    loadOverview();
  }

  // ---------- Login ----------
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("loginBtn");
    const err = $("loginError");
    err.textContent = "";
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const data = await call("login", {
        method: "POST",
        body: JSON.stringify({
          email: $("adminEmail").value.trim(),
          password: $("adminPassword").value,
        }),
      });
      showDash(data.admin);
      $("adminPassword").value = "";
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });

  $("adminSignOut").addEventListener("click", async () => {
    try { await call("logout", { method: "POST" }); } catch (_) { /* already gone */ }
    showLogin();
    toast("Signed out.");
  });

  // ---------- Tabs ----------
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const view = tab.dataset.view;
      document.querySelectorAll(".admin-panel").forEach(p => p.classList.add("d-none"));
      $("panel-" + view).classList.remove("d-none");
      if (view === "enquiries") loadEnquiries();
      if (view === "bookings") loadBookings();
      if (view === "customers") loadCustomers();
    });
  });

  // ---------- Overview ----------
  async function loadOverview() {
    try {
      const data = await call("stats");
      const s = data.stats;

      const cards = [
        { label: "Revenue", value: fmtMoney(s.revenue), tone: "gold" },
        { label: "Bookings", value: fmtNum(s.bookings), tone: "maroon" },
        { label: "Events live", value: fmtNum(s.events), tone: "ink" },
        { label: "Customers", value: fmtNum(s.customers), tone: "ink" },
        { label: "New enquiries", value: fmtNum(s.newEnquiries), tone: "maroon" },
        { label: "Subscribers", value: fmtNum(s.subscribers), tone: "gold" },
      ];

      $("statGrid").innerHTML = cards.map(c => `
        <div class="stat-card tone-${c.tone}">
          <div class="stat-card-value">${c.value}</div>
          <div class="stat-card-label">${escapeHtml(c.label)}</div>
        </div>`).join("");

      $("topEvents").innerHTML = data.top.length ? data.top.map(t => {
        const max = Number(data.top[0].seats_sold) || 1;
        const pct = Math.round((Number(t.seats_sold) / max) * 100);
        return `
        <div class="bar-row">
          <div class="bar-label">
            <span>${escapeHtml(t.name)}</span>
            <strong>${fmtNum(t.seats_sold)} seats · ${fmtMoney(t.revenue)}</strong>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join("") : emptyNote("No bookings yet.");

      $("recentBookings").innerHTML = data.recent.length ? data.recent.map(b => `
        <div class="feed-row">
          <div>
            <strong>${escapeHtml(b.event_name)}</strong>
            <div class="feed-sub">${escapeHtml(b.customer_name)} · ${escapeHtml(b.seats)}</div>
          </div>
          <div class="feed-right">
            <span class="feed-code">${escapeHtml(b.booking_code)}</span>
            <span class="feed-amt">${fmtMoney(b.total_amount)}</span>
          </div>
        </div>`).join("") : emptyNote("No bookings yet.");

      if (data.stats.newEnquiries > 0) {
        $("enquiryBadge").textContent = data.stats.newEnquiries;
        $("enquiryBadge").classList.add("on");
      } else {
        $("enquiryBadge").textContent = "";
        $("enquiryBadge").classList.remove("on");
      }
    } catch (ex) {
      toast(ex.message);
    }
  }

  $("refreshStats").addEventListener("click", loadOverview);

  function emptyNote(text) {
    return `<p class="empty-note">${escapeHtml(text)}</p>`;
  }

  // ---------- Enquiries ----------
  document.querySelectorAll(".admin-filters .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".admin-filters .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.filter = chip.dataset.filter;
      renderEnquiries();
    });
  });

  async function loadEnquiries() {
    try {
      const data = await call("enquiries");
      state.enquiries = data.enquiries;
      renderEnquiries();
    } catch (ex) { toast(ex.message); }
  }

  function renderEnquiries() {
    const rows = state.enquiries.filter(e => state.filter === "all" || e.status === state.filter);
    const host = $("enquiryList");
    if (!rows.length) { host.innerHTML = emptyNote("No enquiries in this view."); return; }

    host.innerHTML = rows.map(e => `
      <div class="enquiry-card" data-id="${e.id}" role="button" tabindex="0">
        <div class="enquiry-top">
          <div>
            <span class="enquiry-event">${escapeHtml(e.event_name)}</span>
            <span class="enquiry-ref">${escapeHtml(e.reference)}</span>
          </div>
          <span class="status-pill status-${escapeHtml(e.status)}">${escapeHtml(e.status)}</span>
        </div>
        <div class="enquiry-sub">
          ${escapeHtml(e.name)} · ${escapeHtml(e.email)}${e.phone ? " · " + escapeHtml(e.phone) : ""}
        </div>
        <div class="enquiry-sub">
          ${escapeHtml(e.city)}${e.venue ? " · " + escapeHtml(e.venue) : ""}
          ${e.event_date ? " · " + escapeHtml(e.event_date) : ""}
          ${Number(e.expected_seats) ? " · ~" + fmtNum(e.expected_seats) + " expected" : ""}
        </div>
        ${e.message ? `<p class="enquiry-snippet">${escapeHtml(e.message)}</p>` : ""}
        <div class="enquiry-foot">${escapeHtml(e.created_at)}</div>
      </div>`).join("");

    host.querySelectorAll(".enquiry-card").forEach(card => {
      const open = () => openEnquiry(Number(card.dataset.id));
      card.addEventListener("click", open);
      card.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } });
    });
  }

  const enquiryModal = () => bootstrap.Modal.getOrCreateInstance($("enquiryModal"));

  function openEnquiry(id) {
    const e = state.enquiries.find(x => Number(x.id) === id);
    if (!e) return;
    state.activeEnquiry = e;
    $("enqTitle").textContent = e.event_name;
    $("enqMeta").innerHTML = `
      <div class="enq-field"><span>Reference</span><strong>${escapeHtml(e.reference)}</strong></div>
      <div class="enq-field"><span>From</span><strong>${escapeHtml(e.name)} · ${escapeHtml(e.email)}</strong></div>
      ${e.phone ? `<div class="enq-field"><span>Phone</span><strong>${escapeHtml(e.phone)}</strong></div>` : ""}
      <div class="enq-field"><span>Where</span><strong>${escapeHtml(e.city)}${e.venue ? " · " + escapeHtml(e.venue) : ""}</strong></div>
      ${e.event_date ? `<div class="enq-field"><span>When</span><strong>${escapeHtml(e.event_date)}</strong></div>` : ""}
      ${Number(e.expected_seats) ? `<div class="enq-field"><span>Expected</span><strong>${fmtNum(e.expected_seats)} people</strong></div>` : ""}
      <div class="enq-field"><span>Category</span><strong>${escapeHtml(e.category)}</strong></div>
      <div class="enq-field"><span>Received</span><strong>${escapeHtml(e.created_at)}</strong></div>`;
    $("enqMessage").innerHTML = e.message
      ? `<div class="enq-message-label">Message</div>${escapeHtml(e.message)}`
      : `<div class="enq-message-label">Message</div><em>No message provided.</em>`;
    $("enqStatus").value = e.status;
    $("enqNote").value = e.admin_note || "";
    enquiryModal().show();
  }

  $("enqSave").addEventListener("click", async () => {
    if (!state.activeEnquiry) return;
    const btn = $("enqSave");
    btn.disabled = true;
    try {
      await call("enquiry-update", {
        method: "POST",
        body: JSON.stringify({
          id: state.activeEnquiry.id,
          status: $("enqStatus").value,
          note: $("enqNote").value.trim(),
        }),
      });
      Object.assign(state.activeEnquiry, {
        status: $("enqStatus").value,
        admin_note: $("enqNote").value.trim(),
      });
      enquiryModal().hide();
      renderEnquiries();
      toast("Enquiry updated.");
    } catch (ex) {
      toast(ex.message);
    } finally { btn.disabled = false; }
  });

  // ---------- Bookings ----------
  let allBookings = [];
  async function loadBookings() {
    try {
      const data = await call("bookings");
      allBookings = data.bookings;
      renderBookings(allBookings);
    } catch (ex) { toast(ex.message); }
  }

  function renderBookings(rows) {
    const body = $("bookingsTable").querySelector("tbody");
    if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="empty-note">No bookings match.</td></tr>`; return; }
    body.innerHTML = rows.map(b => `
      <tr>
        <td><span class="code-cell">${escapeHtml(b.booking_code)}</span></td>
        <td>
          <strong>${escapeHtml(b.event_name)}</strong>
          <div class="cell-sub">${escapeHtml(b.event_date)} · ${escapeHtml(b.venue)}, ${escapeHtml(b.city)}</div>
        </td>
        <td>${escapeHtml(b.customer_name)}<div class="cell-sub">${escapeHtml(b.customer_email)}</div></td>
        <td>${escapeHtml(b.seats || b.ticket_label)}<div class="cell-sub">${fmtNum(b.quantity)} ticket${Number(b.quantity) > 1 ? "s" : ""}</div></td>
        <td class="cell-money">${fmtMoney(b.total_amount)}</td>
        <td class="cell-sub">${escapeHtml(b.created_at)}</td>
      </tr>`).join("");
  }

  $("bookingSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { renderBookings(allBookings); return; }
    renderBookings(allBookings.filter(b =>
      [b.booking_code, b.event_name, b.customer_name, b.customer_email, b.seats, b.city, b.venue]
        .some(v => String(v || "").toLowerCase().includes(q))
    ));
  });

  // ---------- Customers ----------
  async function loadCustomers() {
    try {
      const data = await call("customers");
      const body = $("customersTable").querySelector("tbody");
      if (!data.customers.length) { body.innerHTML = `<tr><td colspan="5" class="empty-note">No customers yet.</td></tr>`; return; }
      body.innerHTML = data.customers.map(c => `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${escapeHtml(c.email)}</td>
          <td>${fmtNum(c.bookings)}</td>
          <td class="cell-money">${fmtMoney(c.spend)}</td>
          <td class="cell-sub">${escapeHtml(c.created_at)}</td>
        </tr>`).join("");
    } catch (ex) { toast(ex.message); }
  }

  // ---------- Boot: restore session if cookie still valid ----------
  (async function boot() {
    try {
      const data = await call("me");
      if (data.success && data.admin) { showDash(data.admin); return; }
    } catch (_) { /* stay on login */ }
    showLogin();
  })();
})();

(function () {
  const DAY_MS = 86400000;
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  const CATEGORY_ICON = {
    "sightseeing": "🏛️", "food & drink": "🍜", "activity": "🎟️", "nature/hike": "🌿",
    "shopping": "🛍️", "transport": "🚕", "rest/free time": "🌴", "nightlife": "🌙", "wellness": "💆",
  };
  const BOOKING_GROUPS = [
    ["Flight", "✈️", "Flights"], ["Accommodation", "🏨", "Stays"], ["Train/Bus", "🚆", "Trains & buses"],
    ["Car Rental", "🚗", "Car rental"], ["Ferry", "⛴️", "Ferries"], ["Tour/Activity", "🎟️", "Tours & activities"],
    ["Travel Insurance", "🛡️", "Insurance"], ["Other", "📎", "Other"],
  ];

  const state = { data: null, day: null, loading: false, error: null };
  const $view = document.getElementById("view");

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
  const num = (s) => parseFloat(String(s || "").replace(/,/g, ""));

  // Parses "Sat, 17 Oct 2026" or "17 Oct 2026 07:00" without relying on Date's lenient parser (Safari).
  function parseDate(s) {
    const m = String(s || "").match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m || MONTHS[m[2].toLowerCase()] == null) return null;
    return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +(m[4] || 0), +(m[5] || 0));
  }

  function now() {
    const p = new URLSearchParams(location.search).get("today");
    const d = p ? new Date(p) : new Date();
    return isNaN(d) ? new Date() : d;
  }

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fmtDay = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const fmtShort = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  function tripDates() {
    const o = state.data.overview;
    const start = parseDate(o.startDate);
    const end = parseDate(o.endDate);
    const days = o.numDays || (start && end ? Math.round((end - start) / DAY_MS) + 1 : 0);
    return { start, end, days };
  }

  function dateOfDay(n) {
    const { start } = tripDates();
    return start ? new Date(start.getTime() + (n - 1) * DAY_MS) : null;
  }

  function itemDate(item) {
    const d = dateOfDay(item.day);
    if (!d) return null;
    const [h, m] = (item.time || "").split(":").map(Number);
    if (isNaN(h)) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m || 0);
  }

  // Which trip day is "today": 0 = before, days+1 = after.
  function currentDay() {
    const { start, days } = tripDates();
    if (!start) return 0;
    const diff = Math.floor((startOfDay(now()) - start) / DAY_MS) + 1;
    return Math.max(0, Math.min(diff, days + 1));
  }

  const catIcon = (c) => CATEGORY_ICON[(c || "").trim().toLowerCase()] || "📍";
  const statusClass = (s) => "badge badge--" + (s || "none").toLowerCase().replace(/[^a-z]+/g, "-");
  const badge = (s) => (s ? `<span class="${statusClass(s)}">${esc(s)}</span>` : "");
  const mapsBtn = (url, label = "Open in Maps") =>
    safeUrl(url) ? `<a class="btn btn--ghost" href="${esc(url)}" target="_blank" rel="noopener">${pinSvg}${label}</a>` : "";
  const money = (amt, cur) => (amt ? `${esc(cur ? cur + " " : "")}${esc(amt)}` : "");

  const pinSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>`;

  // ---------- views ----------
  function viewOverview() {
    const o = state.data.overview;
    const { start, end, days } = tripDates();
    const cd = currentDay();
    let countdown;
    if (cd === 0 && start) {
      const n = Math.ceil((start - startOfDay(now())) / DAY_MS);
      countdown = `<div class="count"><span class="count__num">${n}</span><span class="count__label">${n === 1 ? "day" : "days"} to go</span></div>`;
    } else if (cd > days) {
      countdown = `<div class="count"><span class="count__label">Welcome home — hope it was lovely ✨</span></div>`;
    } else {
      countdown = `<div class="count"><span class="count__label">Day</span><span class="count__num">${cd}</span><span class="count__label">of ${days}</span></div>`;
    }

    const travellers = o.travellers
      .map((t) => `<span class="avatar" title="${esc(t)}">${esc(t.charAt(0).toUpperCase())}</span><span class="avatar__name">${esc(t)}</span>`)
      .join("");

    const dayChips = Array.from({ length: days }, (_, i) => {
      const n = i + 1;
      const count = state.data.itinerary.filter((x) => x.day === n).length;
      const d = dateOfDay(n);
      return `<a class="daychip ${n === cd ? "is-today" : ""}" href="#itinerary/${n}">
        <span class="daychip__day">Day ${n}</span>
        <span class="daychip__date">${d ? esc(fmtShort(d)) : ""}</span>
        <span class="daychip__count">${count ? count + (count === 1 ? " plan" : " plans") : "free"}</span></a>`;
    }).join("");

    return `
      <section class="hero">
        <p class="eyebrow">${esc(o.destination)}</p>
        <h1 class="hero__title">${esc(o.tripName)}</h1>
        <p class="hero__dates">${start ? esc(fmtDay(start)) : ""}${end ? " → " + esc(fmtDay(end)) : ""}${days ? ` · ${days} days` : ""}</p>
        ${countdown}
        ${travellers ? `<div class="travellers">${travellers}</div>` : ""}
      </section>
      ${nextUpCard()}
      <section class="section">
        <h2 class="section__title">Your days</h2>
        <div class="daystrip">${dayChips}</div>
      </section>
      ${budgetSection()}
    `;
  }

  function nextUpCard() {
    const { days } = tripDates();
    const cd = currentDay();
    if (cd > days) return "";
    const items = state.data.itinerary.filter((i) => itemDate(i));
    if (!items.length) return "";
    const t = now();
    let label = "First up";
    let idx = 0;
    if (cd >= 1) {
      // An item is "now" if it started and its duration hasn't elapsed; otherwise show the next one.
      idx = items.findIndex((i) => {
        const s = itemDate(i);
        const dur = (num(i.duration) || 1) * 3600000;
        return t < new Date(s.getTime() + dur);
      });
      if (idx < 0) return "";
      label = itemDate(items[idx]) <= t ? "Happening now" : "Next up";
    }
    const cur = items[idx];
    const after = items[idx + 1];
    const d = dateOfDay(cur.day);
    return `
      <section class="card nextup">
        <p class="eyebrow eyebrow--accent">${label}</p>
        <div class="nextup__row">
          <div class="nextup__time">${esc(cur.time)}<small>${d ? esc(fmtDay(d)) : ""}</small></div>
          <div class="nextup__body">
            <h3>${catIcon(cur.category)} ${esc(cur.activity)}</h3>
            <p class="muted">${esc(cur.location)}</p>
          </div>
        </div>
        ${cur.description ? `<p class="nextup__desc">${esc(cur.description)}</p>` : ""}
        <div class="actions">${mapsBtn(cur.maps)}<a class="btn btn--text" href="#itinerary/${cur.day}">See Day ${cur.day} →</a></div>
        ${after ? `<p class="nextup__after"><span class="muted">Then</span> ${esc(after.time)} · ${esc(after.activity)}${after.day !== cur.day ? ` <span class="muted">(Day ${after.day})</span>` : ""}</p>` : ""}
      </section>`;
  }

  function budgetSection() {
    const o = state.data.overview;
    if (!o.budget.length) return "";
    const cur = o.currency;
    const cards = o.budget.map((b) => {
      const bal = num(b.balance);
      const balText = isNaN(bal) || bal === 0 ? "All square" : bal > 0 ? `Receives ${cur} ${Math.abs(bal).toFixed(2)}` : `Pays ${cur} ${Math.abs(bal).toFixed(2)}`;
      const per = num(o.budgetPerPerson);
      const spent = num(b.share);
      const pct = per > 0 && !isNaN(spent) ? Math.min(100, (spent / per) * 100) : 0;
      return `
        <div class="card budget">
          <div class="budget__head"><span class="avatar">${esc(b.name.charAt(0))}</span><strong>${esc(b.name)}</strong>
            <span class="pill ${bal > 0 ? "pill--pos" : bal < 0 ? "pill--neg" : ""}">${esc(balText)}</span></div>
          <dl class="stats">
            <div><dt>Paid</dt><dd>${esc(b.paid)}</dd></div>
            <div><dt>Fair share</dt><dd>${esc(b.share)}</dd></div>
            <div><dt>Budget left</dt><dd>${esc(b.left)}</dd></div>
          </dl>
          ${per > 0 ? `<div class="bar" aria-label="${pct.toFixed(0)}% of budget used"><span style="width:${pct}%"></span></div>
          <p class="tiny muted">${pct.toFixed(0)}% of ${esc(cur)} ${esc(o.budgetPerPerson)} budget</p>` : ""}
        </div>`;
    }).join("");
    const total = o.glance["Total trip cost (home cur.)"];
    const confirmed = o.glance["Bookings confirmed"];
    return `
      <section class="section">
        <h2 class="section__title">Budget <span class="muted">${esc(cur)}</span></h2>
        <div class="glance">
          ${total ? `<div><span class="glance__num">${esc(total)}</span><span class="tiny muted">total trip cost</span></div>` : ""}
          ${confirmed ? `<div><span class="glance__num">${esc(confirmed)}</span><span class="tiny muted">bookings confirmed</span></div>` : ""}
        </div>
        <div class="budgets">${cards}</div>
      </section>`;
  }

  function viewItinerary() {
    const { days } = tripDates();
    const totalDays = Math.max(days, ...state.data.itinerary.map((i) => i.day), 1);
    const cd = currentDay();
    if (!state.day) state.day = cd >= 1 && cd <= totalDays ? cd : 1;
    const day = state.day;

    const tabs = Array.from({ length: totalDays }, (_, i) => {
      const n = i + 1;
      const d = dateOfDay(n);
      return `<a class="daytab ${n === day ? "is-active" : ""} ${n === cd ? "is-today" : ""}" href="#itinerary/${n}" role="tab" aria-selected="${n === day}">
        <span>Day ${n}</span><small>${d ? esc(fmtShort(d)) : ""}</small></a>`;
    }).join("");

    const items = state.data.itinerary.filter((i) => i.day === day);
    const d = dateOfDay(day);
    const list = items.length
      ? `<ol class="timeline">${items.map(itemCard).join("")}</ol>`
      : `<div class="empty"><div class="empty__icon">🌴</div><p>Free day — nothing planned yet.</p><p class="tiny muted">Add rows for Day ${day} in the sheet and refresh.</p></div>`;

    return `
      <div class="daytabs" role="tablist">${tabs}</div>
      <header class="dayhead">
        <h1>${d ? esc(d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })) : `Day ${day}`}</h1>
        <p class="muted">${items.length ? `${items.length} ${items.length === 1 ? "plan" : "plans"}` : ""}</p>
      </header>
      ${list}`;
  }

  function itemCard(i) {
    const meta = [
      i.hours && i.hours !== "-" && i.hours !== "NIL" ? `<div><dt>Hours</dt><dd>${esc(i.hours)}</dd></div>` : "",
      i.price && num(i.price) !== 0 ? `<div><dt>Est. price</dt><dd>${money(i.price, i.currency)}</dd></div>` : "",
      i.duration ? `<div><dt>Duration</dt><dd>${esc(i.duration)} hr${num(i.duration) === 1 ? "" : "s"}</dd></div>` : "",
      i.bookingNeeded === "Yes" ? `<div><dt>Booking</dt><dd>Needed</dd></div>` : "",
    ].join("");
    return `
      <li class="tl">
        <div class="tl__time">${esc(i.time) || "—"}</div>
        <details class="card tl__card">
          <summary>
            <div class="tl__top"><span class="chip">${catIcon(i.category)} ${esc(i.category || "Plan")}</span>${badge(i.status)}</div>
            <h3>${esc(i.activity)}</h3>
            ${i.location ? `<p class="muted">${esc(i.location)}</p>` : ""}
          </summary>
          <div class="tl__more">
            ${i.description ? `<p class="prewrap">${esc(i.description)}</p>` : ""}
            ${meta ? `<dl class="stats stats--wrap">${meta}</dl>` : ""}
            ${i.notes ? `<p class="note prewrap">📝 ${esc(i.notes)}</p>` : ""}
            <div class="actions">${mapsBtn(i.maps)}</div>
          </div>
        </details>
      </li>`;
  }

  function viewBookings() {
    const all = state.data.bookings;
    if (!all.length) return `<div class="empty"><div class="empty__icon">🧾</div><p>No bookings yet.</p></div>`;
    const known = BOOKING_GROUPS.map((g) => g[0]);
    const groups = BOOKING_GROUPS.map(([type, icon, label]) => {
      const rows = all
        .filter((b) => (type === "Other" ? !known.slice(0, -1).includes(b.type) : b.type === type))
        .sort((a, b) => (parseDate(a.start) || Infinity) - (parseDate(b.start) || Infinity));
      if (!rows.length) return "";
      return `<section class="section"><h2 class="section__title">${icon} ${label}</h2>${rows.map(bookingCard).join("")}</section>`;
    }).join("");
    return `<header class="dayhead"><h1>Bookings</h1><p class="muted">${all.length} ${all.length === 1 ? "item" : "items"}</p></header>${groups}`;
  }

  function fmtWhen(s) {
    const d = parseDate(s);
    if (!d) return esc(s);
    const hasTime = /\d{1,2}:\d{2}/.test(s) && !/\b00:00\b/.test(s);
    return esc(fmtDay(d) + " " + d.getFullYear() + (hasTime ? " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""));
  }

  function bookingCard(b) {
    const pending = !b.start && !b.cost && !b.status;
    return `
      <article class="card booking ${pending ? "is-pending" : ""}">
        <div class="tl__top"><h3>${esc(b.provider || b.type)}</h3>${pending ? `<span class="badge badge--none">Details pending</span>` : badge(b.status)}</div>
        ${b.details ? `<p class="muted">${esc(b.details)}</p>` : ""}
        ${b.start || b.end ? `<div class="when"><span>${fmtWhen(b.start)}</span>${b.end ? `<span class="when__arrow">→</span><span>${fmtWhen(b.end)}</span>` : ""}</div>` : ""}
        <dl class="stats stats--wrap">
          ${b.confirmation ? `<div><dt>Confirmation</dt><dd><button class="copy" data-copy="${esc(b.confirmation)}">${esc(b.confirmation)} <span aria-hidden="true">⧉</span></button></dd></div>` : ""}
          ${b.cost ? `<div><dt>Cost</dt><dd>${money(b.cost, b.currency)}</dd></div>` : ""}
          ${b.paidBy ? `<div><dt>Paid by</dt><dd>${esc(b.paidBy)}</dd></div>` : ""}
          ${b.cancelBy ? `<div><dt>Cancel by</dt><dd>${esc(b.cancelBy)}</dd></div>` : ""}
        </dl>
        ${b.notes ? `<p class="note prewrap">📝 ${esc(b.notes)}</p>` : ""}
        ${bookingLinks(b.link)}
      </article>`;
  }

  // The Link / Email Ref cell may hold several links (Drive PDFs, websites) plus plain text like an email subject.
  function bookingLinks(cell) {
    const urls = (String(cell || "").match(/https?:\/\/[^\s,]+/g) || []).filter(safeUrl);
    const rest = String(cell || "").replace(/https?:\/\/[^\s,]+/g, "").replace(/^[\s,]+|[\s,]+$/g, "");
    const isPdf = (u) => /drive\.google\.com\/(file|open|uc)|\.pdf([?#]|$)/i.test(u);
    const pdfCount = urls.filter(isPdf).length;
    let n = 0;
    const buttons = urls.map((u) => {
      if (isPdf(u)) {
        n++;
        return `<a class="btn btn--pdf" href="${esc(u)}" target="_blank" rel="noopener">📄 View PDF${pdfCount > 1 ? " " + n : ""}</a>`;
      }
      const label = /docs\.google\.com\/document/i.test(u) ? "📄 Open doc" : "Open link ↗";
      return `<a class="btn btn--ghost" href="${esc(u)}" target="_blank" rel="noopener">${label}</a>`;
    }).join("");
    return (buttons ? `<div class="actions">${buttons}</div>` : "") + (rest ? `<p class="tiny muted ref">Ref: ${esc(rest)}</p>` : "");
  }

  // ---------- theme ----------
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  function themePref() {
    try { const t = localStorage.getItem("theme"); return t === "light" || t === "dark" ? t : "system"; } catch (_) { return "system"; }
  }
  function applyTheme() {
    const pref = themePref();
    const mode = pref === "system" ? (darkQuery.matches ? "dark" : "light") : pref;
    const root = document.documentElement;
    if (pref === "system") delete root.dataset.theme; else root.dataset.theme = pref;
    root.dataset.mode = mode;
    document.querySelector('meta[name="theme-color"]').content = mode === "dark" ? "#0c1626" : "#f1f5fb";
    document.querySelectorAll("[data-theme-choice]").forEach((b) => b.classList.toggle("is-active", b.dataset.themeChoice === pref));
  }
  function setTheme(pref) {
    try { pref === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", pref); } catch (_) {}
    applyTheme();
  }

  function viewSettings() {
    const src = Sheets.getSource();
    const first = !src;
    const trip = state.data && state.data.overview;
    return `
      <header class="dayhead"><h1>${first ? "Welcome 🌊" : "Settings"}</h1></header>
      ${first ? `<p class="lead">Paste the link to your trip's Google Sheet to get started. It's saved only on this device. To plan another trip, just swap the link here.</p>` : ""}
      ${src ? `
        <section class="card current">
          <p class="eyebrow">Current trip</p>
          <h3>${esc(trip ? trip.tripName : "Loading…")}</h3>
          ${trip && trip.destination ? `<p class="muted">${esc(trip.destination)}</p>` : ""}
          <div class="actions"><a class="btn btn--ghost" href="${esc(Sheets.sheetUrl(src))}" target="_blank" rel="noopener">Open sheet ↗</a></div>
        </section>` : ""}
      <form class="card linkform" id="linkform" novalidate>
        <label for="sheet-link" class="eyebrow">${first ? "Google Sheet link" : "Switch to another trip"}</label>
        <input id="sheet-link" name="link" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="https://docs.google.com/spreadsheets/d/…" required />
        <p class="formmsg ${state.formError ? "is-error" : ""}" role="status">${esc(state.formError || "")}</p>
        <button class="btn btn--solid" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Checking sheet…" : first ? "Load my trip" : "Use this sheet"}</button>
      </form>
      <section class="help">
        <h2 class="section__title">How it works</h2>
        <ol>
          <li>In Google Sheets, tap <b>Share</b> → General access → <b>Anyone with the link</b> (Viewer), then copy the link.</li>
          <li>The sheet needs tabs named <b>Overview</b>, <b>Itinerary</b> and <b>Bookings</b>, as in your trip template.</li>
          <li>Edit plans in the sheet anytime and tap ↻ here to refresh.</li>
        </ol>
      </section>
      <section class="card appearance">
        <p class="eyebrow">Appearance</p>
        <div class="segmented" role="group" aria-label="Appearance">
          ${["system", "light", "dark"].map((t) => `<button type="button" data-theme-choice="${t}" class="${themePref() === t ? "is-active" : ""}">${t === "system" ? "Auto" : t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
        </div>
      </section>
      ${src ? `<button class="btn btn--text danger" id="forget">Remove link from this device</button>` : ""}`;
  }

  // ---------- shell ----------
  function route() {
    const [page, arg] = (location.hash.replace(/^#/, "") || "overview").split("/");
    if (page === "itinerary" && arg) state.day = parseInt(arg, 10) || state.day;
    return ["overview", "itinerary", "bookings", "settings"].includes(page) ? page : "overview";
  }

  function render() {
    const page = Sheets.getSource() ? route() : "settings";
    document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("is-active", a.dataset.page === page));
    document.body.classList.toggle("no-trip", !Sheets.getSource());
    if (page === "settings") {
      const typed = document.getElementById("sheet-link")?.value;
      $view.innerHTML = viewSettings();
      if (typed) document.getElementById("sheet-link").value = typed;
      return;
    }
    if (!state.data) {
      $view.innerHTML = state.error
        ? `<div class="empty"><div class="empty__icon">🌧️</div><p>Couldn't reach the sheet.</p><p class="tiny muted">${esc(state.error)}</p><button class="btn btn--ghost" onclick="App.refresh()">Try again</button></div>`
        : `<div class="empty"><div class="spinner"></div><p class="muted">Packing your itinerary…</p></div>`;
      return;
    }
    const o = state.data.overview;
    document.title = `${o.tripName} · Trip`;
    document.getElementById("brand").textContent = o.tripName;
    $view.innerHTML = { overview: viewOverview, itinerary: viewItinerary, bookings: viewBookings }[page]() + footer();
  }

  function footer() {
    const t = new Date(state.data.fetchedAt);
    const when = t.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `<p class="updated">${state.error ? "Offline — showing saved copy · " : ""}Updated ${esc(when)}</p>`;
  }

  async function refresh() {
    if (state.loading || !Sheets.getSource()) return;
    state.loading = true;
    document.body.classList.add("is-loading");
    try {
      state.data = await Sheets.loadTrip();
      state.error = null;
    } catch (e) {
      state.error = e.message || "Network error";
    } finally {
      state.loading = false;
      document.body.classList.remove("is-loading");
      render();
    }
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    navigator.clipboard?.writeText(btn.dataset.copy).then(() => {
      btn.classList.add("is-copied");
      setTimeout(() => btn.classList.remove("is-copied"), 1200);
    });
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "linkform") return;
    e.preventDefault();
    const link = e.target.link.value;
    state.saving = true;
    state.formError = null;
    render();
    try {
      state.data = await Sheets.saveSource(link);
      state.error = null;
      state.day = null;
      state.saving = false;
      if (location.hash === "#overview") render();
      else location.hash = "#overview";
    } catch (err) {
      state.saving = false;
      state.formError = err.message || "Something went wrong — please try again.";
      render();
      document.getElementById("sheet-link").value = link;
    }
  });
  document.addEventListener("click", (e) => {
    if (e.target.id !== "forget") return;
    if (!confirm("Remove this trip's sheet link from this device?")) return;
    Sheets.clearSource();
    state.data = null;
    state.day = null;
    location.hash = "#settings";
    render();
  });
  document.getElementById("refresh").addEventListener("click", refresh);
  document.getElementById("theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.mode === "dark" ? "light" : "dark");
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-choice]");
    if (b) setTheme(b.dataset.themeChoice);
  });
  darkQuery.addEventListener("change", applyTheme);
  applyTheme();
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.data && Date.now() - state.data.fetchedAt > 5 * 60000) refresh();
  });

  state.data = Sheets.cachedTrip();
  render();
  refresh();

  window.App = { refresh };
})();

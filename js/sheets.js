// Reads tabs from the Google Sheet as CSV and shapes them into plain objects.
(function () {
  const CACHE_KEY = "trip-cache-v1";
  const SOURCE_KEY = "trip-source-v1";
  const TAB_NAMES = { overview: ["overview"], itinerary: ["itinerary"], bookings: ["bookings", "booking"] };

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };

  // Accepts a full Google Sheets URL or a bare spreadsheet ID.
  function parseSheetId(input) {
    const s = String(input || "").trim();
    const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
    if (m) return m[1];
    return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
  }

  // Reads the sheet's public HTML view to map tab names → gids, so only the link is needed.
  async function discoverTabs(sheetId) {
    let html;
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`);
      if (!res.ok) throw new Error();
      html = await res.text();
    } catch (_) {
      throw new Error("Couldn't open that sheet. Check it's shared as “Anyone with the link → Viewer”.");
    }
    const found = {};
    for (const m of html.matchAll(/name:\s*"((?:[^"\\]|\\.)*)"[^{}]*?gid:\s*"(\d+)"/g)) {
      found[m[1].trim().toLowerCase()] = m[2];
    }
    const tabs = {};
    const missing = [];
    for (const [key, names] of Object.entries(TAB_NAMES)) {
      const name = names.find((n) => found[n]);
      if (name) tabs[key] = found[name];
      else missing.push(names[0][0].toUpperCase() + names[0].slice(1));
    }
    if (missing.length) throw new Error(`This sheet is missing the ${missing.join(", ")} tab${missing.length > 1 ? "s" : ""}.`);
    return tabs;
  }

  function getSource() {
    const saved = store.get(SOURCE_KEY);
    if (saved && saved.sheetId) return saved;
    const fallback = parseSheetId(window.TRIP_CONFIG && window.TRIP_CONFIG.sheetUrl);
    return fallback ? { sheetId: fallback, tabs: null } : null;
  }

  async function saveSource(input) {
    const sheetId = parseSheetId(input);
    if (!sheetId) throw new Error("That doesn't look like a Google Sheets link.");
    const tabs = await discoverTabs(sheetId);
    store.set(SOURCE_KEY, { sheetId, tabs, savedAt: Date.now() });
    store.del(CACHE_KEY);
    return loadTrip();
  }

  function clearSource() {
    store.del(SOURCE_KEY);
    store.del(CACHE_KEY);
  }

  function sheetUrl(src) {
    return src ? `https://docs.google.com/spreadsheets/d/${src.sheetId}/edit` : "";
  }

  function csvUrl(sheetId, gid) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&_=${Date.now()}`;
  }

  async function fetchRows(sheetId, gid) {
    const res = await fetch(csvUrl(sheetId, gid));
    if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
    const text = await res.text();
    return Papa.parse(text, { skipEmptyLines: false }).data.map((r) => r.map((c) => (c || "").trim()));
  }

  // Finds the header row (first row whose first cell matches) and maps following rows to objects.
  function table(rows, firstHeader) {
    const h = rows.findIndex((r) => r[0] === firstHeader);
    if (h < 0) return [];
    const headers = rows[h];
    return rows.slice(h + 1).map((r) => {
      const o = {};
      headers.forEach((key, i) => key && (o[key] = r[i] || ""));
      return o;
    });
  }

  function parseOverview(rows) {
    const info = {};
    const glance = {};
    const travellers = [];
    const budget = [];
    let inBudget = false;

    rows.forEach((r) => {
      const [a, b, , d, e, f, g, h] = r;
      if (a) {
        if (/^Traveller \d/.test(a)) b && travellers.push(b);
        else if (b) info[a] = b;
      }
      if (d === "Traveller") { inBudget = true; return; }
      if (inBudget) {
        if (!d || d === "AT A GLANCE") inBudget = false;
        else budget.push({ name: d, paid: e, share: f, balance: g, left: h });
      }
      if (!inBudget && d && g && d !== "Traveller") glance[d] = g;
    });

    return {
      tripName: info["Trip name"] || "My Trip",
      destination: info["Destination"] || "",
      startDate: info["Start date"] || "",
      endDate: info["End date"] || "",
      numDays: parseInt(info["Number of days"], 10) || 0,
      currency: info["Home currency"] || "",
      budgetPerPerson: info["Budget per person (home cur.)"] || "",
      travellers,
      budget,
      glance,
    };
  }

  function parseItinerary(rows) {
    return table(rows, "Day #")
      .filter((r) => r["Day #"] && (r["Place / Activity"] || r["Location / Address"]))
      .map((r) => ({
        day: parseInt(r["Day #"], 10),
        date: r["Date"],
        time: r["Time"],
        activity: r["Place / Activity"],
        category: r["Category"],
        location: r["Location / Address"],
        maps: r["Maps Link"],
        hours: r["Opening Hours"],
        price: r["Est. Price (pp)"],
        currency: r["Currency"],
        description: r["Description"],
        bookingNeeded: r["Booking Needed?"],
        status: r["Status"],
        suggestedBy: r["Suggested By"],
        duration: r["Duration (hrs)"],
        notes: r["Notes"],
      }))
      .sort((a, b) => a.day - b.day || (a.time || "99").localeCompare(b.time || "99"));
  }

  function parseBookings(rows) {
    return table(rows, "Type")
      .filter((r) => r["Type"] || r["Provider / Airline / Hotel"])
      .map((r) => ({
        type: r["Type"] || "Other",
        provider: r["Provider / Airline / Hotel"],
        details: r["Details (flight no., room, pax)"],
        start: r["Start / Depart"],
        end: r["End / Arrive"],
        confirmation: r["Confirmation #"],
        cost: r["Cost"],
        currency: r["Currency"],
        costHome: r["Cost (Home Cur.)"],
        status: r["Status"],
        bookedBy: r["Booked By"],
        paidBy: r["Paid By"],
        cancelBy: r["Cancellation Deadline"],
        link: r["Link / Email Ref"],
        notes: r["Notes"],
      }));
  }

  async function fetchAll(src) {
    const { sheetId, tabs } = src;
    return Promise.all([fetchRows(sheetId, tabs.overview), fetchRows(sheetId, tabs.itinerary), fetchRows(sheetId, tabs.bookings)]);
  }

  async function loadTrip() {
    const src = getSource();
    if (!src) return null;
    let rows;
    try {
      if (!src.tabs) throw new Error("no tabs yet");
      rows = await fetchAll(src);
    } catch (_) {
      // Tabs may have been recreated or renamed since they were saved; look them up again once.
      src.tabs = await discoverTabs(src.sheetId);
      if (store.get(SOURCE_KEY)) store.set(SOURCE_KEY, { ...src, savedAt: Date.now() });
      rows = await fetchAll(src);
    }
    const [o, i, b] = rows;
    const data = {
      sheetId: src.sheetId,
      overview: parseOverview(o),
      itinerary: parseItinerary(i),
      bookings: parseBookings(b),
      fetchedAt: Date.now(),
    };
    store.set(CACHE_KEY, data);
    return data;
  }

  function cachedTrip() {
    const src = getSource();
    const data = store.get(CACHE_KEY);
    return src && data && data.sheetId === src.sheetId ? data : null;
  }

  window.Sheets = { loadTrip, cachedTrip, getSource, saveSource, clearSource, sheetUrl };
})();

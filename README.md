# Trip Itinerary

A calm, mobile-first view of a trip planned in Google Sheets: **Overview**, **Itinerary** and **Bookings**.
It's a static site (no build step) hosted on GitHub Pages. It reads the sheet live every time it opens.

## Updating the trip
Edit the Google Sheet as usual, then tap the ↻ button in the app. Changes can take up to a minute to show.
The app keeps the last copy it loaded, so it still works with poor roaming signal.

## Connecting a sheet (and switching trips)
1. Share the trip sheet as **Anyone with the link → Viewer** and copy the link.
2. Open the app, tap ⚙︎, paste the link and tap **Use this sheet**.

The link is stored only in that browser (localStorage), not in this repo, so each device needs it pasted once.
The app finds the **Overview**, **Itinerary** and **Bookings** tabs by name. For a new trip, copy the sheet template and paste the new link.
To bake in a default sheet for every visitor, set `sheetUrl` in `config.js`. That makes the sheet ID public.

The app finds columns by their header names (`Day #`, `Type`, …), so you can add rows freely. If you rename a header, update `js/sheets.js`.

## Running locally
```sh
python3 -m http.server 8000
# open http://localhost:8000
# simulate a moment during the trip: http://localhost:8000/?today=2026-10-17T11:30
```

## Privacy
No sheet link is stored in this repo, so a visitor to the Pages URL sees only the setup screen. Your trip shows only on devices where you've pasted the link. The sheet itself is still readable by anyone who has its link.

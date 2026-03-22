# CLAUDE.md

## Project Overview

**TapIn** is a Progressive Web App (PWA) for one-tap employee attendance tracking. It uses vanilla JavaScript on the frontend (hosted on GitHub Pages) and Google Apps Script (GAS) as a serverless backend with Google Sheets as the database.

## Architecture

```
web/          # PWA frontend (GitHub Pages)
gas/          # Google Apps Script backend
docs/         # Technical specs and progress notes
```

- **Frontend**: Vanilla JS, HTML5, CSS3 — no build tools, no npm dependencies
- **Backend**: Google Apps Script (`gas/Code.gs`) — deployed as a Web App
- **Database**: Google Sheets (managed via GAS)
- **CI/CD**: GitHub Actions auto-deploys `web/` to GitHub Pages on push to `main`

## Key Files

| File | Purpose |
|------|---------|
| `web/config.js` | Central config: GAS endpoint URL, office IP, GPS accuracy |
| `web/app.js` | Main frontend: device UUID, punch-in, registration, GPS/IP |
| `web/admin.js` | Admin console: login, settings, attendance log queries |
| `web/sw.js` | Service Worker for offline/PWA support |
| `gas/Code.gs` | Backend: request handling, anti-fraud, Sheets integration |

## Local Development

No install step required. Serve the `web/` directory over HTTP:

```bash
# Node.js (recommended)
npx serve web

# Python
cd web && python3 -m http.server 8080
```

- Punch-in UI: `http://localhost:3000/`
- Register mode: `http://localhost:3000/?mode=register`
- Admin console: `http://localhost:3000/admin.html`

> Note: GPS and some PWA features require HTTPS in production.

## Backend (GAS) Setup

1. Create a Google Apps Script project and copy `gas/Code.gs` and `gas/appsscript.json`
2. Set `SPREADSHEET_ID` in Script Properties
3. Run `setAdminCredential("admin", "password")` once in the GAS editor
4. Create an `Employees` sheet with names in column A
5. Deploy as Web App (Execute as: Me, Access: Anyone)
6. Copy the Web App URL into `web/config.js`

## Deployment

Frontend deploys automatically via `.github/workflows/deploy-pages.yml` when code is pushed to `main`. No build step is needed.

Backend (GAS) must be redeployed manually through the Google Apps Script editor whenever `gas/Code.gs` changes.

## Configuration

All frontend configuration lives in `web/config.js`:

```javascript
window.TAPIN_CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/...",
  DEFAULT_OFFICE_STATIC_IP: "203.0.113.10",
  MAX_GPS_ACCURACY_METERS: 120
};
```

## Coding Conventions

- Vanilla JS only — no frameworks, no bundlers
- Mobile-first CSS
- All time-sensitive operations use server time from GAS (not client clock)
- Anti-fraud logic (device binding, IP/GPS checks) lives in `gas/Code.gs`

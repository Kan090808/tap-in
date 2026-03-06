# TapIn - System Technical Specifications

## 1. Project Overview
- Name: TapIn
- Type: PWA (Progressive Web App)
- Concept: One-tap attendance with zero-friction user experience.
- Core Pillars: Device Binding, IP Boundary Verification, Instant Feedback.

## 2. Technology Stack
- Frontend: HTML5, CSS3 (Mobile-first), Vanilla JavaScript.
- Backend: Google Apps Script (GAS) - Serverless.
- Database: Google Sheets (Real-time logging).
- Deployment: GitHub Pages / Vercel (HTTPS Mandatory).

## 3. Core Functionality Specs
- One-Tap Punch: Single large button interface for immediate check-in.
- Device Binding:
  - Generates a unique DeviceUUID on first launch.
  - Stores UUID in localStorage.
  - Prevents buddy punching by locking the User ID to the specific device.
- IP Boundary Check:
  - Detects Public IP via api.ipify.org.
  - Compares current IP against OFFICE_STATIC_IP.
  - Labels logs as Office (Match) or Remote/Field (Mismatch).
- Geolocation:
  - Captures GPS coordinates (Lat/Lng) as secondary proof.
  - Accuracy check to prevent GPS spoofing apps.
- Identity via Device UUID:
  - Uses local Device UUID to identify employee binding records.
- Employee Roster:
  - Maintains an `Employees` sheet as allowed-name roster.
  - Only names in roster can register device bindings.
- QR Registration:
  - `index.html?mode=register` allows submitting name + current device UUID for binding.
  - Rejects when device UUID or name is already bound; requires admin to remove binding first.

## 4. Data Schema (Google Sheets)
- Column A: Timestamp (ISO Format)
- Column B: Employee Name (from device binding)
- Column C: Device UUID (Identity Lock)
- Column D: IP Address (Public)
- Column E: Location Status (Office / Remote/Field)
- Column F: Latitude
- Column G: Longitude

### Binding Sheet (`DeviceBindings`)
- Column A: Employee Name
- Column B: Device UUID
- Column C: Bound At (ISO Format)

### Employee Sheet (`Employees`)
- Column A: Employee Name (allowed roster, maintained by admin only)

## 5. PWA & UX Specs
- Display Mode: Standalone (No browser address bar).
- Theme Color: #0066FF (Trust Blue).
- Installability: Prompt user to Add to Home Screen for App-like behavior.
- Desktop Chromium: Provide explicit "新增至桌面" button via `beforeinstallprompt`.
- iOS Safari: Show explicit "Share -> Add to Home Screen" guidance flow.
- Icons: Provide `192x192`, `512x512`, and `apple-touch-icon (180x180)` for install compatibility.
- Notification: Request permission for Arrival Alerts based on Geofencing.

## 6. Anti-Fraud Logic
- Time Source: Uses server-side Google time only, ignores local phone time.
- Request Timestamp Source: Frontend fetches GAS `serverTime` before submit, then sends network timestamp for freshness validation.
- UUID Validation: Punch-in is allowed only when device UUID is registered in binding sheet.
- Roster Validation: Registration succeeds only if the submitted name exists in `Employees` sheet.
- HTTPS Only: Production punch-in requires HTTPS; localhost is only for development tests.

## 7. Admin Console Specs
- URL: `/admin.html`
- Authentication:
  - Admin login via GAS API (`adminLogin`).
  - Session token stored in browser `sessionStorage`.
  - Session expires on server side (`ADMIN_SESSION_HOURS`).
- Config management:
  - Update OFFICE_STATIC_IP.
  - Update Google Spreadsheet ID.
  - Update Log/Binding sheet names.
  - Update GPS accuracy threshold.
- Log viewing:
  - Query attendance records from Google Sheets.
  - Support latest N records (20/50/100/200).

## 8. GitHub Pages Deployment Constraints
- Must use relative asset paths (`./...`) to support repo subpath deployment.
- Service Worker scope must remain under `web/` static root.
- `manifest.webmanifest` should keep `start_url` and `scope` as `./`.
- GitHub Pages provides HTTPS by default on `*.github.io`; custom domains must enable HTTPS.
- Frontend and Admin pages share one config file (`web/config.js`) for GAS endpoint consistency.

## 9. GAS Runtime Configuration
- Runtime values are read from Script Properties first, then fallback to defaults in code.
- Required initialization:
  - Set Spreadsheet ID in Script Properties or update `DEFAULT_CONFIG.SPREADSHEET_ID`.
  - Ensure `Employees` sheet exists and contains valid employee names in column A.
  - Run `setAdminCredential(username, password)` once from GAS editor.

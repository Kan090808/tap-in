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
- **CI/CD**: GitHub Actions auto-deploys `web/` to GitHub Pages and `gas/` to Google Apps Script on push to `main`

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

1. Create a Google Apps Script project
2. Set `SPREADSHEET_ID` in Script Properties
3. Run `setAdminCredential("admin", "password")` once in the GAS editor
4. Create an `Employees` sheet with names in column A
5. Deploy as Web App (Execute as: Me, Access: Anyone)
6. Copy the Web App URL into `web/config.js`

### 連接 clasp（一次性設定）

clasp 是 Google 官方的 GAS CLI，用於從本地推送程式碼，無需手動複製貼上。

```bash
# 安裝 clasp
npm install -g @google/clasp

# 登入 Google 帳號（會開啟瀏覽器授權）
clasp login

# 確認登入成功，~/.clasprc.json 已建立
```

1. 從 GAS 編輯器 URL 取得 Script ID（格式：`/projects/<SCRIPT_ID>/edit`）
2. 編輯 `gas/.clasp.json`，將 `REPLACE_WITH_YOUR_SCRIPT_ID` 替換為實際 Script ID
3. 測試本地推送：`cd gas && clasp push`

### 設定 GitHub Actions 自動部署

在 GitHub repo 的 **Settings → Secrets and variables → Actions** 加入以下 Secret：

| Secret 名稱 | 值 |
|---|---|
| `CLASPRC_JSON` | `~/.clasprc.json` 的完整內容（`cat ~/.clasprc.json`）|

完成後，每次 push 到 `main` 且 `gas/` 有變更，GitHub Actions 會自動執行 `clasp push` 更新 GAS 專案。

> **注意**：`clasp push` 只更新程式碼（HEAD 版本）。若 GAS Web App 部署設定為「使用最新版本（@HEAD）」，變更立即生效；若為固定版本號，需手動在 GAS 編輯器建立新部署。

## Deployment

| 對象 | 觸發條件 | 方式 |
|---|---|---|
| Frontend (`web/`) | push to `main`，`web/` 有變更 | GitHub Actions → GitHub Pages |
| Backend (`gas/`) | push to `main`，`gas/` 有變更 | GitHub Actions → clasp push |

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

# TapIn

TapIn 是一個以「一鍵打卡、零摩擦」為目標的 PWA。前端部署於 GitHub Pages / Vercel，後端使用 Google Apps Script，資料記錄於 Google Sheets。

## 功能摘要
- 一鍵打卡（以 Device UUID 自動識別）
- QR 註冊（`?mode=register` 綁定姓名與裝置）
- 裝置綁定（Device UUID）
- IP 邊界判定（Office / Remote/Field）
- GPS 座標與精度檢查
- 管理後台登入、修改系統設定、查看打卡紀錄

## 專案結構
- `docs/`：規格與進度文件
- `web/`：PWA 前端與管理後台
- `gas/`：Google Apps Script 後端

## 初始化步驟
1. 編輯 `web/config.js`：設定 `GAS_WEB_APP_URL`。
2. 在 Google Apps Script 建立專案，貼上 `gas/Code.gs` 與 `gas/appsscript.json`。
3. 設定 `DEFAULT_CONFIG.SPREADSHEET_ID`，或於 Script Properties 設定 `TAPIN_SPREADSHEET_ID`。
4. 在 GAS 編輯器執行一次 `setAdminCredential("admin", "你的密碼")` 建立管理者帳號。
5. 部署 GAS 為 Web App（執行身分：你自己；存取權：任何人）。
6. 部署 `web/` 到 GitHub Pages 或 Vercel（HTTPS）。
7. 在同一份 Spreadsheet 建立 `Employees` 工作表，第一欄填入可註冊的員工姓名。

## GitHub Pages 部署（公開）
1. 建立新的公開 GitHub repo（建議名稱：`tap-in`）。
2. 確保只上傳此專案資料夾，不要把上層其他專案一起推上去。
3. 推送後，到 GitHub `Settings > Pages`，`Source` 選 `GitHub Actions`。
4. 本專案已提供 `.github/workflows/deploy-pages.yml`，會自動部署 `web/` 目錄。
5. 部署完成後，站點網址為 `https://<你的帳號>.github.io/<repo>/`。

## 正式上線建議流程
1. 建立正式 Google Sheet（不要用測試資料表），並把 `Spreadsheet ID` 設到 GAS 設定。
2. GAS 發佈使用固定版本（不要用開發版 URL），取得正式 `.../exec` 網址後更新 `web/config.js`。
3. 前端部署到 HTTPS 網域（GitHub Pages 或 Vercel），建議使用獨立正式網域。
4. 以手機實機驗證：定位權限、IP 判定、打卡寫入、管理後台登入。
5. 發佈後保留一份 rollback 版本（上一版 GAS 與前端）。

## 加入桌面（A2HS）
- Desktop (Chrome / Edge)：可點擊「新增至桌面」按鈕觸發安裝。
- Android (Chrome)：會顯示「安裝 App」按鈕。
- iOS (Safari)：會顯示「加入桌面」按鈕，提示使用「分享 -> 加入主畫面」。
- 已提供 `manifest.webmanifest`、`Service Worker`、`apple-touch-icon` 與 `192/512` PNG icons。

## 管理後台
- 路徑：`/admin.html`
- 可管理項目：
  - 辦公室固定 IP
  - Google Sheet ID
  - Log/Binding sheet 名稱
  - GPS 精度門檻
- 可查詢項目：
  - 最近 N 筆打卡紀錄

## 本機測試（Local Hosting）

PWA 需在 HTTPS 或 `localhost` 上才能使用 Service Worker 與定位功能，直接用 `file://` 開啟會受限。推薦以下方式：

### 方法一：Node.js `serve`（推薦）

```bash
npx serve web
```

瀏覽器開啟 `http://localhost:3000`。

### 方法二：Python 內建 HTTP Server

```bash
# Python 3
cd web && python3 -m http.server 8080
```

瀏覽器開啟 `http://localhost:8080`。

### 方法三：VS Code Live Server 擴充套件

1. 安裝擴充套件 **Live Server**（ritwickdey.LiveServer）。
2. 在 `web/index.html` 上右鍵 → **Open with Live Server**。
3. 瀏覽器自動開啟 `http://127.0.0.1:5500`。

### 手機測試（同一 Wi-Fi）

先用上述任一方法啟動本機伺服器，再用電腦的區網 IP 讓手機連入：

```bash
# 查詢本機 IP（macOS）
ipconfig getifaddr en0
```

手機 Chrome 開啟對應網址（需與電腦在同一 Wi-Fi）：

| 方法 | 網址 |
|------|------|
| `npx serve web` | `http://<電腦IP>:3000` |
| `python3 -m http.server 8080` | `http://<電腦IP>:8080` |
| VS Code Live Server | `http://<電腦IP>:5500` |

三種方法預設都監聽 `0.0.0.0`，同 Wi-Fi 其他裝置皆可連入。

> **注意**：GPS 定位在非 HTTPS 頁面（除 localhost 外）無法使用。若要測試完整 GPS 流程，請改用 GitHub Pages / Vercel 的 HTTPS 網址，或使用 `ngrok` 建立 HTTPS Tunnel：
> ```bash
> ngrok http 3000
> ```

## 測試入口
- 打卡頁：`/index.html`
- 註冊頁（QR）：`/index.html?mode=register`
- 管理頁：`/admin.html`

## 目前實作狀態
請參考 `docs/progress.md`。

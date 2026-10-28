# 本機展示與開發測試

## 顧客展示：純瀏覽器 localStorage

```sh
npm ci
npm run build:demo
python3 -m http.server 8080 --directory web
```

開啟 <http://localhost:8080/>，管理員使用 `admin`／`demo-password`。裝置已綁定 Alex Morgan；另有兩位示範員工、本月出勤、待審請假／補簽、PDF 證明與薪資調整。

建議展示順序：
1. 選擇 **Employee**，按 **Sign in with this device**。首次使用需輸入密碼與確認密碼；設定完成後需重新登入並輸入密碼，才能查看員工月曆、使用 **Clock in**／**Clock out**、請假或補簽。之後登入均需輸入已設定的密碼。
2. 提交請假或補簽。病假可附 PNG、JPEG、WebP 或 PDF，單檔最多 512 KiB，全部證明最多 1.5 MiB。
3. 登出後切到 **Admin**，審核請假／補簽、下載病假證明。
4. **People** 編輯／新增員工或封存；**Schedules** 查看班表；薪資與班表異動須填理由與生效日期。
5. **Payroll** 選擇員工及本月，載入薪資、查看調整歷史、加入調整並匯出 CSV。
6. 重新整理，確認資料保留；網站完成離線快取後也可離線重開。
7. **Reset demo data** 經確認後還原示範資料並清除登入狀態，保留 Device ID 與其他網站儲存鍵。

展示版不連 API、GAS 或 Google Cloud。示範員工起初未設定密碼；密碼設定、登入狀態與業務資料會保留至重設展示資料或清除網站資料。IP／GPS 是模擬值，不要求定位／通知權限；時鐘從裝置時間開始，必要時推進一分鐘，讓連續打卡可立即展示。所有業務資料與證明保存在 `tapin_demo_state_v1`；各瀏覽器、裝置、網域與連接埠獨立，清除網站資料會遺失修改。容量不足或儲存不可用會明確拒絕操作。不要放入真實個資或正式密碼。

需使用 localhost 或 HTTPS；不要直接打開 `file://`。手機建議開啟 GitHub Pages HTTPS 網址。修改 `gas/*.gs` 或 `scripts/demo-runtime.js` 後須重新執行 `npm run build:demo`；部署流程會自動建置。完整測試：`npm test`。

## 既有 Node API 開發模式（非展示版）

在專案目錄啟動：

```sh
node scripts/local-server.cjs
```

開啟 <http://localhost:8080/?role=admin>，使用本機管理員帳號 `admin`、密碼 `test-password` 登入。首頁會顯示本機測試提示；前端設定由本機伺服器產生，API 指向同一台本機，無須修改 `web/config.js` 或部署 Google Apps Script。

預設只允許這台電腦連線。要讓同一個 Wi-Fi 的其他裝置測試，先停止伺服器，再以區域網路模式啟動：

```sh
node scripts/local-server.cjs --lan
```

此模式監聽 `0.0.0.0`，並允許透過這台電腦的私人 IPv4 位址存取。啟動時會列出可用的區網網址；其他裝置開啟其中一個網址（格式為 `http://電腦的區網IP:8080/?role=admin`），不要使用 `localhost`。管理員帳密仍為 `admin`／`test-password`，所有裝置共用同一份 `.local/tapin.json` 資料。

手機透過區網 HTTP 網址可測試管理員功能；定位與需要安全連線的 PWA 功能仍需 HTTPS。打卡的定位驗證不會因區網模式而停用。

先在首頁複製 Device ID，再到管理員的 **Employee accounts** 建立員工並貼上 Device ID，設定薪資、班表及變更理由。回首頁選員工角色，按 **Sign in with this device**；首次需設定密碼，完成後再輸入密碼登入。已設定過密碼的員工需輸入密碼才能登入；登入後即可測打卡、請假、補簽、審核、月報、薪資調整及封存。定位需允許瀏覽器權限。

本機使用真正的 GAS 業務程式，Google Sheets、Script Properties 與 Drive 則由本機服務模擬。資料保存在 `.local/tapin.json`，重新啟動仍會保留；這個檔案不會加入 Git。需要清空時，先停止伺服器，再刪除該檔案並重啟。

這個環境不會連接正式 Google 試算表，也不會驗證 Google 授權、Drive 分享權限、GAS 部署或手機 PWA 的正式環境行為。這些仍需另用測試用 GAS／Sheets 驗收。本機帳密僅供本機測試使用。

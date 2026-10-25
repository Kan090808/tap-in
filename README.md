# TapIn

TapIn 現在預設為顧客展示用的純前端 PWA。所有員工、打卡、請假、證明、班表、補簽、薪資與管理員工作階段資料都存在目前瀏覽器的 `localStorage`，不需要 GAS、Cloud Run、Firestore 或 Google 登入。業務規則仍由同一份 `gas/*.gs` 打包執行。

## 功能摘要
- 一鍵打卡（以 Device UUID 自動識別）
- 員工複製頁面上方 Device ID，由管理員建立與綁定帳號
- 裝置綁定（Device UUID）
- IP 邊界判定（Office / Remote/Field）
- GPS 座標與精度檢查
- 首頁免登入上／下班打卡；管理員可從座標開啟地圖
- 員工班表群組、請假與補簽申請、月曆和申請紀錄
- 管理員審核請假／補簽、直接補簽、查看月工時與馬幣薪資試算、匯出 CSV
- 管理後台登入、管理員工帳號、修改系統設定、查看打卡紀錄

出勤、加班與薪資的詳細規則請見 [`docs/attendance-rules.md`](docs/attendance-rules.md)。

## 專案結構
- `docs/`：規格與進度文件
- `web/`：PWA 前端與管理後台
- `gas/`：Google Apps Script 後端

## 啟動顧客展示版

```sh
npm ci
npm run build:demo
python3 -m http.server 8080 --directory web
```

開啟 <http://localhost:8080/>。管理員：`admin`／`demo-password`；目前裝置已綁定示範員工 Alex Morgan，可直接上下班打卡或以員工角色登入。另有 Jamie Chen、Taylor Singh，以及本月打卡、待審請假／補簽、證明與薪資調整資料。

- 打卡、員工管理／封存、裝置綁定、班表／薪資生效日、請假證明與審核、補簽／撤銷、月曆、薪資調整與 CSV 匯出沿用現有業務規則。
- Demo 使用模擬 Office IP、GPS 與可推進的時鐘，不要求定位或通知權限，也不查詢外部 API。同分鐘連續上下班會將 Demo 時鐘推進，避免時間衝突。
- 按 **Reset demo data** 並確認即可還原示範資料、清除登入工作階段；保留 Device ID 與非 TapIn 儲存資料。
- 證明每檔最多 512 KiB，全部證明合計最多 1.5 MiB。瀏覽器空間不足時會拒絕儲存，不將未保存操作顯示為成功。
- 重新整理或重開瀏覽器會保留資料；不同瀏覽器、裝置、網域或連接埠不共用資料。清除網站儲存資料後會失去修改。
- 首次載入仍須能取得網站檔案；Service Worker 安裝完成後可離線使用。請用 localhost 或 HTTPS，不要直接以 `file://` 開啟。
- 這是展示環境，不是安全的正式人資系統。不要輸入真實個資、醫療證明或正式密碼。

`web/demo-runtime.js` 由 `scripts/demo-runtime.js` 和 `gas/*.gs` 建置；修改規則後須重新執行 `npm run build:demo`。GitHub Pages 工作流程會先安裝依賴與建置，再發布靜態 `web/`。詳細展示步驟與既有 Node 測試模式見 [`docs/local-testing.md`](docs/local-testing.md)。

## GitHub Pages 部署（公開）
1. 建立新的公開 GitHub repo（建議名稱：`tap-in`）。
2. 確保只上傳此專案資料夾，不要把上層其他專案一起推上去。
3. 推送後，到 GitHub `Settings > Pages`，`Source` 選 `GitHub Actions`。
4. 本專案已提供 `.github/workflows/deploy-pages.yml`，會自動部署 `web/` 目錄。
5. 部署完成後，站點網址為 `https://<你的帳號>.github.io/<repo>/`。

## 正式系統注意事項

目前 `web/config.js` 啟用 `DEMO_MODE`，不連正式資料。既有 GAS、Node 本機後端與 Cloud Run 程式保留作開發／正式系統用途，但不是展示版的執行依賴；請勿把 Demo 帳密或 localStorage 當作正式系統的驗證與備份方案。正式 Google 服務部署、資料搬移與切換不屬於此次展示版。

## 加入桌面（A2HS）
- Desktop (Chrome / Edge)：可點擊「新增至桌面」按鈕觸發安裝。
- Android (Chrome)：會顯示「安裝 App」按鈕。
- iOS (Safari)：會顯示「加入桌面」按鈕，提示使用「分享 -> 加入主畫面」。
- 已提供 `manifest.webmanifest`、`Service Worker`、`apple-touch-icon` 與 `192/512` PNG icons。

## 管理後台
- 路徑：`/admin.html`
- 可管理項目：
  - 員工帳號的新增、編輯與封存（姓名、電話、Email、Device ID），封存後仍可查詢歷史月報
  - 員工班表群組與月薪
  - 請假與補簽審核、管理員直接補簽、月底工時與薪資調整
  - 辦公室固定 IP
  - Google Sheet ID
  - Log/Binding sheet 名稱
  - GPS 精度門檻
- 可查詢項目：
  - 最近 N 筆打卡紀錄
  - 員工每月出勤、工時、請假、缺席、加班與薪資試算；可匯出 CSV

## 本機與手機展示

顧客展示請使用上面的靜態網站啟動方式，而不是 `scripts/local-server.cjs`。固定使用同一個網址及連接埠，才能讀到相同的瀏覽器資料。手機展示建議使用 GitHub Pages 的 HTTPS 網址；手機會有自己獨立的示範資料。

既有 `node scripts/local-server.cjs` 是開發用的 Node API 模式，使用 `admin`／`test-password` 與 `.local/tapin.json`，**不是 localStorage 展示版**。其使用方式保留於 [`docs/local-testing.md`](docs/local-testing.md)。

## 測試入口
- 打卡頁：`/index.html`
- 管理頁：`/admin.html`
- 工時與薪資規則測試：`node --test tests/*.test.js`

## 目前實作狀態
請參考 `docs/progress.md`。

既有資料升級前，請先閱讀 [`docs/workflow-migration.md`](docs/workflow-migration.md)，在測試資料表執行遷移預覽並確認歷史歸屬。新版包含員工封存、薪資／班表生效日期、請假與補簽完整歷史，以及調整稽核紀錄；正式 GAS／Sheets 和手機驗收仍須實際完成。

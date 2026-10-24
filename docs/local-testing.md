# 本機測試

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

先在首頁複製 Device ID，再到管理員的 **Employee accounts** 建立員工並貼上 Device ID，設定薪資、班表及變更理由。回首頁用員工角色登入，即可測打卡、請假、補簽、審核、月報、薪資調整及封存。定位需允許瀏覽器權限。

本機使用真正的 GAS 業務程式，Google Sheets、Script Properties 與 Drive 則由本機服務模擬。資料保存在 `.local/tapin.json`，重新啟動仍會保留；這個檔案不會加入 Git。需要清空時，先停止伺服器，再刪除該檔案並重啟。

這個環境不會連接正式 Google 試算表，也不會驗證 Google 授權、Drive 分享權限、GAS 部署或手機 PWA 的正式環境行為。這些仍需另用測試用 GAS／Sheets 驗收。本機帳密僅供本機測試使用。

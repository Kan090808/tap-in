# TapIn Development Progress

## Milestones
- [x] 建立專案文件與目錄結構
- [x] 完成 PWA 前端（一鍵打卡、UUID、IP、GPS、安裝流程）
- [x] 完成 GAS 後端（防作弊驗證、寫入 Sheets）
- [x] 完成管理後台（登入、設定管理、打卡紀錄查詢）
- [x] 完成 GitHub Pages 相容調整（相對路徑、共用前端設定）
- [x] 加入首頁免登入上下班打卡、班表群組、請假／補簽、月工時與薪資試算、CSV 匯出

## Notes
- 已實作 `fix-attendance-payroll-workflows` 的本機功能修正：固定員工 ID、封存、有效日期薪資與班表、混合假別計薪、補簽衝突與撤銷、完整待審分頁、調整歷史與通知失敗隔離。部署必須同時包含四份 `gas/*.gs`。
- 遷移、回復及外部驗收程序見 `docs/workflow-migration.md`。本機測試不能取代正式 GAS／Sheets、Drive、手機與 PWA 驗證；尚未部署或修改正式資料。
- 詳細出勤與薪資規則已整理於 `docs/attendance-rules.md`；午休時段已確認為 13:00–14:00。
- 新功能已通過本機計算測試與前端語法檢查；尚未在正式 Google Apps Script / Google Sheets 部署驗證。
- 打卡頁不再依賴 URL `name` 參數，改由 `deviceUUID` 自動比對員工資料。
- 若 `deviceUUID` 未綁定有效員工，系統會阻擋打卡並提示將頁面上的 Device ID 交給管理員。
- 裝置綁定由管理員在員工帳號頁管理；不再提供原本的 QR 姓名自行註冊流程。
- 已封存員工不能登入或打卡；歷史紀錄透過固定員工 ID 保留，換機與改名不改變歸屬。
- 若 GPS 精度低於門檻（準確度數值過大），系統會阻擋打卡。
- 管理者帳號需先在 GAS 執行 `setAdminCredential` 建立。
- 已補齊 PWA 安裝相容性：Android 可用 `beforeinstallprompt`，iOS 提供「分享 -> 加入主畫面」引導，並新增 PNG icon（192/512/180）。
- 已新增 GitHub Actions 部署流程，push `main` 後會自動發佈 `web/` 到 GitHub Pages。
- 已新增「新增至桌面」按鈕流程：Desktop Chromium 觸發安裝提示，iOS Safari 顯示加入主畫面引導。
- 打卡與註冊請求已改為先取 GAS `serverTime`，以網路時間作為 request timestamp，避免本機時間偏移造成驗證誤差。

# TapIn Development Progress

## Milestones
- [x] 建立專案文件與目錄結構
- [x] 完成 PWA 前端（一鍵打卡、UUID、IP、GPS、安裝流程）
- [x] 完成 GAS 後端（防作弊驗證、寫入 Sheets）
- [x] 完成管理後台（登入、設定管理、打卡紀錄查詢）
- [x] 完成 GitHub Pages 相容調整（相對路徑、共用前端設定）

## Notes
- 打卡頁不再依賴 URL `name` 參數，改由 `deviceUUID` 自動比對員工資料。
- 若 `deviceUUID` 未註冊，系統會阻擋打卡並提示先掃 QR 註冊。
- 註冊入口為 `index.html?mode=register`，需填姓名並綁定目前裝置 UUID。
- 只有 `Employees` 工作表中存在的姓名才能註冊。
- 同一裝置或同一姓名若已綁定，會提示失敗並要求管理員移除後再註冊。
- 若 GPS 精度低於門檻（準確度數值過大），系統會阻擋打卡。
- 管理者帳號需先在 GAS 執行 `setAdminCredential` 建立。
- 已補齊 PWA 安裝相容性：Android 可用 `beforeinstallprompt`，iOS 提供「分享 -> 加入主畫面」引導，並新增 PNG icon（192/512/180）。
- 已新增 GitHub Actions 部署流程，push `main` 後會自動發佈 `web/` 到 GitHub Pages。

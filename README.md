# eSIM 轉售後端（真的可以跑）

這是一個真實可執行的 Node.js/Express 後端，完整流程：

```
客人下單 (POST /api/checkout)
   -> 產生訂單、導向 ECPay 付款頁
ECPay 付款完成
   -> POST /api/webhooks/ecpay（伺服器對伺服器）
   -> 驗證 CheckMacValue 簽章
   -> 呼叫 eSIM Access 批發 API 下單
   -> 查詢 eSIM 詳情拿到 QR/LPA
   -> 存回訂單
客人瀏覽器
   -> 導回 /order-status.html，輪詢 GET /api/orders/:id 直到出票完成
```

已經在這個環境裡實際跑過、驗證過的部分：
- ✅ Express 伺服器可以啟動
- ✅ `/api/checkout` 會建立訂單並產生**正確的 ECPay CheckMacValue 簽章**（SHA256、64 碼 hex）
- ✅ `/api/webhooks/ecpay` 會正確驗證簽章、正確用 MerchantTradeNo 找回訂單
- ✅ 付款成功會嘗試呼叫 eSIM Access API，失敗時會正確標記訂單為 `esim_order_failed` 並回傳客服訊息，不會讓整個系統掛掉
- ✅ `esim-shop.html`（展示頁面）已經接上真實後端：首頁由 Express 直接提供（`GET /`），「立即購買」會呼叫真正的 `POST /api/checkout`，成功後整頁會被 ECPay 導向頁取代並自動送出付款表單；9 個方案都已對應到 `src/catalog.js` 裡的 planId，不再是假資料的 `setTimeout` demo
- ⚠️ 沒辦法在這個沙盒環境實際打通 `api.esimaccess.com`（網路白名單限制），所以 eSIM Access 那段的**確切路徑名稱**（下單、查詢、餘額）沒有 100% 逐一核對，程式碼裡已經清楚標註哪些地方要在你申請帳號後去 Postman collection 核對。

## 快速開始

```bash
npm install
cp .env.example .env
# 編輯 .env，填入你的 eSIM Access Access Code
npm start
```

伺服器會在 `http://localhost:3000` 啟動，`GET /health` 應該回傳 `{"ok":true}`。

## 上線前必做的三件事

### 1. 核對 eSIM Access 的真實 API 路徑
`src/esimAccessClient.js` 檔案最上面用大段註解列出目前用的路徑（`/esim/order`、`/esim/query` 等）。`/esim/query` 已在官方文件確認過；下單、餘額、方案列表的路徑名稱建議：
1. 到 https://docs.esimaccess.com/ 用你的帳號登入
2. 點 "Run in Postman"，逐一核對每個 endpoint 的路徑與 request body 格式
3. 如果跟預設不同，直接改 `.env` 裡的 `ESIMACCESS_PATH_*` 變數即可，不用改程式碼

### 2. 填入真實方案代碼
`src/catalog.js` 裡的 `packageCode`（如 `JP_5_8`）是示意值。呼叫 `listPackages()` 或登入管理後台，把真正的 packageCode、價格填進去。

### 3. ECPay 換成正式環境
`.env.example` 裡預設的是 ECPay **官方測試用**的 MerchantID/HashKey/HashIV，且 `ECPAY_AIO_URL` 指向測試站 (`payment-stage.ecpay.com.tw`)。正式上線要：
1. 跟 ECPay 申請正式特約商店帳號，拿到正式的 MerchantID / HashKey / HashIV
2. 把 `ECPAY_AIO_URL` 改成 `https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5`
3. 用 ECPay 官方的簽章驗證工具，拿一筆真實測試訂單核對你算出來的 CheckMacValue 是否一致（付款簽章出錯通常只會顯示「簽章錯誤」，沒有更詳細的訊息，所以務必在測試環境先核對過一次）

## 本機測試（不用真的連上 ECPay / eSIM Access）

建立一筆訂單：
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"planId":"jp_5gb_8d","email":"test@example.com"}'
```
會回傳一個會自動送出到 ECPay 的 HTML 表單，訂單同時會寫進 `data/orders.json`。

查訂單狀態：
```bash
curl http://localhost:3000/api/orders/<orderId>
```

## 部署

這是一個標準 Express app，可以直接部署到任何支援 Node.js 的地方：Railway、Render、Fly.io、自己的 VPS 都可以。部署後記得：
- 把 `.env` 的 `PUBLIC_BASE_URL` 改成你的正式網域（ECPay 的 ReturnURL 需要是外部可連到的網址，本機 `localhost` 收不到 webhook）
- 本機測試 webhook 時可以用 `ngrok http 3000` 建立一個外部可連到的網址

## 檔案結構

```
src/
  index.js              Express 進入點
  db.js                 訂單儲存（JSON 檔案，量大了再換 Postgres）
  catalog.js            你的方案 -> eSIM Access packageCode 對應表
  ecpay.js              ECPay CheckMacValue 簽章 + 表單產生
  esimAccessClient.js   eSIM Access API 客戶端
  routes/
    checkout.js         POST /api/checkout
    ecpayWebhook.js      POST /api/webhooks/ecpay
    orders.js            GET  /api/orders/:orderId
public/
  order-status.html     客人付款完成後看到的頁面，會輪詢訂單狀態
```

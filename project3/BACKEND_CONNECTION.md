# Hướng dẫn kết nối Frontend với Backend

## 🔗 Kết nối đã được thiết lập

Frontend đã được cấu hình để kết nối với backend tại `http://localhost:3001/api`

### Các thay đổi đã thực hiện:

1. ✅ **Tạo file `.env.local`** - Lưu trữ URL backend API
2. ✅ **Cập nhật `binanceApi.ts`** - API service giờ gọi backend thay vì Binance trực tiếp
3. ✅ **Cấu hình Next.js proxy** - Tránh CORS issues khi gọi API

### API Endpoints được sử dụng:

Frontend đang gọi các endpoints sau từ backend:

- `GET /api/tickers` - Lấy tất cả ticker 24h
- `GET /api/tickers/:symbol` - Lấy ticker cho 1 symbol cụ thể
- `GET /api/orderbook/:symbol?limit=20` - Lấy order book
- `GET /api/trades/:symbol?limit=50` - Lấy recent trades
- `GET /api/klines/:symbol?interval=1h&limit=100` - Lấy candlestick data

## 🚀 Cách chạy ứng dụng:

### 1. Chạy Backend (Terminal 1):
```bash
cd D:\backend
npm install
npm start
```
Backend sẽ chạy tại `http://localhost:3001`

### 2. Chạy Frontend (Terminal 2):
```bash
cd D:\project3
npm install
npm run dev
```
Frontend sẽ chạy tại `http://localhost:3000`

## 📝 Lưu ý:

- **Backend phải chạy trước** khi khởi động frontend
- Nếu backend chạy ở port khác, cập nhật file `.env.local`
- WebSocket vẫn kết nối trực tiếp với Binance để cập nhật real-time
- Sau khi thay đổi `.env.local`, cần restart dev server

## 🔧 Nếu backend có các endpoints khác:

Chỉnh sửa file `src/services/binanceApi.ts` để phù hợp với API routes của backend.

## ⚠️ Xử lý lỗi CORS:

Nếu gặp lỗi CORS, đảm bảo backend đã cấu hình:

```javascript
// Trong backend
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

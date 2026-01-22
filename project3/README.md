# Crypto Trading Platform - Frontend

Một nền tảng giao dịch cryptocurrency hoàn chỉnh được xây dựng với Next.js 16, React 19, và TailwindCSS.

## ✨ Tính năng chính

### 📊 Giao diện Trading
- **Biểu đồ nến (Candlestick Chart)** với lightweight-charts
  - Cập nhật giá real-time
  - Hỗ trợ nhiều khung thời gian (1m, 5m, 15m, 1H, 4H, 1D, 1W, 1M)
  - Volume bars tích hợp
  - Công cụ phân tích kỹ thuật

### 💱 Trading Form
- **3 loại lệnh**: Limit, Market, Stop-Limit
- Tính năng Buy/Sell với slider phần trăm
- Hiển thị số dư USDT và BTC
- Tính toán tổng tự động
- Phí giao dịch 0.1%

### 📈 Sidebar thị trường
- Danh sách các cặp crypto/USDT
- Cập nhật giá real-time
- Chức năng tìm kiếm crypto
- Đánh dấu yêu thích (star)
- Hiển thị % thay đổi 24h
- Icon trend tăng/giảm

### 📖 Order Book
- Sổ lệnh mua/bán real-time
- Hiển thị độ sâu thị trường
- Bar charts cho volume
- Giá hiện tại nổi bật
- Cập nhật tự động mỗi 3 giây

### ⏱️ Recent Trades
- Lịch sử giao dịch gần đây
- Cập nhật real-time
- Icon phân biệt lệnh mua/bán
- Timestamp cho mỗi giao dịch

### 💼 Portfolio
- Tổng giá trị tài sản
- Danh sách các coin đang nắm giữ
- Hiển thị % lãi/lỗ
- Ẩn/hiện số dư
- Nút Deposit/Withdraw/Transfer

### 📋 Open Orders & History
- Quản lý lệnh đang mở
- Lịch sử giao dịch
- Hủy lệnh
- Chi tiết từng lệnh
- Theo dõi trạng thái lệnh

### 🎨 Header Navigation
- Logo và branding
- Menu điều hướng đầy đủ
- Hiển thị số dư ví
- Thông báo
- Menu người dùng
- Dropdown settings

### 📊 Market Stats (Bonus)
- Market Cap tổng
- Volume 24h
- BTC Dominance
- Số traders hoạt động

## 🛠️ Công nghệ sử dụng

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: TailwindCSS 4
- **Charts**: lightweight-charts 4.2.1
- **Icons**: lucide-react
- **Language**: TypeScript 5

## 🚀 Cài đặt và Chạy

### Yêu cầu
- Node.js 20+
- npm hoặc yarn

### Các bước cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Chạy development server:
```bash
npm run dev
```

3. Mở trình duyệt tại: `http://localhost:3000`

### Các lệnh khác

```bash
# Build cho production
npm run build

# Chạy production build
npm start

# Lint code
npm run lint
```

## 📁 Cấu trúc thư mục

```
src/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main trading page
│
└── components/
    ├── Header.tsx           # Header navigation với user menu
    ├── Sidebar.tsx          # Market list sidebar
    ├── TradingChart.tsx     # Candlestick chart real-time
    ├── TradingForm.tsx      # Buy/Sell form
    ├── OrderBook.tsx        # Sổ lệnh mua/bán
    ├── RecentTrades.tsx     # Giao dịch gần đây
    ├── Portfolio.tsx        # Quản lý tài sản
    ├── OpenOrders.tsx       # Lệnh đang mở & lịch sử
    └── MarketStats.tsx      # Thống kê thị trường
```

## 🎨 Màu sắc chủ đạo

- **Background**: #0b0e11 (main), #181a20 (cards), #1e2329 (panels)
- **Border**: #2b3139
- **Green** (Buy/Up): #0ecb81
- **Red** (Sell/Down): #f6465d
- **Accent**: #f0b90b (yellow)
- **Text**: white, #848e9c (gray)

## ⚡ Tính năng Real-time

Tất cả dữ liệu được mô phỏng cập nhật real-time:
- Giá crypto sidebar: 3 giây
- Order book: 3 giây  
- Recent trades: 2 giây
- Chart: 3 giây
- Price header: 2 giây

## 📱 Responsive Design

- Layout tối ưu cho desktop (1920x1080+)
- Sidebar có thể scroll
- Grid layout linh hoạt
- Components có thể điều chỉnh kích thước

## 🔮 Tính năng có thể mở rộng

- [ ] Kết nối API thật (Binance, Coinbase)
- [ ] WebSocket cho real-time data
- [ ] Authentication & User accounts
- [ ] Notifications system
- [ ] Dark/Light theme toggle
- [ ] Mobile responsive full
- [ ] Multi-language support
- [ ] Advanced charting indicators
- [ ] Social trading features
- [ ] News feed integration

## 📄 License

MIT License - Tự do sử dụng cho mục đích học tập và thương mại.

## 👨‍💻 Developer

Xây dựng bởi GitHub Copilot với Claude Sonnet 4.5

---

**Note**: Đây là demo frontend, không kết nối với exchange thật. Tất cả dữ liệu đều được mô phỏng (simulated).


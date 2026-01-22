# Crypto Exchange Platform - Backend MVP

A comprehensive cryptocurrency exchange backend built with Node.js, Express, TypeScript, Prisma, and PostgreSQL.

## 🚀 Features

- ✅ **Authentication & Authorization**: JWT-based auth with refresh tokens, 2FA support
- ✅ **User Management**: Profile, preferences, security logs
- ✅ **Wallet Management**: Multi-currency wallets, deposits, withdrawals
- ✅ **Trading System**: Market & limit orders, order management
- ✅ **Portfolio Tracking**: Real-time portfolio with P&L calculations
- ✅ **Market Data**: Binance API proxy with Redis caching
- ✅ **WebSocket Support**: Real-time updates for prices, orders, portfolio
- ✅ **Background Workers**: Automated tasks using cron jobs
- ✅ **Security**: Rate limiting, helmet, CORS, input validation

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- npm or yarn

## 🛠️ Installation

### 1. Clone and Install

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your configuration:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/crypto_exchange?schema=public"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRATION=15m
REFRESH_TOKEN_SECRET=your_refresh_secret
REFRESH_TOKEN_EXPIRATION=7d

# Binance API (get from https://www.binance.com/en/my/settings/api-management)
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
```

### 3. Database Setup

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait for containers to be ready
sleep 5

# Run migrations
npm run prisma:migrate

# Seed database with demo data
npm run prisma:seed
```

#### Option B: Local Installation

Install PostgreSQL and Redis locally, then:

```bash
# Run migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed
```

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

## 🚀 Running the Application

### Development Mode

```bash
# Start API server
npm run dev

# In another terminal, start worker service
npm run worker
```

### Production Mode

```bash
# Build
npm run build

# Start
npm start
```

The API will be available at `http://localhost:3000`

## 📝 Demo Accounts

After seeding, you can use these demo accounts:

**Admin Account:**
- Email: `admin@cryptoexchange.com`
- Password: `Admin123!`

**Demo User Account:**
- Email: `demo@cryptoexchange.com`
- Password: `Demo123!`
- Balance: 10,000 USDT, 0.5 BTC, 5 ETH

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

```bash
# Register
POST /api/auth/register
Content-Type: application/json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}

# Login
POST /api/auth/login
Content-Type: application/json
{
  "email": "demo@cryptoexchange.com",
  "password": "Demo123!"
}

# Refresh Token
POST /api/auth/refresh-token
Content-Type: application/json
{
  "refreshToken": "your_refresh_token"
}
```

### Wallet Endpoints (Requires Auth)

```bash
# Get all balances
GET /api/wallet/balances
Authorization: Bearer <access_token>

# Get specific balance
GET /api/wallet/balance/BTC
Authorization: Bearer <access_token>

# Withdraw
POST /api/wallet/withdraw
Authorization: Bearer <access_token>
Content-Type: application/json
{
  "symbol": "BTC",
  "amount": 0.1,
  "address": "bc1q...",
  "network": "BTC"
}
```

### Trading Endpoints (Requires Auth)

```bash
# Create order
POST /api/orders
Authorization: Bearer <access_token>
Content-Type: application/json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "amount": 0.001
}

# Get open orders
GET /api/orders
Authorization: Bearer <access_token>

# Cancel order
DELETE /api/orders/:orderId
Authorization: Bearer <access_token>
```

### Portfolio Endpoints (Requires Auth)

```bash
# Get portfolio
GET /api/portfolio
Authorization: Bearer <access_token>

# Get P&L
GET /api/portfolio/pnl
Authorization: Bearer <access_token>
```

### Market Data Endpoints (Public)

```bash
# Get all tickers
GET /api/market/tickers

# Get single ticker
GET /api/market/ticker/BTCUSDT

# Get order book
GET /api/market/orderbook/BTCUSDT?limit=20

# Get candlestick data
GET /api/market/klines/BTCUSDT?interval=1h&limit=100
```

## 🔌 WebSocket Usage

### Connect to WebSocket

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_access_token' // Optional for public channels
  }
});

// Subscribe to ticker updates
socket.emit('subscribe:ticker', 'BTCUSDT');

// Listen for updates
socket.on('ticker:update', (data) => {
  console.log('Price update:', data);
});

// Subscribe to user orders (requires authentication)
socket.emit('subscribe:orders');
socket.on('orders:update', (order) => {
  console.log('Order update:', order);
});
```

## 🗂️ Project Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/              # Authentication
│   │   ├── users/             # User management
│   │   ├── wallet/            # Wallet operations
│   │   ├── orders/            # Trading orders
│   │   ├── portfolio/         # Portfolio tracking
│   │   └── market/            # Market data
│   ├── common/
│   │   ├── middlewares/       # Express middlewares
│   │   ├── utils/             # Utility functions
│   │   └── validators/        # Input validators
│   ├── config/                # Configuration
│   ├── websocket/             # WebSocket server
│   ├── workers/               # Background jobs
│   └── server.ts              # Main server
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## 🔒 Security Features

- JWT authentication with short-lived access tokens
- Refresh token rotation
- Password hashing with bcrypt
- Rate limiting on sensitive endpoints
- Input validation with Joi
- Helmet.js for security headers
- CORS configuration
- SQL injection prevention (Prisma ORM)

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## 📊 Background Workers

The worker service handles:

- Daily earn rewards calculation (00:00 UTC)
- Portfolio snapshots (00:05 UTC)
- Expired token cleanup (hourly)
- Old refresh token cleanup (daily)

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run worker          # Start worker service

# Database
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run migrations
npm run prisma:seed     # Seed database

# Build & Production
npm run build           # Build TypeScript
npm start               # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run format          # Format with Prettier
```

## 📈 Performance Optimization

- Redis caching for market data (1-5 seconds TTL)
- Database query optimization with Prisma
- Connection pooling
- Rate limiting to protect resources
- Efficient WebSocket event handling

## 🚧 Roadmap

**Phase 1 - MVP (Current)**
- ✅ Authentication & User Management
- ✅ Wallet & Trading System
- ✅ Portfolio Tracking
- ✅ Market Data Proxy
- ✅ WebSocket Support

**Phase 2 - Enhanced Features**
- [ ] KYC Verification System
- [ ] Fiat to Crypto (Payment Integration)
- [ ] Earn Products (Staking)
- [ ] Admin Panel
- [ ] Email Notifications

**Phase 3 - Advanced**
- [ ] Margin Trading
- [ ] Futures Trading
- [ ] Advanced Order Types
- [ ] API Rate Plans
- [ ] Mobile App Support

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

ISC License

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@cryptoexchange.com

## ⚠️ Disclaimer

This is a demo/educational project. Do not use in production without proper security audits and compliance checks. Trading cryptocurrencies carries risks.

---

Built with ❤️ using Node.js, TypeScript, Express, Prisma, PostgreSQL, and Redis

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../common/utils/auth.utils';
import logger from '../config/logger';
import axios from 'axios';
import config from '../config';
import { setSocketIO } from './notificationHandler';

type AuthSocket = Socket & {
  userId?: string;
};

export class WebSocketServer {
  private io: Server;
  // private binanceWs: any;
  private subscribedSymbols: Set<string> = new Set();

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.nodeEnv === 'development' 
          ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'] 
          : [config.frontendUrl],
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Set Socket.IO instance for notification handler
    setSocketIO(this.io);

    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket: AuthSocket, next: any) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        // Allow connection without auth for public channels
        return next();
      }

      try {
        const decoded = verifyAccessToken(token);
        socket.userId = decoded.userId;
        next();
      } catch (error) {
        logger.error('WebSocket auth error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupHandlers() {
    this.io.on('connection', (socket: AuthSocket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Subscribe to ticker updates
      socket.on('subscribe:ticker', (symbol: string | any) => {
        if (!symbol || typeof symbol !== 'string') return;
        const room = `ticker:${symbol.toUpperCase()}`;
        socket.join(room);
        logger.info(`Client ${socket.id} subscribed to ${room}`);

        // Start streaming from Binance if not already streaming
        this.subscribeToBinance(symbol.toUpperCase());
      });

      // Unsubscribe from ticker
      socket.on('unsubscribe:ticker', (symbol: string | any) => {
        if (!symbol || typeof symbol !== 'string') return;
        const room = `ticker:${symbol.toUpperCase()}`;
        socket.leave(room);
        logger.info(`Client ${socket.id} unsubscribed from ${room}`);
      });

      // Subscribe to orderbook updates
      socket.on('subscribe:orderbook', (symbol: string | any) => {
        if (!symbol || typeof symbol !== 'string') return;
        const room = `orderbook:${symbol.toUpperCase()}`;
        socket.join(room);
        logger.info(`Client ${socket.id} subscribed to ${room}`);
        
        // Start streaming from Binance if not already streaming
        this.subscribeToBinance(symbol.toUpperCase());
      });

      // Subscribe to trades
      socket.on('subscribe:trades', (symbol: string | any) => {
        if (!symbol || typeof symbol !== 'string') return;
        const room = `trades:${symbol.toUpperCase()}`;
        socket.join(room);
        logger.info(`Client ${socket.id} subscribed to ${room}`);
        
        // Start streaming from Binance if not already streaming
        this.subscribeToBinance(symbol.toUpperCase());
      });

      // Private channels - require authentication
      if (socket.userId) {
        // Auto-join user room for notifications
        socket.join(`user:${socket.userId}`);
        logger.info(`User ${socket.userId} auto-joined notification room`);

        // Subscribe to user notifications (explicit)
        socket.on('subscribe:notifications', () => {
          const room = `user:${socket.userId}`;
          socket.join(room);
          logger.info(`User ${socket.userId} subscribed to notifications`);
        });

        // Subscribe to user orders
        socket.on('subscribe:orders', () => {
          const room = `user:${socket.userId}:orders`;
          socket.join(room);
          logger.info(`User ${socket.userId} subscribed to orders`);
        });

        // Subscribe to user portfolio
        socket.on('subscribe:portfolio', () => {
          const room = `user:${socket.userId}:portfolio`;
          socket.join(room);
          logger.info(`User ${socket.userId} subscribed to portfolio`);
        });

        // Subscribe to user wallet
        socket.on('subscribe:wallet', () => {
          const room = `user:${socket.userId}:wallet`;
          socket.join(room);
          logger.info(`User ${socket.userId} subscribed to wallet`);
        });
      }

      // Heartbeat
      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  private async subscribeToBinance(symbol: string) {
    if (this.subscribedSymbols.has(symbol)) {
      return; // Already subscribed
    }

    this.subscribedSymbols.add(symbol);

    // Use Binance REST API polling instead of WebSocket for simplicity
    // In production, use Binance WebSocket streams
    const pollInterval = setInterval(async () => {
      try {
        // Fetch ticker data
        const tickerResponse = await axios.get(`${config.binance.apiUrl}/api/v3/ticker/24hr`, {
          params: { symbol },
        });

        const tickerData = {
          symbol: tickerResponse.data.symbol,
          price: parseFloat(tickerResponse.data.lastPrice),
          priceChange: parseFloat(tickerResponse.data.priceChange),
          priceChangePercent: parseFloat(tickerResponse.data.priceChangePercent),
          high: parseFloat(tickerResponse.data.highPrice),
          low: parseFloat(tickerResponse.data.lowPrice),
          volume: parseFloat(tickerResponse.data.volume),
          timestamp: Date.now(),
        };

        this.io.to(`ticker:${symbol}`).emit('ticker:update', tickerData);

        // Fetch and emit orderbook data
        const orderbookResponse = await axios.get(`${config.binance.apiUrl}/api/v3/depth`, {
          params: { symbol, limit: 20 },
        });

        const orderbookData = {
          symbol,
          bids: orderbookResponse.data.bids.map((bid: any) => ({
            price: parseFloat(bid[0]),
            quantity: parseFloat(bid[1]),
          })),
          asks: orderbookResponse.data.asks.map((ask: any) => ({
            price: parseFloat(ask[0]),
            quantity: parseFloat(ask[1]),
          })),
          timestamp: Date.now(),
        };

        this.io.to(`orderbook:${symbol}`).emit('orderbook:update', orderbookData);

        // Fetch and emit recent trades data
        const tradesResponse = await axios.get(`${config.binance.apiUrl}/api/v3/trades`, {
          params: { symbol, limit: 30 },
        });

        const tradesData = {
          symbol,
          trades: tradesResponse.data.map((trade: any) => ({
            id: trade.id,
            price: parseFloat(trade.price),
            quantity: parseFloat(trade.qty),
            time: trade.time,
            isBuyerMaker: trade.isBuyerMaker,
          })),
          timestamp: Date.now(),
        };

        this.io.to(`trades:${symbol}`).emit('trades:update', tradesData);

      } catch (error) {
        logger.error(`Error polling ${symbol}:`, error);
      }
    }, 1500); // Poll every 1.5 seconds for better real-time experience

    // Store interval for cleanup
    (this as any)[`poll_${symbol}`] = pollInterval;
  }

  // Emit user-specific events
  public emitToUser(userId: string, event: string, data: any) {
    const room = `user:${userId}:${event.split(':')[0]}`;
    this.io.to(room).emit(event, data);
  }

  // Emit order update
  public emitOrderUpdate(userId: string, order: any) {
    this.emitToUser(userId, 'orders:update', order);
  }

  // Emit portfolio update
  public emitPortfolioUpdate(userId: string, portfolio: any) {
    this.emitToUser(userId, 'portfolio:update', portfolio);
  }

  // Emit wallet update
  public emitWalletUpdate(userId: string, wallet: any) {
    this.emitToUser(userId, 'wallet:update', wallet);
  }

  // Broadcast to all clients
  public broadcast(event: string, data: any) {
    this.io.emit(event, data);
  }
}

let websocketServer: WebSocketServer;

export const initWebSocket = (httpServer: HTTPServer): WebSocketServer => {
  websocketServer = new WebSocketServer(httpServer);
  return websocketServer;
};

export const getWebSocketServer = (): WebSocketServer => {
  return websocketServer;
};

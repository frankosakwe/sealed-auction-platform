// Initialize APM (MUST be the first line)
const apm = require('elastic-apm-node').start({
  serviceName: process.env.APM_SERVICE_NAME || 'sealed-auction-platform',
  secretToken: process.env.APM_SECRET_TOKEN || '',
  serverUrl: process.env.APM_SERVER_URL || 'http://localhost:8200',
  environment: process.env.NODE_ENV || 'development'
});

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Sentry = require('@sentry/node');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Horizon, Keypair, TransactionBuilder, Networks, BASE_FEE, Asset } = require('@stellar/stellar-sdk');
const session = require('express-session');
const passport = require('passport');
const AuctionDatabase = require('./database');
const { ApplicationMetrics, createMetricsMiddleware } = require('./utils/metrics');
const NetworkMonitor = require('./utils/network-monitor');
const { TransactionQueue, PRIORITY, STATUS } = require('./utils/transaction-queue');
const { WalletManager, SECURITY_LEVELS, WALLET_TYPES } = require('./utils/wallet-manager');
const { BlockchainAnalytics, AGGREGATION_INTERVALS, METRIC_TYPES } = require('./utils/blockchain-analytics');

// Initialize database
const db = new AuctionDatabase();

// Initialize network monitor
const networkMonitor = new NetworkMonitor();

// Initialize transaction queue
const transactionQueue = new TransactionQueue({
  networkMonitor: networkMonitor,
  maxQueueSize: 10000,
  batchSize: 10,
  batchTimeout: 5000,
  maxRetries: 3,
  gasOptimization: true
});

// Initialize wallet manager
const walletManager = new WalletManager({
  maxWallets: 50,
  defaultSecurityLevel: SECURITY_LEVELS.STANDARD,
  autoLockTimeout: 300000,
  autoBackup: true,
  backupInterval: 86400000
});

// Initialize blockchain analytics
const blockchainAnalytics = new BlockchainAnalytics({
  cacheTimeout: 300000,
  batchSize: 1000,
  maxCacheSize: 10000
});

const app = express();
const server = http.createServer(app);
const appMetrics = new ApplicationMetrics();
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const sentryDsn = process.env.SENTRY_DSN;
const sentryEnabled = Boolean(sentryDsn);

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)
  });

  app.use(Sentry.Handlers.requestHandler());
  console.log('Sentry error tracking enabled.');
} else {
  console.log('Sentry disabled (set SENTRY_DSN to enable error tracking).');
}

function trackError(error, context = {}) {
  if (sentryEnabled) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  }

  if (apm && typeof apm.captureError === 'function') {
    apm.captureError(error, { custom: context });
  }
}

function logError(message, error, context = {}) {
  console.error(message, error);
  trackError(error, { message, ...context });
}

// Security middleware
app.use(helmet());
app.use(createMetricsMiddleware(appMetrics));

// Security monitoring endpoint (admin only)
app.get('/api/security/stats', (req, res) => {
  try {
    // In production, add admin authentication here
    const stats = db.getSecurityStats();
    res.json(stats);
  } catch (error) {
    logError('Error getting security stats:', error, { endpoint: '/api/security/stats' });
    res.status(500).json({ error: 'Failed to get security stats' });
  }
});

app.get('/api/security/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    // In production, add admin authentication here
    const logs = db.getQueryLog(limit);
    res.json(logs);
  } catch (error) {
    logError('Error getting query logs:', error, { endpoint: '/api/security/logs' });
    res.status(500).json({ error: 'Failed to get query logs' });
  }
});

// Application metrics endpoints
app.get('/api/monitoring/metrics', (req, res) => {
  try {
    res.json(appMetrics.getSnapshot());
  } catch (error) {
    console.error('Error getting application metrics:', error);
    res.status(500).json({ error: 'Failed to get application metrics' });
  }
});

app.get('/api/monitoring/metrics/prometheus', (req, res) => {
  try {
    res.type('text/plain');
    res.send(appMetrics.toPrometheus());
  } catch (error) {
    console.error('Error getting prometheus metrics:', error);
    res.status(500).json({ error: 'Failed to get prometheus metrics' });
  }
});

// Restrictive CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json());

// Performance optimization middleware
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// Enhanced static file serving with caching
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set different cache durations for different file types
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    } else if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (path.endsWith('.woff') || path.endsWith('.woff2')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Session middleware for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const tokenBlacklist = new Set();

// Import validation middleware
const { validateRequest } = require('./utils/validation');
const { validateSchema } = require('./utils/schema-validation');

// Tiered rate limiting configuration
// Strict limits for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate limits for bid operations
const bidLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    error: 'Too many bid operations, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Higher limits for read operations
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict limits for auction creation
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 auction creations per hour
  message: {
    error: 'Too many auction creations, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter as fallback
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Backup directory
const backupDir = path.join(__dirname, 'backups');

// In-memory storage (in production, use a proper database)
let auctions = new Map();
let bids = new Map();
let users = new Map();

// Auction class
class Auction {
  constructor(id, title, description, startingBid, endTime, creator) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.startingBid = startingBid;
    this.currentHighestBid = startingBid;
    this.endTime = endTime;
    this.creator = creator;
    this.status = 'active';
    this.bids = [];
    this.winner = null;
    this.winningBid = null;
    this.createdAt = new Date();
  }

  addBid(bid) {
    this.bids.push(bid);
    if (bid.amount > this.currentHighestBid) {
      this.currentHighestBid = bid.amount;
    }
  }

  close() {
    this.status = 'closed';
    if (this.bids.length > 0) {
      const winningBid = this.bids.reduce((prev, current) => 
        prev.amount > current.amount ? prev : current
      );
      this.winner = winningBid.bidderId;
      this.winningBid = winningBid;
    }
  }
}

// Bid class
class Bid {
  constructor(id, auctionId, bidderId, amount, encryptedBid) {
    this.id = id;
    this.auctionId = auctionId;
    this.bidderId = bidderId;
    this.amount = amount;
    this.encryptedBid = encryptedBid;
    this.timestamp = new Date();
    this.revealed = false;
  }
}

// User class
class User {
  constructor(id, username, hashedPassword, email = null, provider = null, providerId = null) {
    this.id = id;
    this.username = username;
    this.hashedPassword = hashedPassword;
    this.email = email;
    this.provider = provider;
    this.providerId = providerId;
    this.createdAt = new Date();
  }
}

// Helper functions
function generateAuctionId() {
  return uuidv4();
}

// Admin Authentication Middleware
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Admin access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Check if user has admin or moderator role
    const dbUser = db.getUserById(user.id);
    if (!dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'moderator')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    req.userRole = dbUser.role;
    next();
  });
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Account Lockout Middleware
function checkAccountLockout(req, res, next) {
  const user = db.getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (db.isAccountLocked(user.username)) {
    return res.status(423).json({ 
      error: 'Account is temporarily locked due to too many failed login attempts',
      lockedUntil: user.locked_until
    });
  }

  next();
}

// Generate JWT Token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function encryptBid(bidAmount, secretKey) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(bidAmount.toString(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex')
  };
}

// --- Content Negotiation Helpers ---
function toXML(obj, root = 'response') {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n`;
  const processValue = (val, level) => {
    let s = '';
    const indent = '  '.repeat(level);
    if (Array.isArray(val)) {
      val.forEach(item => {
        s += `${indent}<item>\n${processValue(item, level + 1)}${indent}</item>\n`;
      });
    } else if (typeof val === 'object' && val !== null) {
      for (const [k, v] of Object.entries(val)) {
        s += `${indent}<${k}>${processValue(v, level + 1).trim()}</${k}>\n`;
      }
    } else {
      s += `${val}`;
    }
    return s;
  };
  xml += processValue(obj, 1);
  xml += `</${root}>`;
  return xml;
}

function toYAML(obj, indent = 0) {
  let yaml = '';
  const spaces = ' '.repeat(indent);
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      value.forEach(item => {
        yaml += `${spaces}  - `;
        if (typeof item === 'object' && item !== null) {
          yaml += toYAML(item, indent + 4).trimStart();
        } else {
          yaml += `${item}\n`;
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      yaml += `${spaces}${key}:\n${toYAML(value, indent + 2)}`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }
  return yaml;
}

// Content negotiation middleware
app.use((req, res, next) => {
  res.sendData = (data, root = 'response') => {
    const accept = req.headers.accept || '';
    if (accept.includes('application/xml')) {
      res.type('application/xml');
      return res.send(toXML(data, root));
    } else if (accept.includes('text/yaml') || accept.includes('application/yaml')) {
      res.type('text/yaml');
      return res.send(toYAML(data));
    }
    res.json(data);
  };
  next();
});

function decryptBid(encryptedData, secretKey) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = Buffer.from(encryptedData.iv, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return parseFloat(decrypted);
}

// --- Backup and Restore ---
function backupData() {
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    fs.writeFileSync(path.join(backupDir, 'auctions.json'), JSON.stringify(Array.from(auctions.entries()), null, 2));
    fs.writeFileSync(path.join(backupDir, 'bids.json'), JSON.stringify(Array.from(bids.entries()), null, 2));
    fs.writeFileSync(path.join(backupDir, 'users.json'), JSON.stringify(Array.from(users.entries()), null, 2));
    console.log(`[${new Date().toISOString()}] Data backup successful.`);
  } catch (error) {
    logError('Data backup failed:', error, { operation: 'backupData' });
  }
}

function restoreData() {
  try {
    const auctionsPath = path.join(backupDir, 'auctions.json');
    if (fs.existsSync(auctionsPath)) {
      const data = JSON.parse(fs.readFileSync(auctionsPath));
      const restoredAuctions = data.map(([id, plainAuction]) => {
        const auction = Object.assign(new Auction(), plainAuction);
        auction.endTime = new Date(auction.endTime);
        auction.createdAt = new Date(auction.createdAt);
        auction.bids = auction.bids.map(plainBid => Object.assign(new Bid(), plainBid));
        return [id, auction];
      });
      auctions = new Map(restoredAuctions);
      console.log(`Restored ${auctions.size} auctions from backup.`);
    }

    const bidsPath = path.join(backupDir, 'bids.json');
    if (fs.existsSync(bidsPath)) {
      const data = JSON.parse(fs.readFileSync(bidsPath));
      const restoredBids = data.map(([id, plainBid]) => {
        const bid = Object.assign(new Bid(), plainBid);
        bid.timestamp = new Date(bid.timestamp);
        return [id, bid];
      });
      bids = new Map(restoredBids);
      console.log(`Restored ${bids.size} bids from backup.`);
    }

    const usersPath = path.join(backupDir, 'users.json');
    if (fs.existsSync(usersPath)) {
      const data = JSON.parse(fs.readFileSync(usersPath));
      const restoredUsers = data.map(([id, plainUser]) => {
        const user = Object.assign(new User(), plainUser);
        user.createdAt = new Date(user.createdAt);
        return [id, user];
      });
      users = new Map(restoredUsers);
      console.log(`Restored ${users.size} users from backup.`);
    }
  } catch (error) {
    logError('Failed to restore data from backup. Starting with a clean state.', error, { operation: 'restoreData' });
    auctions = new Map();
    bids = new Map();
    users = new Map();
  }
}

// Restore data on startup
restoreData();

// Routes
app.get('/api/auctions', 
  readLimiter,
  validateSchema('auctionsQuery'),
  validateRequest.query({
    page: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'status' }
  }),
  (req, res) => {
  try {
    const { page = 1, limit = 10, status = null } = req.sanitizedQuery || {};
    
    // Additional validation for limit to prevent excessive data loading
    const validatedLimit = Math.min(limit, 100);
    
    const result = db.getPaginatedAuctions(page, validatedLimit, status);
    
    const auctionList = result.auctions.map(auction => ({
      id: auction.id,
      title: auction.title,
      description: auction.description,
      startingBid: auction.starting_bid,
      currentHighestBid: auction.current_highest_bid || auction.starting_bid,
      endTime: auction.end_time,
      status: auction.status,
      bidCount: db.getBidCount(auction.id),
      creator: auction.creator_id,
      _links: {
        self: { href: `/api/auctions/${auction.id}` },
        bids: { href: `/api/auctions/${auction.id}/bids` },
        close: { href: `/api/auctions/${auction.id}`, method: 'PATCH' }
      }
    }));
    
    res.sendData({
      auctions: auctionList,
      pagination: result.pagination,
      _links: {
        self: { href: `/api/auctions?page=${page}&limit=${validatedLimit}` + (status ? `&status=${status}` : '') }
      }
    }, 'auctionsResponse');
  } catch (error) {
    logError('Error fetching auctions:', error, { endpoint: '/api/auctions', method: 'GET' });
    res.status(500).sendData({ error: 'Failed to fetch auctions' });
  }
});

app.post('/api/auctions', 
  authenticateToken,
  checkAccountLockout,
  createLimiter,
  validateSchema('createAuction'),
  validateRequest.body({
    title: { type: 'title', required: true },
    description: { type: 'description', required: true },
    startingBid: { type: 'bidAmount', required: true, minimumBid: 0.01 },
    endTime: { type: 'date', required: true, allowPast: false }
  }),
  async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description, startingBid, endTime } = req.sanitizedBody;
    
    // Check if user exists
    const user = db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const auctionId = generateAuctionId();
    
    // Create auction in database
    db.createAuction({
      id: auctionId,
      title,
      description,
      startingBid,
      endTime,
      creator: userId,
      status: 'active'
    });
    
    // Also create in-memory for compatibility
    const auction = new Auction(auctionId, title, description, startingBid, new Date(endTime), userId);
    auctions.set(auctionId, auction);
    
    const responseData = {
      ...auction,
      _links: {
        self: { href: `/api/auctions/${auctionId}` },
        bids: { href: `/api/auctions/${auctionId}/bids` },
        close: { href: `/api/auctions/${auctionId}`, method: 'PATCH' }
      }
    };
    
    io.emit('auctionCreated', auction);
    io.to('dashboard').emit('auction_update', { type: 'auction', data: auction });
    res.status(201).sendData(responseData, 'auctionCreated');
  } catch (error) {
    logError('Auction creation failed:', error, { endpoint: '/api/auctions', method: 'POST' });
    res.status(500).sendData({ error: 'Failed to create auction' });
  }
});

app.get('/api/auctions/:id', 
  readLimiter,
  validateSchema('auctionIdParam'),
  validateRequest.params({
    id: { type: 'uuid', required: true }
  }),
  (req, res) => {
  try {
    const auctionId = req.sanitizedParams.id;
    
    const auctionDb = db.getAuction(auctionId);
    if (!auctionDb) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    res.sendData({
      id: auctionDb.id,
      title: auctionDb.title,
      description: auctionDb.description,
      startingBid: auctionDb.starting_bid,
      currentHighestBid: auctionDb.current_highest_bid || auctionDb.starting_bid,
      endTime: auctionDb.end_time,
      status: auctionDb.status,
      bidCount: db.getBidCount(auctionId),
      creator: auctionDb.creator_id,
      _links: {
        self: { href: `/api/auctions/${auctionDb.id}` },
        bids: { href: `/api/auctions/${auctionDb.id}/bids` },
        close: { href: `/api/auctions/${auctionDb.id}`, method: 'PATCH' }
      }
    }, 'auctionDetails');
  } catch (error) {
    logError('Error fetching auction:', error, { endpoint: '/api/auctions/:id', method: 'GET' });
    res.status(500).sendData({ error: 'Failed to fetch auction' });
  }
});

app.post('/api/auctions/:id/bids', 
  authenticateToken,
  checkAccountLockout,
  bidLimiter,
  validateSchema('placeBid'),
  validateRequest.body({
    amount: { type: 'bidAmount', required: true, minimumBid: 0.01 },
    secretKey: { type: 'secretKey', required: true }
  }),
  validateRequest.params({
    id: { type: 'uuid', required: true }
  }),
  async (req, res) => {
  try {
    const auctionId = req.sanitizedParams.id;
    const bidderId = req.user.userId;
    const { amount, secretKey } = req.sanitizedBody;
    
    const auctionDb = db.getAuction(auctionId);
    if (!auctionDb) {
      return res.status(404).sendData({ error: 'Auction not found' });
    }

    if (auctionDb.status !== 'active') {
      return res.status(400).sendData({ error: 'Auction is not active' });
    }

    // Validate bid amount against current highest bid
    const minimumBid = Math.max(auctionDb.starting_bid, auctionDb.current_highest_bid || auctionDb.starting_bid);
    if (amount <= minimumBid) {
      return res.status(400).sendData({ error: `Bid must be higher than ${minimumBid}` });
    }

    const encryptedBid = encryptBid(amount, secretKey);
    const bidId = uuidv4();
    const bid = new Bid(bidId, auctionId, bidderId, amount, encryptedBid);
    
    // Save bid to database
    db.createBid({
      id: bidId,
      auctionId,
      bidderId,
      amount,
      encryptedBid
    });
    
    // Update auction's current highest bid
    db.updateAuction(auctionId, { current_highest_bid: amount });
    
    // Also update in-memory for compatibility
    const auction = auctions.get(auctionId);
    if (auction) {
      auction.addBid(bid);
    }
    
    io.emit('bidPlaced', { auctionId, bidCount: auction ? auction.bids.length : 1 });
    
    // Send detailed bid data to dashboard
    const bidData = {
      id: bidId,
      auction_id: auctionId,
      amount: amount,
      timestamp: new Date().toISOString(),
      bidder_id: req.user?.id || 'anonymous'
    };
    io.to('dashboard').emit('bid_update', { type: 'bid', data: bidData });
    res.status(201).sendData({ 
      message: 'Bid placed successfully', 
      bidId,
      _links: {
        self: { href: `/api/auctions/${auctionId}/bids` },
        auction: { href: `/api/auctions/${auctionId}` }
      }
    }, 'bidPlaced');
  } catch (error) {
    logError('Bid placement failed:', error, { endpoint: '/api/auctions/:id/bids', method: 'POST' });
    res.status(500).sendData({ error: 'Failed to place bid' });
  }
});

// Use PATCH for updating auction state (RESTful)
app.patch('/api/auctions/:id', 
  authenticateToken,
  bidLimiter,
  validateSchema('auctionIdParam'),
  validateRequest.params({
    id: { type: 'uuid', required: true }
  }),
  (req, res) => {
  try {
    const auctionId = req.sanitizedParams.id;
    const { status } = req.body;

    if (status !== 'closed') {
      return res.status(400).sendData({ error: 'Only closing auctions is currently supported via this endpoint' });
    }
    
    const auctionDb = db.getAuction(auctionId);
    if (!auctionDb) {
      return res.status(404).sendData({ error: 'Auction not found' });
    }

    if (auctionDb.status === 'closed') {
      return res.status(400).sendData({ error: 'Auction is already closed' });
    }

    // Permission check: only creator can close
    if (auctionDb.creator_id !== req.user.userId) {
      return res.status(403).sendData({ error: 'Only the creator can close this auction' });
    }

    // Get all bids and find winner
    const allBids = db.getBidsForAuction(auctionId);
    let winnerId = null;
    let winningBidId = null;
    
    if (allBids.length > 0) {
      const highestBid = allBids[0]; // Already ordered by amount DESC
      winnerId = highestBid.bidder_id;
      winningBidId = highestBid.id;
    }
    
    // Update auction in database
    db.closeAuction(auctionId, winnerId, winningBidId);
    
    // Update in-memory
    const auction = auctions.get(auctionId);
    if (auction) {
      auction.close();
    }
    
    const responseData = { 
      ...auctionDb, 
      status: 'closed', 
      winner: winnerId, 
      winningBid: winningBidId,
      _links: {
        self: { href: `/api/auctions/${auctionId}` },
        bids: { href: `/api/auctions/${auctionId}/bids` }
      }
    };
    io.emit('auctionClosed', responseData);
    io.to('dashboard').emit('auction_update', { type: 'auction', data: responseData });
    res.sendData(responseData, 'auctionClosed');
  } catch (error) {
    logError('Error closing auction:', error, { endpoint: '/api/auctions/:id', method: 'PATCH' });
    res.status(500).sendData({ error: 'Failed to close auction' });
  }
});

// ODHUNTER: Kept only PATCH endpoint and removed legacy /api/auctions/:id/close and /api/auctions/:id/bid
app.post('/api/users', 
  authLimiter,
  validateSchema('registerUser'),
  validateRequest.body({
    username: { type: 'username', required: true },
    password: { type: 'password', required: true }
  }),
  async (req, res) => {
  try {
    const { username, password } = req.sanitizedBody;
    
    // Check if user already exists
    const existingUser = db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const userId = uuidv4();
    // Create user in database
    db.createUser(userId, username, password);
    
    res.status(201).sendData({ 
      userId, 
      username,
      message: 'User registered successfully',
      _links: {
        login: { href: '/api/auth/login', method: 'POST' }
      }
    }, 'userRegistered');
  } catch (error) {
    logError('Error registering user:', error, { endpoint: '/api/users', method: 'POST' });
    res.status(500).sendData({ error: 'Failed to register user' });
  }
});

// ODHUNTER: Removed legacy /api/users/login and using the standard RESTful endpoint instead
app.post('/api/auth/login', 
  authLimiter,
  validateSchema('loginUser'),
  validateRequest.body({
    username: { type: 'string', required: true },
    password: { type: 'string', required: true }
  }),
  async (req, res) => {
  try {
    const { username, password } = req.sanitizedBody;
    
    if (db.isAccountLocked(username)) {
      const user = db.getUserByUsername(username);
      const lockedUntil = user ? new Date(user.locked_until) : null;
      return res.status(423).sendData({ 
        error: 'Account is temporarily locked due to too many failed login attempts',
        lockedUntil: lockedUntil ? lockedUntil.toISOString() : null
      });
    }
    
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).sendData({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.hashed_password);
    if (!isValid) {
      db.incrementFailedLoginAttempts(username);
      const updatedUser = db.getUserByUsername(username);
      const MAX_FAILED_ATTEMPTS = 5;
      
      if (updatedUser && updatedUser.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
        db.lockAccount(username, 30);
        return res.status(423).sendData({ 
          error: 'Account has been locked due to too many failed login attempts',
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });
      }
      
      return res.status(401).sendData({ error: 'Invalid credentials' });
    }

    db.resetFailedLoginAttempts(username);
    const token = generateToken(user);
    
    res.sendData({ 
      id: user.id, 
      userId: user.id,
      username: user.username,
      role: user.role,
      token: token,
      expiresIn: '24h',
      _links: {
        verify: { href: '/api/auth/verify', method: 'GET' },
        auctions: { href: '/api/auctions', method: 'GET' }
      }
    }, 'loginResponse');
  } catch (error) {
    logError('Error logging in user:', error, { endpoint: '/api/auth/login', method: 'POST' });
    res.status(500).sendData({ error: 'Failed to login' });
  }
});

// ODHUNTER: Removed legacy /api/users/logout and using the standard RESTful endpoint instead
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      tokenBlacklist.add(token);
    }
    
    res.sendData({ 
      message: 'Logged out successfully',
      _links: {
        login: { href: '/api/auth/login', method: 'POST' }
      }
    }, 'logoutResponse');
  } catch (error) {
    res.status(500).sendData({ error: 'Failed to logout' });
  }
});

// ODHUNTER: Removed legacy /api/users/verify and using the standard RESTful endpoint instead
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.sendData({ 
    valid: true, 
    user: { 
      userId: req.user.userId, 
      username: req.user.username 
    },
    _links: {
      self: { href: '/api/auth/verify', method: 'GET' },
      logout: { href: '/api/auth/logout', method: 'POST' }
    }
  }, 'verifyResponse');
});

// Account lockout status endpoint
app.get('/api/users/lockout-status', 
  validateSchema('lockoutStatus'),
  validateRequest.query({
    username: { type: 'string', required: true }
  }),
  (req, res) => {
  try {
    const { username } = req.sanitizedQuery;
    
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isLocked = db.isAccountLocked(username);
    
    res.json({
      username: user.username,
      isLocked,
      failedLoginAttempts: user.failed_login_attempts || 0,
      lastFailedLogin: user.last_failed_login,
      lockedUntil: user.locked_until,
      _links: {
        self: { href: `/api/users/lockout-status?username=${username}` }
      }
    });
  } catch (error) {
    logError('Error checking lockout status:', error, { endpoint: '/api/users/lockout-status', method: 'GET' });
    res.status(500).json({ error: 'Failed to check lockout status' });
  }
});

// OAuth Routes (requires passport configuration)
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/?token=${token}&username=${req.user.username}`);
  }
);

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/?token=${token}&username=${req.user.username}`);
  }
);

// OAuth status endpoint
app.get('/api/auth/status', (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    github: !!process.env.GITHUB_CLIENT_ID,
    _links: {
      self: { href: '/api/auth/status' },
      login: { href: '/api/auth/login', method: 'POST' }
    }
  });
});

// Admin Dashboard API endpoints

// Dashboard statistics
app.get('/api/admin/dashboard/stats', authenticateAdmin, (req, res) => {
  try {
    const stats = db.getSystemStats();
    const securityAlerts = db.getSecurityAlerts(1, 10, { status: 'open' });

    res.json({
      ...stats,
      security: {
        openAlerts: securityAlerts.total,
        criticalAlerts: securityAlerts.alerts.filter(alert => alert.severity === 'critical').length
      }
    });
  } catch (error) {
    logError('Error getting admin dashboard stats:', error, { endpoint: '/api/admin/dashboard/stats' });
    res.status(500).json({ error: 'Failed to get dashboard statistics' });
  }
});

// User management endpoints
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      role: req.query.role,
      status: req.query.status,
      search: req.query.search
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const result = db.getAllUsers(page, limit, filters);
    
    res.json(result);
  } catch (error) {
    logError('Error getting users:', error, { endpoint: '/api/admin/users' });
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.patch('/api/admin/users/:id/role', authenticateAdmin, (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Update user role
    const success = db.updateUserRole(userId, role, req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    logError('Error updating user role:', error, { endpoint: '/api/admin/users/:id/role' });
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

app.patch('/api/admin/users/:id/status', authenticateAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    // Toggle user status
    const success = db.toggleUserStatus(userId, req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    logError('Error updating user status:', error, { endpoint: '/api/admin/users/:id/status' });
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Auction moderation endpoints
app.get('/api/admin/auctions', authenticateAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status,
      search: req.query.search
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const result = db.getAllAuctionsForAdmin(page, limit, filters);
    
    res.json(result);
  } catch (error) {
    logError('Error getting auctions for moderation:', error, { endpoint: '/api/admin/auctions' });
    res.status(500).json({ error: 'Failed to get auctions' });
  }
});

app.patch('/api/admin/auctions/:id/status', authenticateAdmin, (req, res) => {
  try {
    const { action, reason } = req.body;
    const auctionId = req.params.id;
    
    if (!['close', 'cancel', 'reopen'].includes(action)) {
      return res.status(400).json({ error: 'Invalid moderation action' });
    }

    // Moderate auction
    const success = db.moderateAuction(auctionId, action, req.user.id, reason);
    
    if (!success) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    res.json({ message: 'Auction status updated successfully' });
  } catch (error) {
    logError('Error updating auction status:', error, { endpoint: '/api/admin/auctions/:id/status' });
    res.status(500).json({ error: 'Failed to update auction status' });
  }
});

// Revenue tracking endpoints
app.get('/api/admin/revenue/stats', authenticateAdmin, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const revenueStats = db.getSystemStats().revenue;
    
    res.json(revenueStats);
  } catch (error) {
    logError('Error getting revenue stats:', error, { endpoint: '/api/admin/revenue/stats' });
    res.status(500).json({ error: 'Failed to get revenue statistics' });
  }
});

app.get('/api/admin/revenue/transactions', authenticateAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status,
      transaction_type: req.query.transaction_type
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const result = db.getRevenueTracking(page, limit, filters);
    
    res.json(result);
  } catch (error) {
    logError('Error getting revenue transactions:', error, { endpoint: '/api/admin/revenue/transactions' });
    res.status(500).json({ error: 'Failed to get revenue transactions' });
  }
});

// Security monitoring endpoints
app.get('/api/admin/security/alerts', authenticateAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      severity: req.query.severity,
      status: req.query.status
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const result = db.getSecurityAlerts(page, limit, filters);
    
    res.json(result);
  } catch (error) {
    logError('Error getting security alerts:', error, { endpoint: '/api/admin/security/alerts' });
    res.status(500).json({ error: 'Failed to get security alerts' });
  }
});

app.patch('/api/admin/security/alerts/:id/status', authenticateAdmin, (req, res) => {
  try {
    const { status, notes } = req.body;
    const alertId = req.params.id;
    
    if (!['open', 'investigating', 'resolved', 'false_positive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid alert status' });
    }

    // Update alert status
    const success = db.updateSecurityAlert(alertId, status, req.user.id, notes);
    
    if (!success) {
      return res.status(404).json({ error: 'Security alert not found' });
    }

    res.json({ message: 'Security alert status updated successfully' });
  } catch (error) {
    logError('Error updating security alert status:', error, { endpoint: '/api/admin/security/alerts/:id/status' });
    res.status(500).json({ error: 'Failed to update security alert status' });
  }
});

app.get('/api/admin/security/logs', authenticateAdmin, (req, res) => {
  try {
    const level = req.query.level;
    const limit = parseInt(req.query.limit) || 100;
    const logs = db.getSystemLogs(level, limit);
    
    res.json(logs);
  } catch (error) {
    logError('Error getting security logs:', error, { endpoint: '/api/admin/security/logs' });
    res.status(500).json({ error: 'Failed to get security logs' });
  }
});

// Configuration management endpoints
app.get('/api/admin/config', authenticateAdmin, (req, res) => {
  try {
    const category = req.query.category;
    const config = db.getSystemConfig(category);
    
    res.json(config);
  } catch (error) {
    logError('Error getting system config:', error, { endpoint: '/api/admin/config' });
    res.status(500).json({ error: 'Failed to get system configuration' });
  }
});

app.post('/api/admin/config', authenticateAdmin, (req, res) => {
  try {
    const { key, value, description, category, isPublic } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    // Create configuration
    const success = db.createSystemConfig(key, value, category || 'general', description, isPublic || false, req.user.id);
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to create configuration' });
    }

    res.json({ message: 'Configuration created successfully' });
  } catch (error) {
    logError('Error creating system config:', error, { endpoint: '/api/admin/config' });
    res.status(500).json({ error: 'Failed to create system configuration' });
  }
});

app.put('/api/admin/config/:key', authenticateAdmin, (req, res) => {
  try {
    const { value, description } = req.body;
    const key = req.params.key;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Update configuration
    const success = db.updateSystemConfig(key, value, req.user.id, description);
    
    if (!success) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    logError('Error updating system config:', error, { endpoint: '/api/admin/config/:key' });
    res.status(500).json({ error: 'Failed to update system configuration' });
  }
});

// Audit logs endpoint
app.get('/api/admin/audit/logs', authenticateAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      action: req.query.action,
      target_type: req.query.target_type,
      admin_id: req.query.admin_id
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
    
    const result = db.getAuditLogs(page, limit, filters);
    
    res.json(result);
  } catch (error) {
    logError('Error getting audit logs:', error, { endpoint: '/api/admin/audit/logs' });
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Social Sharing API endpoints

// Generate shareable content and track shares
app.post('/api/share', (req, res) => {
  try {
    const { auctionId, platform, customMessage, generateImage } = req.body;
    
    if (!auctionId || !platform) {
      return res.status(400).json({ error: 'Auction ID and platform are required' });
    }

    if (!['twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'email', 'copy_link'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Get auction details
    const auction = db.getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Generate share URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/auction/${auctionId}`;
    
    // Generate default message if custom message not provided
    let message = customMessage;
    if (!message) {
      message = `Check out this auction: "${auction.title}" - Starting bid: $${auction.starting_bid}`;
    }

    // Generate image if requested
    let imageGenerated = false;
    if (generateImage) {
      // This would integrate with an image generation service
      // For now, we'll just mark it as generated
      imageGenerated = true;
    }

    // Track the share
    const userId = req.user ? req.user.id : null;
    const shareResult = db.createSocialShare(
      auctionId,
      platform,
      shareUrl,
      message,
      imageGenerated,
      userId,
      req.ip,
      req.get('User-Agent')
    );

    // Generate platform-specific share URLs
    const encodedMessage = encodeURIComponent(message);
    const encodedUrl = encodeURIComponent(shareUrl);
    let platformUrl = '';

    switch (platform) {
      case 'twitter':
        platformUrl = `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`;
        break;
      case 'facebook':
        platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
        break;
      case 'linkedin':
        platformUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'whatsapp':
        platformUrl = `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`;
        break;
      case 'telegram':
        platformUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`;
        break;
      case 'email':
        platformUrl = `mailto:?subject=${encodeURIComponent(`Auction: ${auction.title}`)}&body=${encodedMessage}%20${encodedUrl}`;
        break;
      case 'copy_link':
        platformUrl = shareUrl;
        break;
    }

    res.json({
      shareId: shareResult.lastInsertRowid,
      platformUrl,
      shareUrl,
      message,
      imageGenerated
    });
  } catch (error) {
    logError('Error creating share:', error, { endpoint: '/api/share' });
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// Track share engagement
app.post('/api/share/:shareId/engage', (req, res) => {
  try {
    const { shareId } = req.params;
    const { engagementType, referrerUrl } = req.body;
    
    if (!['click', 'view', 'conversion'].includes(engagementType)) {
      return res.status(400).json({ error: 'Invalid engagement type' });
    }

    // Track engagement
    db.trackShareEngagement(
      shareId,
      engagementType,
      referrerUrl,
      req.ip,
      req.get('User-Agent')
    );

    res.json({ message: 'Engagement tracked successfully' });
  } catch (error) {
    logError('Error tracking engagement:', error, { endpoint: '/api/share/:shareId/engage' });
    res.status(500).json({ error: 'Failed to track engagement' });
  }
});

// Get share statistics for an auction
app.get('/api/auctions/:auctionId/shares/stats', (req, res) => {
  try {
    const { auctionId } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    const shareStats = db.getShareStats(auctionId, days);
    const engagementStats = db.getEngagementStats(null, days);
    
    res.json({
      shareStats,
      engagementStats
    });
  } catch (error) {
    logError('Error getting share stats:', error, { endpoint: '/api/auctions/:auctionId/shares/stats' });
    res.status(500).json({ error: 'Failed to get share statistics' });
  }
});

// Get share analytics (admin only)
app.get('/api/admin/shares/analytics', authenticateAdmin, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analytics = db.getShareAnalytics(days);
    const topAuctions = db.getTopSharedAuctions(10, days);
    
    res.json({
      analytics,
      topAuctions
    });
  } catch (error) {
    logError('Error getting share analytics:', error, { endpoint: '/api/admin/shares/analytics' });
    res.status(500).json({ error: 'Failed to get share analytics' });
  }
});

// Generate share image
app.post('/api/share/generate-image', async (req, res) => {
  try {
    const { auctionId, template } = req.body;
    
    if (!auctionId) {
      return res.status(400).json({ error: 'Auction ID is required' });
    }

    // Get auction details
    const auction = db.getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Generate image (simplified implementation)
    // In production, this would use a service like Canvas API, Sharp, or external image service
    const imageUrl = `/api/share/image/${auctionId}?template=${template || 'default'}`;
    
    res.json({
      imageUrl,
      generated: true
    });
  } catch (error) {
    logError('Error generating share image:', error, { endpoint: '/api/share/generate-image' });
    res.status(500).json({ error: 'Failed to generate share image' });
  }
});

// Dashboard analytics endpoint
app.get('/api/dashboard/data', (req, res) => {
  try {
    const auctions = db.getAllAuctions();
    const bids = [];
    
    // Collect all bids from all auctions
    auctions.forEach(auction => {
      const auctionBids = db.getBidsForAuction(auction.id);
      bids.push(...auctionBids);
    });
    
    // Get revenue data
    const revenue = [];
    try {
      // Simulate revenue data from database (you may need to add this method to database.js)
      const stmt = db.db.prepare('SELECT * FROM revenue_tracking ORDER BY created_at DESC');
      const revenueData = stmt.all();
      revenue.push(...revenueData);
    } catch (error) {
      console.warn('Revenue tracking table not found or empty:', error.message);
    }
    
    res.json({
      success: true,
      data: {
        auctions,
        bids,
        revenue
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// ==================== BOOKMARK MANAGEMENT API ENDPOINTS ====================

// Get all bookmarks for a user
app.get('/api/bookmarks', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId, type, isFavorite, search, tags, limit } = req.query;
    
    const options = {};
    if (folderId !== undefined) options.folderId = folderId === 'null' ? null : folderId;
    if (type) options.type = type;
    if (isFavorite !== undefined) options.isFavorite = isFavorite === 'true';
    if (search) options.search = search;
    if (tags) options.tags = tags.split(',');
    if (limit) options.limit = parseInt(limit);
    
    const bookmarks = db.getBookmarks(userId, options);
    const folders = db.getBookmarkFolders(userId);
    const bookmarkTags = db.getBookmarkTags(userId);
    
    res.json({
      success: true,
      data: {
        bookmarks,
        folders,
        tags: bookmarkTags
      }
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmarks'
    });
  }
});

// Create a new bookmark
app.post('/api/bookmarks', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const bookmarkData = {
      id: db.generateId(),
      title: req.body.title,
      description: req.body.description,
      url: req.body.url,
      type: req.body.type || 'custom',
      targetId: req.body.targetId,
      userId: userId,
      folderId: req.body.folderId,
      favicon: req.body.favicon,
      thumbnail: req.body.thumbnail,
      isFavorite: req.body.isFavorite,
      isPrivate: req.body.isPrivate,
      sortOrder: req.body.sortOrder,
      metadata: req.body.metadata,
      tags: req.body.tags || []
    };
    
    const result = db.createBookmark(bookmarkData);
    
    // Create sync record
    db.createSyncRecord({
      id: db.generateId(),
      userId: userId,
      deviceId: req.body.deviceId || 'web',
      bookmarkId: bookmarkData.id,
      action: 'create',
      syncData: bookmarkData
    });
    
    res.status(201).json({
      success: true,
      data: { id: bookmarkData.id }
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bookmark'
    });
  }
});

// Get a specific bookmark
app.get('/api/bookmarks/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const bookmarkId = req.params.id;
    
    const bookmark = db.getBookmarkById(bookmarkId, userId);
    
    if (!bookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }
    
    res.json({
      success: true,
      data: bookmark
    });
  } catch (error) {
    console.error('Error fetching bookmark:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmark'
    });
  }
});

// Update a bookmark
app.put('/api/bookmarks/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const bookmarkId = req.params.id;
    
    // Check if bookmark exists and belongs to user
    const existingBookmark = db.getBookmarkById(bookmarkId, userId);
    if (!existingBookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }
    
    const updates = {
      title: req.body.title,
      description: req.body.description,
      url: req.body.url,
      folderId: req.body.folderId,
      favicon: req.body.favicon,
      thumbnail: req.body.thumbnail,
      isFavorite: req.body.isFavorite,
      isPrivate: req.body.isPrivate,
      sortOrder: req.body.sortOrder,
      metadata: req.body.metadata,
      tags: req.body.tags
    };
    
    // Remove undefined values
    Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
    
    const result = db.updateBookmark(bookmarkId, updates, userId);
    
    // Create sync record
    db.createSyncRecord({
      id: db.generateId(),
      userId: userId,
      deviceId: req.body.deviceId || 'web',
      bookmarkId: bookmarkId,
      action: 'update',
      syncData: { ...updates, id: bookmarkId }
    });
    
    res.json({
      success: true,
      data: { updated: result.changes > 0 }
    });
  } catch (error) {
    console.error('Error updating bookmark:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bookmark'
    });
  }
});

// Update bookmark sort order
app.put('/api/bookmarks/:id/sort', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const bookmarkId = req.params.id;
    const { sortOrder } = req.body;
    
    const result = db.updateBookmark(bookmarkId, { sortOrder }, userId);
    
    res.json({
      success: true,
      data: { updated: result.changes > 0 }
    });
  } catch (error) {
    console.error('Error updating bookmark sort order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bookmark sort order'
    });
  }
});

// Delete a bookmark
app.delete('/api/bookmarks/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const bookmarkId = req.params.id;
    
    // Check if bookmark exists and belongs to user
    const existingBookmark = db.getBookmarkById(bookmarkId, userId);
    if (!existingBookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }
    
    const result = db.deleteBookmark(bookmarkId, userId);
    
    // Create sync record
    db.createSyncRecord({
      id: db.generateId(),
      userId: userId,
      deviceId: req.body.deviceId || 'web',
      bookmarkId: bookmarkId,
      action: 'delete',
      syncData: { id: bookmarkId }
    });
    
    res.json({
      success: true,
      data: { deleted: result.changes > 0 }
    });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bookmark'
    });
  }
});

// ==================== BOOKMARK FOLDERS API ENDPOINTS ====================

// Get all folders for a user
app.get('/api/bookmarks/folders', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { parentFolderId } = req.query;
    
    const folders = db.getBookmarkFolders(userId, parentFolderId);
    
    res.json({
      success: true,
      data: folders
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch folders'
    });
  }
});

// Create a new folder
app.post('/api/bookmarks/folders', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const folderData = {
      id: db.generateId(),
      name: req.body.name,
      description: req.body.description,
      userId: userId,
      parentFolderId: req.body.parentFolderId,
      color: req.body.color || '#3b82f6',
      icon: req.body.icon || 'folder',
      sortOrder: req.body.sortOrder
    };
    
    const result = db.createBookmarkFolder(folderData);
    
    res.status(201).json({
      success: true,
      data: { id: folderData.id }
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create folder'
    });
  }
});

// Update a folder
app.put('/api/bookmarks/folders/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const folderId = req.params.id;
    
    const updates = {
      name: req.body.name,
      description: req.body.description,
      parentFolderId: req.body.parentFolderId,
      color: req.body.color,
      icon: req.body.icon,
      sortOrder: req.body.sortOrder
    };
    
    // Remove undefined values
    Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
    
    const result = db.updateBookmarkFolder(folderId, updates, userId);
    
    res.json({
      success: true,
      data: { updated: result.changes > 0 }
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update folder'
    });
  }
});

// Delete a folder
app.delete('/api/bookmarks/folders/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const folderId = req.params.id;
    
    const result = db.deleteBookmarkFolder(folderId, userId);
    
    res.json({
      success: true,
      data: { deleted: result.changes > 0 }
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete folder'
    });
  }
});

// ==================== BOOKMARK TAGS API ENDPOINTS ====================

// Get all tags for a user
app.get('/api/bookmarks/tags', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const tags = db.getBookmarkTags(userId);
    
    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tags'
    });
  }
});

// Create a new tag
app.post('/api/bookmarks/tags', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const tagData = {
      id: db.generateId(),
      name: req.body.name,
      color: req.body.color || '#10b981',
      userId: userId
    };
    
    const result = db.createBookmarkTag(tagData);
    
    res.status(201).json({
      success: true,
      data: { id: tagData.id }
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tag'
    });
  }
});

// Delete a tag
app.delete('/api/bookmarks/tags/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const tagId = req.params.id;
    
    const result = db.deleteBookmarkTag(tagId, userId);
    
    res.json({
      success: true,
      data: { deleted: result.changes > 0 }
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tag'
    });
  }
});

// ==================== BOOKMARK IMPORT/EXPORT API ENDPOINTS ====================

// Export bookmarks
app.get('/api/bookmarks/export', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'json' } = req.query;
    
    const exportData = db.exportBookmarks(userId, format);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.json"');
      res.send(exportData);
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.csv"');
      res.send(exportData);
    } else {
      res.status(400).json({
        success: false,
        error: 'Unsupported export format'
      });
    }
  } catch (error) {
    console.error('Error exporting bookmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export bookmarks'
    });
  }
});

// Import bookmarks
app.post('/api/bookmarks/import', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { data, format = 'json', overwrite = false } = req.body;
    
    if (overwrite) {
      // Delete existing bookmarks before import
      // This would require additional database methods
    }
    
    const results = db.importBookmarks(userId, data, format);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error importing bookmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import bookmarks'
    });
  }
});

// ==================== BOOKMARK SYNC API ENDPOINTS ====================

// Sync bookmarks
app.post('/api/bookmarks/sync', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.body;
    
    // Get pending sync records for this device
    const pendingRecords = db.getPendingSyncRecords(userId, deviceId);
    
    let updated = 0;
    
    // Process each sync record
    for (const record of pendingRecords) {
      try {
        switch (record.action) {
          case 'create':
            // Check if bookmark already exists
            const existing = db.getBookmarkById(record.bookmark_id, userId);
            if (!existing && record.sync_data) {
              db.createBookmark(record.sync_data);
              updated++;
            }
            break;
            
          case 'update':
            if (record.sync_data) {
              db.updateBookmark(record.bookmark_id, record.sync_data, userId);
              updated++;
            }
            break;
            
          case 'delete':
            db.deleteBookmark(record.bookmark_id, userId);
            updated++;
            break;
        }
        
        // Mark record as synced
        db.markSyncRecordsAsSynced([record.id]);
      } catch (error) {
        console.error('Error processing sync record:', error);
      }
    }
    
    res.json({
      success: true,
      data: {
        updated,
        total: pendingRecords.length
      }
    });
  } catch (error) {
    console.error('Error syncing bookmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync bookmarks'
    });
  }
});

// Get pending sync records
app.get('/api/bookmarks/sync/pending', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.query;
    
    const pendingRecords = db.getPendingSyncRecords(userId, deviceId);
    
    res.json({
      success: true,
      data: pendingRecords
    });
  } catch (error) {
    console.error('Error fetching sync records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync records'
    });
  }
});

// ==================== PUSH NOTIFICATION API ENDPOINTS ====================

// Subscribe to push notifications
app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = req.body;
    
    // Store subscription in database (you would need to add this table)
    // For now, we'll just log it
    console.log('Push subscription for user', userId, ':', subscription);
    
    // Send test notification
    if (pwaManager && pwaManager.sendPushNotification) {
      await pwaManager.sendPushNotification(subscription, {
        title: 'Welcome to Auction Platform',
        body: 'You will now receive notifications about auctions and updates',
        icon: '/icons/icon-192x192.png',
        tag: 'welcome',
        data: { url: '/' }
      });
    }
    
    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to push notifications'
    });
  }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = req.body;
    
    // Remove subscription from database
    console.log('Push unsubscription for user', userId, ':', subscription);
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from push notifications'
    });
  }
});

// Send push notification to specific user
app.post('/api/push/send', authenticateToken, async (req, res) => {
  try {
    const { userId, title, body, icon, tag, data, actions } = req.body;
    
    // Get user's push subscription from database
    // For now, we'll just send a test notification
    const notification = {
      title: title || 'Auction Update',
      body: body || 'There is an update to your auction',
      icon: icon || '/icons/icon-192x192.png',
      tag: tag || 'auction-update',
      data: data || { url: '/dashboard' },
      actions: actions || []
    };
    
    // Send notification (you would need to implement this)
    console.log('Sending push notification:', notification);
    
    res.json({
      success: true,
      message: 'Push notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send push notification'
    });
  }
});

// Broadcast push notification to all users
app.post('/api/push/broadcast', authenticateAdmin, async (req, res) => {
  try {
    const { title, body, icon, tag, data, actions } = req.body;
    
    // Get all user subscriptions from database
    // For now, we'll just log the broadcast
    const notification = {
      title: title || 'Platform Update',
      body: body || 'New features available in the auction platform',
      icon: icon || '/icons/icon-192x192.png',
      tag: tag || 'platform-update',
      data: data || { url: '/' },
      actions: actions || []
    };
    
    console.log('Broadcasting push notification:', notification);
    
    res.json({
      success: true,
      message: 'Push notification broadcasted successfully'
    });
  } catch (error) {
    console.error('Error broadcasting push notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast push notification'
    });
  }
});

// Serve generated share images
app.get('/api/share/image/:auctionId', (req, res) => {
  try {
    const { auctionId } = req.params;
    const template = req.query.template || 'default';
    
    // Get auction details
    const auction = db.getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Generate a simple SVG image (in production, use a proper image generation library)
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#bg)"/>
        <text x="600" y="200" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle">
          ${auction.title.substring(0, 50)}${auction.title.length > 50 ? '...' : ''}
        </text>
        <text x="600" y="280" font-family="Arial, sans-serif" font-size="32" fill="white" text-anchor="middle">
          Starting Bid: $${auction.starting_bid}
        </text>
        <text x="600" y="350" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">
          Ends: ${new Date(auction.end_time).toLocaleDateString()}
        </text>
        <text x="600" y="450" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle">
          Sealed Auction Platform
        </text>
      </svg>
    `;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    logError('Error serving share image:', error, { endpoint: '/api/share/image/:auctionId' });
    res.status(500).json({ error: 'Failed to serve share image' });
  }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Bookmark manager route
app.get('/bookmarks', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bookmarks.html'));
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('joinAuction', (auctionId) => {
    socket.join(auctionId);
  });
  
  socket.on('joinDashboard', () => {
    socket.join('dashboard');
    console.log('User joined dashboard room:', socket.id);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Auto-close expired auctions
setInterval(() => {
  const now = new Date();
  const activeAuctions = db.getActiveAuctions();
  
  for (const auction of activeAuctions) {
    if (new Date(auction.end_time) <= now) {
      // Get all bids and find winner
      const allBids = db.getBidsForAuction(auction.id);
      let winnerId = null;
      let winningBidId = null;
      
      if (allBids.length > 0) {
        const highestBid = allBids[0];
        winnerId = highestBid.bidder_id;
        winningBidId = highestBid.id;
      }
      
      // Update auction in database
      db.closeAuction(auction.id, winnerId, winningBidId);
      
      io.emit('auctionClosed', { ...auction, status: 'closed', winner: winnerId, winningBid: winningBidId });
      io.to('dashboard').emit('auction_update', { 
        type: 'auction', 
        data: { ...auction, status: 'closed', winner: winnerId, winningBid: winningBidId } 
      });
    }
  }
}, 60000); // Check every minute

// Auto-reset expired account lockouts
setInterval(() => {
  try {
    db.resetExpiredLockouts();
    console.log(`[${new Date().toISOString()}] Expired account lockouts reset.`);
  } catch (error) {
    logError('Error resetting expired lockouts:', error, { operation: 'resetExpiredLockouts' });
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// --- Gas Fee Optimization API Endpoints ---

// Gas fee estimation and optimization
const feeHistory = [];
const networkCongestionData = [];
const scheduledTransactions = new Map();

// Initialize fee tracking
setInterval(async () => {
  try {
    const feeStats = await fetch('https://horizon-testnet.stellar.org/fee_stats').then(r => r.json());
    const congestionData = await fetch('https://horizon-testnet.stellar.org/').then(r => r.json());
    
    const feeEntry = {
      timestamp: new Date().toISOString(),
      min_fee: feeStats.min_fee || 100,
      max_fee: feeStats.max_fee || 1000,
      p50_fee: feeStats.fee_charged?.p50 || 500,
      p75_fee: feeStats.fee_charged?.p75 || 750,
      p95_fee: feeStats.fee_charged?.p95 || 1000,
      ledger: congestionData.history_latest_ledger || 0
    };
    
    feeHistory.push(feeEntry);
    if (feeHistory.length > 1000) feeHistory.shift(); // Keep last 1000 entries
    
    // Calculate network congestion
    const congestionLevel = calculateCongestionLevel(feeStats);
    networkCongestionData.push({
      timestamp: new Date().toISOString(),
      level: congestionLevel,
      ledger: congestionData.history_latest_ledger || 0
    });
    if (networkCongestionData.length > 100) networkCongestionData.shift();
    
  } catch (error) {
    logError('Error updating fee data:', error);
  }
}, 30000); // Update every 30 seconds

function calculateCongestionLevel(feeStats) {
  const p50 = feeStats.fee_charged?.p50 || 500;
  const max = feeStats.max_fee || 1000;
  const ratio = p50 / max;
  
  if (ratio < 0.3) return 'low';
  if (ratio < 0.6) return 'medium';
  if (ratio < 0.8) return 'high';
  return 'critical';
}

// Get current gas fee estimates
app.get('/api/gas/estimate', async (req, res) => {
  try {
    const response = await fetch('https://horizon-testnet.stellar.org/fee_stats');
    const feeStats = await response.json();
    
    const currentCongestion = networkCongestionData[networkCongestionData.length - 1];
    
    const estimates = {
      current: {
        min: feeStats.min_fee || 100,
        max: feeStats.max_fee || 1000,
        recommended: feeStats.fee_charged?.p50 || 500,
        fast: feeStats.fee_charged?.p75 || 750,
        instant: feeStats.fee_charged?.p95 || 1000
      },
      network: {
        congestion: currentCongestion?.level || 'medium',
        ledger: feeStats.ledger || 0,
        timestamp: new Date().toISOString()
      },
      optimization: {
        savings_potential: calculateSavingsPotential(feeStats),
        best_time_to_transact: getBestTransactionTime(),
        estimated_wait_times: getEstimatedWaitTimes(feeStats)
      }
    };
    
    res.json(estimates);
  } catch (error) {
    logError('Error getting gas estimates:', error, { endpoint: '/api/gas/estimate' });
    res.status(500).json({ error: 'Failed to get gas estimates' });
  }
});

// Get fee history
app.get('/api/gas/history', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const filteredHistory = feeHistory.filter(entry => 
      new Date(entry.timestamp) >= cutoff
    );
    
    res.json({
      history: filteredHistory,
      statistics: {
        average_fee: calculateAverageFee(filteredHistory),
        min_fee: Math.min(...filteredHistory.map(h => h.p50_fee)),
        max_fee: Math.max(...filteredHistory.map(h => h.p50_fee)),
        trend: calculateFeeTrend(filteredHistory)
      },
      period: `${hours} hours`
    });
  } catch (error) {
    logError('Error getting fee history:', error, { endpoint: '/api/gas/history' });
    res.status(500).json({ error: 'Failed to get fee history' });
  }
});

// Get network congestion information
app.get('/api/gas/congestion', (req, res) => {
  try {
    const currentCongestion = networkCongestionData[networkCongestionData.length - 1];
    const recentCongestion = networkCongestionData.slice(-24); // Last 24 data points
    
    res.json({
      current: currentCongestion || { level: 'medium', timestamp: new Date().toISOString() },
      recent: recentCongestion,
      forecast: predictCongestionTrend(recentCongestion),
      recommendations: getCongestionRecommendations(currentCongestion?.level || 'medium')
    });
  } catch (error) {
    logError('Error getting congestion data:', error, { endpoint: '/api/gas/congestion' });
    res.status(500).json({ error: 'Failed to get congestion data' });
  }
});

// Schedule transaction for optimal fee timing
app.post('/api/gas/schedule', authenticateToken, (req, res) => {
  try {
    const { 
      transactionType, 
      maxFee, 
      targetTime, 
      priority = 'normal',
      auctionId 
    } = req.body;
    
    const scheduleId = uuidv4();
    const scheduledTx = {
      id: scheduleId,
      userId: req.user.userId,
      transactionType,
      maxFee,
      targetTime: new Date(targetTime),
      priority,
      auctionId,
      status: 'pending',
      createdAt: new Date(),
      estimatedFee: estimateOptimalFee(maxFee, priority),
      savings: calculatePotentialSavings(maxFee, priority)
    };
    
    scheduledTransactions.set(scheduleId, scheduledTx);
    
    // Set up execution timer
    const delay = new Date(targetTime) - new Date();
    if (delay > 0) {
      setTimeout(() => executeScheduledTransaction(scheduleId), delay);
    }
    
    res.json({
      scheduleId,
      estimatedFee: scheduledTx.estimatedFee,
      potentialSavings: scheduledTx.savings,
      executionTime: scheduledTx.targetTime
    });
  } catch (error) {
    logError('Error scheduling transaction:', error, { endpoint: '/api/gas/schedule' });
    res.status(500).json({ error: 'Failed to schedule transaction' });
  }
});

// Get scheduled transactions
app.get('/api/gas/scheduled', authenticateToken, (req, res) => {
  try {
    const userScheduled = Array.from(scheduledTransactions.values())
      .filter(tx => tx.userId === req.user.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      scheduled: userScheduled,
      statistics: {
        total: userScheduled.length,
        pending: userScheduled.filter(tx => tx.status === 'pending').length,
        executed: userScheduled.filter(tx => tx.status === 'executed').length,
        failed: userScheduled.filter(tx => tx.status === 'failed').length,
        totalSavings: userScheduled.reduce((sum, tx) => sum + (tx.savings || 0), 0)
      }
    });
  } catch (error) {
    logError('Error getting scheduled transactions:', error, { endpoint: '/api/gas/scheduled' });
    res.status(500).json({ error: 'Failed to get scheduled transactions' });
  }
});

// Cancel scheduled transaction
app.delete('/api/gas/schedule/:id', authenticateToken, (req, res) => {
  try {
    const scheduleId = req.params.id;
    const scheduledTx = scheduledTransactions.get(scheduleId);
    
    if (!scheduledTx || scheduledTx.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Scheduled transaction not found' });
    }
    
    if (scheduledTx.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot cancel transaction in progress' });
    }
    
    scheduledTx.status = 'cancelled';
    scheduledTransactions.delete(scheduleId);
    
    res.json({ message: 'Scheduled transaction cancelled successfully' });
  } catch (error) {
    logError('Error cancelling scheduled transaction:', error, { endpoint: '/api/gas/schedule/:id' });
    res.status(500).json({ error: 'Failed to cancel scheduled transaction' });
  }
});

// Get cost savings analysis
app.get('/api/gas/savings', authenticateToken, (req, res) => {
  try {
    const period = req.query.period || '30d';
    const userScheduled = Array.from(scheduledTransactions.values())
      .filter(tx => tx.userId === req.user.userId);
    
    const analysis = {
      period,
      totalSavings: userScheduled.reduce((sum, tx) => sum + (tx.savings || 0), 0),
      averageSavingsPerTransaction: userScheduled.length > 0 
        ? userScheduled.reduce((sum, tx) => sum + (tx.savings || 0), 0) / userScheduled.length 
        : 0,
      optimizationRate: calculateOptimizationRate(userScheduled),
      recommendations: generateSavingsRecommendations(userScheduled),
      breakdown: getSavingsBreakdown(userScheduled)
    };
    
    res.json(analysis);
  } catch (error) {
    logError('Error getting savings analysis:', error, { endpoint: '/api/gas/savings' });
    res.status(500).json({ error: 'Failed to get savings analysis' });
  }
});

// Helper functions
function calculateSavingsPotential(feeStats) {
  const current = feeStats.fee_charged?.p50 || 500;
  const min = feeStats.min_fee || 100;
  return ((current - min) / current * 100).toFixed(2);
}

function getBestTransactionTime() {
  const recentFees = feeHistory.slice(-48); // Last 24 hours (30-second intervals)
  const hourlyAverages = {};
  
  recentFees.forEach(entry => {
    const hour = new Date(entry.timestamp).getHours();
    if (!hourlyAverages[hour]) hourlyAverages[hour] = [];
    hourlyAverages[hour].push(entry.p50_fee);
  });
  
  let bestHour = 0;
  let lowestAverage = Infinity;
  
  Object.entries(hourlyAverages).forEach(([hour, fees]) => {
    const average = fees.reduce((sum, fee) => sum + fee, 0) / fees.length;
    if (average < lowestAverage) {
      lowestAverage = average;
      bestHour = parseInt(hour);
    }
  });
  
  return {
    hour: bestHour,
    reason: `Historically lowest fees around ${bestHour}:00`,
    estimatedSavings: `${((500 - lowestAverage) / 500 * 100).toFixed(1)}%`
  };
}

function getEstimatedWaitTimes(feeStats) {
  return {
    min_fee: '~5-10 minutes',
    p50_fee: '~1-2 minutes',
    p75_fee: '~30-60 seconds',
    p95_fee: '~10-30 seconds'
  };
}

function calculateAverageFee(history) {
  if (history.length === 0) return 0;
  return history.reduce((sum, entry) => sum + entry.p50_fee, 0) / history.length;
}

function calculateFeeTrend(history) {
  if (history.length < 2) return 'stable';
  
  const recent = history.slice(-10);
  const older = history.slice(-20, -10);
  
  const recentAvg = recent.reduce((sum, entry) => sum + entry.p50_fee, 0) / recent.length;
  const olderAvg = older.reduce((sum, entry) => sum + entry.p50_fee, 0) / older.length;
  
  const change = (recentAvg - olderAvg) / olderAvg;
  
  if (change > 0.1) return 'increasing';
  if (change < -0.1) return 'decreasing';
  return 'stable';
}

function predictCongestionTrend(recentCongestion) {
  if (recentCongestion.length < 3) return 'stable';
  
  const levels = { low: 1, medium: 2, high: 3, critical: 4 };
  const recent = recentCongestion.slice(-5);
  const avgLevel = recent.reduce((sum, c) => sum + levels[c.level], 0) / recent.length;
  
  if (avgLevel <= 1.5) return 'improving';
  if (avgLevel >= 3.5) return 'worsening';
  return 'stable';
}

function getCongestionRecommendations(level) {
  const recommendations = {
    low: ['Excellent time for transactions', 'Use minimum fees for maximum savings'],
    medium: ['Normal network activity', 'Standard fees recommended'],
    high: ['Network is busy', 'Consider higher fees or schedule for later'],
    critical: ['Network is congested', 'Use instant fees or wait for better timing']
  };
  
  return recommendations[level] || recommendations.medium;
}

function estimateOptimalFee(maxFee, priority) {
  const current = feeHistory[feeHistory.length - 1];
  if (!current) return maxFee;
  
  const multipliers = {
    low: 0.8,
    normal: 1.0,
    high: 1.5,
    instant: 2.0
  };
  
  return Math.min(maxFee, Math.round(current.p50_fee * multipliers[priority]));
}

function calculatePotentialSavings(maxFee, priority) {
  const optimal = estimateOptimalFee(maxFee, priority);
  return Math.max(0, maxFee - optimal);
}

async function executeScheduledTransaction(scheduleId) {
  const scheduledTx = scheduledTransactions.get(scheduleId);
  if (!scheduledTx) return;
  
  try {
    scheduledTx.status = 'executing';
    // Here you would execute the actual transaction
    // For now, we'll simulate successful execution
    scheduledTx.status = 'executed';
    scheduledTx.executedAt = new Date();
    scheduledTx.actualFee = scheduledTx.estimatedFee;
  } catch (error) {
    scheduledTx.status = 'failed';
    scheduledTx.error = error.message;
    logError('Error executing scheduled transaction:', error, { scheduleId });
  }
}

function calculateOptimizationRate(transactions) {
  if (transactions.length === 0) return 0;
  const optimized = transactions.filter(tx => tx.savings > 0).length;
  return (optimized / transactions.length * 100).toFixed(1);
}

function generateSavingsRecommendations(transactions) {
  const recommendations = [];
  
  if (transactions.length === 0) {
    recommendations.push('Start scheduling transactions to see savings recommendations');
  } else {
    const avgSavings = transactions.reduce((sum, tx) => sum + (tx.savings || 0), 0) / transactions.length;
    
    if (avgSavings < 50) {
      recommendations.push('Consider scheduling transactions during off-peak hours for better savings');
    }
    
    const failedRate = transactions.filter(tx => tx.status === 'failed').length / transactions.length;
    if (failedRate > 0.1) {
      recommendations.push('Review failed transactions and adjust fee settings');
    }
  }
  
  return recommendations;
}

function getSavingsBreakdown(transactions) {
  return {
    byType: transactions.reduce((acc, tx) => {
      acc[tx.transactionType] = (acc[tx.transactionType] || 0) + (tx.savings || 0);
      return acc;
    }, {}),
    byPriority: transactions.reduce((acc, tx) => {
      acc[tx.priority] = (acc[tx.priority] || 0) + (tx.savings || 0);
      return acc;
    }, {}),
    byMonth: transactions.reduce((acc, tx) => {
      const month = new Date(tx.createdAt).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + (tx.savings || 0);
      return acc;
    }, {})
  };
}

// Network Status Monitoring Endpoints

// Get current network status
app.get('/api/network/status', (req, res) => {
  try {
    const status = networkMonitor.getNetworkStatus();
    res.json(status);
  } catch (error) {
    logError('Error getting network status:', error, { endpoint: '/api/network/status' });
    res.status(500).json({ error: 'Failed to get network status' });
  }
});

// Get historical network data
app.get('/api/network/history', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const history = networkMonitor.getHistoricalData(hours);
    res.json(history);
  } catch (error) {
    logError('Error getting network history:', error, { endpoint: '/api/network/history' });
    res.status(500).json({ error: 'Failed to get network history' });
  }
});

// Get network alerts
app.get('/api/network/alerts', (req, res) => {
  try {
    const status = networkMonitor.getNetworkStatus();
    res.json(status.alerts);
  } catch (error) {
    logError('Error getting network alerts:', error, { endpoint: '/api/network/alerts' });
    res.status(500).json({ error: 'Failed to get network alerts' });
  }
});

// Acknowledge network alert
app.post('/api/network/alerts/:id/acknowledge', (req, res) => {
  try {
    const alertId = req.params.id;
    const success = networkMonitor.acknowledgeAlert(alertId);
    
    if (success) {
      res.json({ message: 'Alert acknowledged successfully' });
    } else {
      res.status(404).json({ error: 'Alert not found' });
    }
  } catch (error) {
    logError('Error acknowledging alert:', error, { endpoint: '/api/network/alerts/:id/acknowledge' });
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Clear all network alerts
app.delete('/api/network/alerts', (req, res) => {
  try {
    networkMonitor.clearAlerts();
    res.json({ message: 'All alerts cleared successfully' });
  } catch (error) {
    logError('Error clearing alerts:', error, { endpoint: '/api/network/alerts' });
    res.status(500).json({ error: 'Failed to clear alerts' });
  }
});

// Get network recommendations
app.get('/api/network/recommendations', (req, res) => {
  try {
    const recommendations = networkMonitor.getRecommendations();
    res.json(recommendations);
  } catch (error) {
    logError('Error getting network recommendations:', error, { endpoint: '/api/network/recommendations' });
    res.status(500).json({ error: 'Failed to get network recommendations' });
  }
});

// Get congestion information
app.get('/api/network/congestion', async (req, res) => {
  try {
    await networkMonitor.checkCongestion();
    const status = networkMonitor.getNetworkStatus();
    const trend = networkMonitor.getCongestionTrend();
    
    res.json({
      level: status.congestionLevel,
      operationsPerSecond: status.operationsPerSecond,
      trend,
      history: networkMonitor.metrics.congestionHistory.slice(-20)
    });
  } catch (error) {
    logError('Error getting congestion info:', error, { endpoint: '/api/network/congestion' });
    res.status(500).json({ error: 'Failed to get congestion information' });
  }
});

// Schedule regular backups
const BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(backupData, BACKUP_INTERVAL);
console.log(`Automated backup scheduled to run every ${BACKUP_INTERVAL / 60000} minutes.`);

// Bid History Analytics API Endpoints
app.get('/api/bid-history', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const filters = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy || 'timestamp',
      sortOrder: req.query.sortOrder || 'DESC'
    };

    const bidHistory = db.getUserBidHistory(userId, filters);
    res.json(bidHistory);
  } catch (error) {
    logError('Error fetching bid history:', error, { endpoint: '/api/bid-history', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch bid history' });
  }
});

app.get('/api/bid-statistics', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const statistics = db.getUserBidStatistics(userId);
    res.json(statistics);
  } catch (error) {
    logError('Error fetching bid statistics:', error, { endpoint: '/api/bid-statistics', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch bid statistics' });
  }
});

app.get('/api/spending-analytics', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'monthly';
    const analytics = db.getSpendingAnalytics(userId, period);
    res.json(analytics);
  } catch (error) {
    logError('Error fetching spending analytics:', error, { endpoint: '/api/spending-analytics', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch spending analytics' });
  }
});

app.get('/api/timeline-data', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 100;
    const timelineData = db.getTimelineData(userId, limit);
    res.json(timelineData);
  } catch (error) {
    logError('Error fetching timeline data:', error, { endpoint: '/api/timeline-data', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
});

app.get('/api/competition-analysis', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const auctionId = req.query.auctionId || null;
    const competitionData = db.getCompetitionAnalysis(userId, auctionId);
    res.json(competitionData);
  } catch (error) {
    logError('Error fetching competition analysis:', error, { endpoint: '/api/competition-analysis', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch competition analysis' });
  }
});

app.get('/api/export-bid-history', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const format = req.query.format || 'json';
    const filters = {
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };

    const exportData = db.exportBidHistory(userId, format, filters);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="bid-history-${new Date().toISOString().split('T')[0]}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bid-history-${new Date().toISOString().split('T')[0]}.json"`);
    }
    
    res.send(exportData);
  } catch (error) {
    logError('Error exporting bid history:', error, { endpoint: '/api/export-bid-history', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to export bid history' });
  }
});

// ==================== WATCHLIST API ENDPOINTS ====================

// Add auction to watchlist
app.post('/api/watchlist/add', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { auctionId, notificationPreferences, priceThreshold, notes } = req.body;
    
    // Validate auction exists
    const auction = db.getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    // Check if already in watchlist
    const existing = db.getWatchlistItem(userId, auctionId);
    if (existing) {
      return res.status(409).json({ error: 'Auction already in watchlist' });
    }
    
    const watchlistItem = {
      id: uuidv4(),
      userId,
      auctionId,
      notificationPreferences: notificationPreferences || {
        price_change: true,
        ending_soon: true,
        new_bid: true
      },
      priceThreshold,
      notes
    };
    
    db.addToWatchlist(watchlistItem);
    
    // Emit real-time update
    io.emit('watchlist_updated', {
      userId,
      action: 'added',
      auctionId,
      watchlistItem
    });
    
    res.json({
      success: true,
      message: 'Auction added to watchlist',
      watchlistItem
    });
  } catch (error) {
    logError('Error adding to watchlist:', error, { endpoint: '/api/watchlist/add', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to add auction to watchlist' });
  }
});

// Remove auction from watchlist
app.delete('/api/watchlist/remove/:auctionId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { auctionId } = req.params;
    
    const result = db.removeFromWatchlist(userId, auctionId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Auction not found in watchlist' });
    }
    
    // Emit real-time update
    io.emit('watchlist_updated', {
      userId,
      action: 'removed',
      auctionId
    });
    
    res.json({
      success: true,
      message: 'Auction removed from watchlist'
    });
  } catch (error) {
    logError('Error removing from watchlist:', error, { endpoint: '/api/watchlist/remove', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to remove auction from watchlist' });
  }
});

// Get user's watchlist
app.get('/api/watchlist', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { status, sortBy, sortOrder, limit, offset } = req.query;
    
    const options = {
      status,
      sortBy,
      sortOrder,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };
    
    const watchlist = db.getWatchlist(userId, options);
    
    res.json({
      success: true,
      watchlist,
      count: watchlist.length
    });
  } catch (error) {
    logError('Error getting watchlist:', error, { endpoint: '/api/watchlist', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get watchlist' });
  }
});

// Get single watchlist item
app.get('/api/watchlist/item/:auctionId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { auctionId } = req.params;
    
    const watchlistItem = db.getWatchlistItem(userId, auctionId);
    
    if (!watchlistItem) {
      return res.status(404).json({ error: 'Auction not found in watchlist' });
    }
    
    res.json({
      success: true,
      watchlistItem
    });
  } catch (error) {
    logError('Error getting watchlist item:', error, { endpoint: '/api/watchlist/item', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get watchlist item' });
  }
});

// Update watchlist item
app.put('/api/watchlist/item/:auctionId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { auctionId } = req.params;
    const updates = req.body;
    
    const result = db.updateWatchlistItem(userId, auctionId, updates);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Auction not found in watchlist' });
    }
    
    // Get updated item
    const updatedItem = db.getWatchlistItem(userId, auctionId);
    
    // Emit real-time update
    io.emit('watchlist_updated', {
      userId,
      action: 'updated',
      auctionId,
      updates
    });
    
    res.json({
      success: true,
      message: 'Watchlist item updated',
      watchlistItem: updatedItem
    });
  } catch (error) {
    logError('Error updating watchlist item:', error, { endpoint: '/api/watchlist/item', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update watchlist item' });
  }
});

// Bulk add to watchlist
app.post('/api/watchlist/bulk-add', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { auctionIds } = req.body;
    
    if (!Array.isArray(auctionIds) || auctionIds.length === 0) {
      return res.status(400).json({ error: 'Invalid auction IDs array' });
    }
    
    const results = db.bulkAddToWatchlist(userId, auctionIds);
    
    // Emit real-time update
    io.emit('watchlist_bulk_updated', {
      userId,
      action: 'bulk_added',
      results
    });
    
    res.json({
      success: true,
      message: `Added ${results.added} auctions to watchlist`,
      results
    });
  } catch (error) {
    logError('Error bulk adding to watchlist:', error, { endpoint: '/api/watchlist/bulk-add', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to bulk add to watchlist' });
  }
});

// Bulk remove from watchlist
app.post('/api/watchlist/bulk-remove', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { auctionIds } = req.body;
    
    if (!Array.isArray(auctionIds) || auctionIds.length === 0) {
      return res.status(400).json({ error: 'Invalid auction IDs array' });
    }
    
    const results = db.bulkRemoveFromWatchlist(userId, auctionIds);
    
    // Emit real-time update
    io.emit('watchlist_bulk_updated', {
      userId,
      action: 'bulk_removed',
      results
    });
    
    res.json({
      success: true,
      message: `Removed ${results.removed} auctions from watchlist`,
      results
    });
  } catch (error) {
    logError('Error bulk removing from watchlist:', error, { endpoint: '/api/watchlist/bulk-remove', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to bulk remove from watchlist' });
  }
});

// Create watchlist share
app.post('/api/watchlist/share', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { isPublic, expiresInHours } = req.body;
    
    const shareOptions = {
      isPublic,
      expiresInHours,
      baseUrl: `${req.protocol}://${req.get('host')}`
    };
    
    const share = db.createWatchlistShare(userId, shareOptions);
    
    res.json({
      success: true,
      message: 'Watchlist share created',
      share
    });
  } catch (error) {
    logError('Error creating watchlist share:', error, { endpoint: '/api/watchlist/share', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to create watchlist share' });
  }
});

// Get shared watchlist
app.get('/api/watchlist/shared/:shareToken', (req, res) => {
  try {
    const { shareToken } = req.params;
    
    const sharedWatchlist = db.getSharedWatchlist(shareToken);
    
    res.json({
      success: true,
      sharedWatchlist
    });
  } catch (error) {
    logError('Error getting shared watchlist:', error, { endpoint: '/api/watchlist/shared' });
    res.status(404).json({ error: 'Shared watchlist not found or expired' });
  }
});

// Get watchlist notifications
app.get('/api/watchlist/notifications', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly, type, limit } = req.query;
    
    const options = {
      unreadOnly: unreadOnly === 'true',
      type,
      limit: limit ? parseInt(limit) : undefined
    };
    
    const notifications = db.getWatchlistNotifications(userId, options);
    
    res.json({
      success: true,
      notifications,
      count: notifications.length
    });
  } catch (error) {
    logError('Error getting watchlist notifications:', error, { endpoint: '/api/watchlist/notifications', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get watchlist notifications' });
  }
});

// Mark notification as read
app.put('/api/watchlist/notifications/:notificationId/read', authenticateToken, (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const result = db.markNotificationAsRead(notificationId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logError('Error marking notification as read:', error, { endpoint: '/api/watchlist/notifications/read', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Get watchlist activity
app.get('/api/watchlist/activity', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { activityType, limit } = req.query;
    
    const options = {
      activityType,
      limit: limit ? parseInt(limit) : undefined
    };
    
    const activity = db.getWatchlistActivity(userId, options);
    
    res.json({
      success: true,
      activity,
      count: activity.length
    });
  } catch (error) {
    logError('Error getting watchlist activity:', error, { endpoint: '/api/watchlist/activity', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get watchlist activity' });
  }
});

// Check watchlist alerts (for scheduled jobs)
app.post('/api/watchlist/check-alerts', async (req, res) => {
  try {
    // This endpoint should be protected and only called by scheduled jobs
    const alerts = await db.checkWatchlistAlerts();
    
    // Process alerts and create notifications
    for (const alert of alerts) {
      db.createWatchlistNotification(
        alert.watchlistId,
        alert.type,
        alert.title,
        alert.message
      );
      
      // Emit real-time notification
      io.emit('watchlist_alert', alert);
    }
    
    res.json({
      success: true,
      alertsProcessed: alerts.length,
      alerts
    });
  } catch (error) {
    logError('Error checking watchlist alerts:', error, { endpoint: '/api/watchlist/check-alerts' });
    res.status(500).json({ error: 'Failed to check watchlist alerts' });
  }
});

// ==================== TRANSACTION QUEUE MANAGEMENT API ENDPOINTS ====================

// Get queue status and metrics
app.get('/api/queue/status', authenticateToken, (req, res) => {
  try {
    const status = transactionQueue.getQueueStatus();
    res.json(status);
  } catch (error) {
    logError('Error fetching queue status:', error, { endpoint: '/api/queue/status', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

// Get mobile-friendly queue status
app.get('/api/queue/mobile-status', authenticateToken, (req, res) => {
  try {
    const status = transactionQueue.getMobileQueueStatus();
    res.json(status);
  } catch (error) {
    logError('Error fetching mobile queue status:', error, { endpoint: '/api/queue/mobile-status', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch mobile queue status' });
  }
});

// Enqueue a new transaction
app.post('/api/queue/transactions', authenticateToken, async (req, res) => {
  try {
    const { transactionData, priority } = req.body;
    
    // Validate input
    if (!transactionData) {
      return res.status(400).json({ error: 'Transaction data is required' });
    }
    
    // Set default priority if not provided
    const transactionPriority = priority ? PRIORITY[priority.toUpperCase()] : PRIORITY.NORMAL;
    if (!transactionPriority) {
      return res.status(400).json({ error: 'Invalid priority level' });
    }
    
    // Add user context to transaction
    const enrichedTransactionData = {
      ...transactionData,
      userId: req.user.id,
      submittedAt: new Date().toISOString()
    };
    
    const transactionId = await transactionQueue.enqueue(enrichedTransactionData, transactionPriority);
    
    res.json({
      transactionId,
      priority: transactionPriority,
      status: 'enqueued'
    });
  } catch (error) {
    logError('Error enqueuing transaction:', error, { endpoint: '/api/queue/transactions', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to enqueue transaction' });
  }
});

// Get specific transaction details
app.get('/api/queue/transactions/:transactionId', authenticateToken, (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = transactionQueue.getTransaction(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Only allow users to see their own transactions (unless admin)
    if (transaction.data.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(transaction);
  } catch (error) {
    logError('Error fetching transaction:', error, { endpoint: '/api/queue/transactions/:transactionId', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Cancel a pending transaction
app.delete('/api/queue/transactions/:transactionId', authenticateToken, (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = transactionQueue.getTransaction(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Only allow users to cancel their own transactions (unless admin)
    if (transaction.data.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const cancelled = transactionQueue.cancelTransaction(transactionId);
    
    if (cancelled) {
      res.json({ message: 'Transaction cancelled successfully' });
    } else {
      res.status(400).json({ error: 'Cannot cancel transaction - it may already be processing or completed' });
    }
  } catch (error) {
    logError('Error cancelling transaction:', error, { endpoint: '/api/queue/transactions/:transactionId', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to cancel transaction' });
  }
});

// Get user's transaction history
app.get('/api/queue/transactions', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;
    
    // Get all transactions and filter by user
    const userTransactions = Array.from(transactionQueue.transactions.values())
      .filter(tx => tx.data.userId === userId)
      .filter(tx => !status || tx.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      transactions: userTransactions,
      total: userTransactions.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logError('Error fetching user transactions:', error, { endpoint: '/api/queue/transactions', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Admin: Get all transactions
app.get('/api/admin/queue/transactions', authenticateAdmin, (req, res) => {
  try {
    const { status, priority, limit = 100, offset = 0 } = req.query;
    
    let transactions = Array.from(transactionQueue.transactions.values());
    
    // Apply filters
    if (status) {
      transactions = transactions.filter(tx => tx.status === status);
    }
    if (priority) {
      const priorityLevel = PRIORITY[priority.toUpperCase()];
      if (priorityLevel) {
        transactions = transactions.filter(tx => tx.priority === priorityLevel);
      }
    }
    
    // Sort and paginate
    transactions = transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      transactions,
      total: transactions.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logError('Error fetching admin transactions:', error, { endpoint: '/api/admin/queue/transactions' });
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Admin: Get queue configuration
app.get('/api/admin/queue/config', authenticateAdmin, (req, res) => {
  try {
    const config = {
      maxQueueSize: transactionQueue.maxQueueSize,
      batchSize: transactionQueue.batchSize,
      batchTimeout: transactionQueue.batchTimeout,
      maxRetries: transactionQueue.maxRetries,
      retryDelay: transactionQueue.retryDelay,
      gasOptimization: transactionQueue.gasOptimization
    };
    
    res.json(config);
  } catch (error) {
    logError('Error fetching queue config:', error, { endpoint: '/api/admin/queue/config' });
    res.status(500).json({ error: 'Failed to fetch queue configuration' });
  }
});

// Admin: Update queue configuration
app.put('/api/admin/queue/config', authenticateAdmin, (req, res) => {
  try {
    const { maxQueueSize, batchSize, batchTimeout, maxRetries, retryDelay, gasOptimization } = req.body;
    
    // Update configuration
    if (maxQueueSize !== undefined) transactionQueue.maxQueueSize = maxQueueSize;
    if (batchSize !== undefined) transactionQueue.batchSize = batchSize;
    if (batchTimeout !== undefined) transactionQueue.batchTimeout = batchTimeout;
    if (maxRetries !== undefined) transactionQueue.maxRetries = maxRetries;
    if (retryDelay !== undefined) transactionQueue.retryDelay = retryDelay;
    if (gasOptimization !== undefined) transactionQueue.gasOptimization = gasOptimization;
    
    res.json({ message: 'Queue configuration updated successfully' });
  } catch (error) {
    logError('Error updating queue config:', error, { endpoint: '/api/admin/queue/config' });
    res.status(500).json({ error: 'Failed to update queue configuration' });
  }
});

// WebSocket integration for real-time queue updates
io.on('connection', (socket) => {
  console.log('Client connected to transaction queue updates');
  
  // Join user-specific room for their transactions
  socket.on('joinUserQueue', (userId) => {
    socket.join(`user_${userId}`);
  });
  
  // Listen for transaction queue events
  transactionQueue.on('transactionEnqueued', (transaction) => {
    io.to(`user_${transaction.data.userId}`).emit('transactionEnqueued', transaction);
  });
  
  transactionQueue.on('transactionProcessing', (transaction) => {
    io.to(`user_${transaction.data.userId}`).emit('transactionProcessing', transaction);
  });
  
  transactionQueue.on('transactionCompleted', (transaction) => {
    io.to(`user_${transaction.data.userId}`).emit('transactionCompleted', transaction);
  });
  
  transactionQueue.on('transactionFailed', (transaction) => {
    io.to(`user_${transaction.data.userId}`).emit('transactionFailed', transaction);
  });
  
  transactionQueue.on('transactionRetry', (transaction) => {
    io.to(`user_${transaction.data.userId}`).emit('transactionRetry', transaction);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from transaction queue updates');
  });
});

// ==================== WALLET MANAGEMENT API ENDPOINTS ====================

// Get wallet manager status
app.get('/api/wallets/status', authenticateToken, (req, res) => {
  try {
    const status = walletManager.getStatus();
    res.json(status);
  } catch (error) {
    logError('Error fetching wallet manager status:', error, { endpoint: '/api/wallets/status', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch wallet manager status' });
  }
});

// Get all wallets for user
app.get('/api/wallets', authenticateToken, (req, res) => {
  try {
    const wallets = walletManager.getAllWallets();
    // Filter wallets by user if needed (in a real implementation, wallets would be user-specific)
    res.json({
      wallets,
      count: wallets.length
    });
  } catch (error) {
    logError('Error fetching wallets:', error, { endpoint: '/api/wallets', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// Get specific wallet details
app.get('/api/wallets/:walletId', authenticateToken, (req, res) => {
  try {
    const { walletId } = req.params;
    const wallet = walletManager.getWallet(walletId);
    
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    // Remove sensitive data for security
    const safeWallet = { ...wallet };
    delete safeWallet.encryptedSecretKey;
    delete safeWallet.encryptedPrivateKey;
    delete safeWallet.customData;
    
    res.json(safeWallet);
  } catch (error) {
    logError('Error fetching wallet:', error, { endpoint: '/api/wallets/:walletId', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Create new wallet
app.post('/api/wallets', authenticateToken, async (req, res) => {
  try {
    const walletData = req.body;
    
    // Validate required fields
    if (!walletData.name || !walletData.type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    // Add user context
    walletData.userId = req.user.id;
    
    const walletId = await walletManager.createWallet(walletData);
    
    res.json({
      walletId,
      message: 'Wallet created successfully'
    });
  } catch (error) {
    logError('Error creating wallet:', error, { endpoint: '/api/wallets', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to create wallet' });
  }
});

// Add existing wallet
app.post('/api/wallets/import', authenticateToken, async (req, res) => {
  try {
    const walletData = req.body;
    
    // Validate required fields
    if (!walletData.name || !walletData.publicKey || !walletData.secretKey) {
      return res.status(400).json({ error: 'Name, publicKey, and secretKey are required' });
    }
    
    // Add user context
    walletData.userId = req.user.id;
    
    const walletId = await walletManager.addExistingWallet(walletData);
    
    res.json({
      walletId,
      message: 'Wallet imported successfully'
    });
  } catch (error) {
    logError('Error importing wallet:', error, { endpoint: '/api/wallets/import', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to import wallet' });
  }
});

// Set active wallet
app.put('/api/wallets/:walletId/active', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    await walletManager.setActiveWallet(walletId);
    
    res.json({
      message: 'Active wallet updated successfully'
    });
  } catch (error) {
    logError('Error setting active wallet:', error, { endpoint: '/api/wallets/:walletId/active', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to set active wallet' });
  }
});

// Get active wallet
app.get('/api/wallets/active', authenticateToken, (req, res) => {
  try {
    const wallet = walletManager.getActiveWallet();
    
    if (!wallet) {
      return res.status(404).json({ error: 'No active wallet found' });
    }
    
    // Remove sensitive data
    const safeWallet = { ...wallet };
    delete safeWallet.encryptedSecretKey;
    delete safeWallet.encryptedPrivateKey;
    delete safeWallet.customData;
    
    res.json(safeWallet);
  } catch (error) {
    logError('Error fetching active wallet:', error, { endpoint: '/api/wallets/active', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch active wallet' });
  }
});

// Update wallet
app.put('/api/wallets/:walletId', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const updates = req.body;
    
    await walletManager.updateWallet(walletId, updates);
    
    res.json({
      message: 'Wallet updated successfully'
    });
  } catch (error) {
    logError('Error updating wallet:', error, { endpoint: '/api/wallets/:walletId', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to update wallet' });
  }
});

// Delete wallet
app.delete('/api/wallets/:walletId', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    await walletManager.deleteWallet(walletId);
    
    res.json({
      message: 'Wallet deleted successfully'
    });
  } catch (error) {
    logError('Error deleting wallet:', error, { endpoint: '/api/wallets/:walletId', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to delete wallet' });
  }
});

// Lock wallet
app.post('/api/wallets/:walletId/lock', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    await walletManager.lockWallet(walletId);
    
    res.json({
      message: 'Wallet locked successfully'
    });
  } catch (error) {
    logError('Error locking wallet:', error, { endpoint: '/api/wallets/:walletId/lock', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to lock wallet' });
  }
});

// Unlock wallet
app.post('/api/wallets/:walletId/unlock', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    await walletManager.unlockWallet(walletId, password);
    
    res.json({
      message: 'Wallet unlocked successfully'
    });
  } catch (error) {
    logError('Error unlocking wallet:', error, { endpoint: '/api/wallets/:walletId/unlock', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to unlock wallet' });
  }
});

// Get wallet balance
app.get('/api/wallets/:walletId/balance', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const balance = await walletManager.getWalletBalance(walletId);
    
    res.json({
      walletId,
      balance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError('Error fetching wallet balance:', error, { endpoint: '/api/wallets/:walletId/balance', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to fetch wallet balance' });
  }
});

// Get aggregated balance across all wallets
app.get('/api/wallets/balance/aggregate', authenticateToken, async (req, res) => {
  try {
    const aggregatedBalance = await walletManager.getAggregatedBalance();
    
    res.json(aggregatedBalance);
  } catch (error) {
    logError('Error fetching aggregated balance:', error, { endpoint: '/api/wallets/balance/aggregate', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to fetch aggregated balance' });
  }
});

// Get wallet transaction history
app.get('/api/wallets/:walletId/transactions', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      type: req.query.type,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      refresh: req.query.refresh !== 'false'
    };
    
    const transactions = await walletManager.getTransactionHistory(walletId, options);
    
    res.json({
      walletId,
      transactions,
      count: transactions.length,
      options
    });
  } catch (error) {
    logError('Error fetching transaction history:', error, { endpoint: '/api/wallets/:walletId/transactions', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to fetch transaction history' });
  }
});

// Create wallet backup
app.post('/api/wallets/backup', authenticateToken, async (req, res) => {
  try {
    const { walletIds, password, includeSettings } = req.body;
    
    const backupId = await walletManager.createBackup(walletIds, { 
      password,
      includeSettings: includeSettings !== false 
    });
    
    res.json({
      backupId,
      message: 'Backup created successfully'
    });
  } catch (error) {
    logError('Error creating backup:', error, { endpoint: '/api/wallets/backup', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to create backup' });
  }
});

// Restore from backup
app.post('/api/wallets/restore', authenticateToken, async (req, res) => {
  try {
    const { backupData, password } = req.body;
    
    if (!backupData) {
      return res.status(400).json({ error: 'Backup data is required' });
    }
    
    const restoredWallets = await walletManager.restoreFromBackup(backupData, password);
    
    res.json({
      restoredWallets,
      count: restoredWallets.length,
      message: 'Wallets restored successfully'
    });
  } catch (error) {
    logError('Error restoring from backup:', error, { endpoint: '/api/wallets/restore', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to restore from backup' });
  }
});

// Export wallet
app.get('/api/wallets/:walletId/export', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { format, password } = req.query;
    
    const exportData = await walletManager.exportWallet(walletId, format || 'json', password);
    
    // Set appropriate headers
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="wallet-${walletId}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="wallet-${walletId}.json"`);
    }
    
    res.send(exportData);
  } catch (error) {
    logError('Error exporting wallet:', error, { endpoint: '/api/wallets/:walletId/export', userId: req.user?.id });
    res.status(500).json({ error: error.message || 'Failed to export wallet' });
  }
});

// Get supported wallet types and security levels
app.get('/api/wallets/supported', (req, res) => {
  try {
    res.json({
      types: Object.values(WALLET_TYPES),
      securityLevels: Object.values(SECURITY_LEVELS),
      networks: {
        [WALLET_TYPES.STELLAR]: ['mainnet', 'testnet'],
        [WALLET_TYPES.ETHEREUM]: ['mainnet', 'goerli', 'sepolia'],
        [WALLET_TYPES.BITCOIN]: ['mainnet', 'testnet']
      }
    });
  } catch (error) {
    logError('Error fetching supported wallet info:', error, { endpoint: '/api/wallets/supported' });
    res.status(500).json({ error: 'Failed to fetch supported wallet info' });
  }
});

// Mobile-specific endpoints

// Get mobile wallet status (simplified)
app.get('/api/wallets/mobile/status', authenticateToken, (req, res) => {
  try {
    const status = walletManager.getStatus();
    const mobileStatus = {
      walletCount: status.walletCount,
      activeWalletName: status.activeWalletName,
      hasLockedWallets: walletManager.getAllWallets().some(w => w.isLocked),
      lastBackup: status.lastBackup,
      autoBackupEnabled: status.autoBackupEnabled
    };
    
    res.json(mobileStatus);
  } catch (error) {
    logError('Error fetching mobile wallet status:', error, { endpoint: '/api/wallets/mobile/status', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch mobile wallet status' });
  }
});

// Quick balance check for mobile
app.get('/api/wallets/mobile/balances', authenticateToken, async (req, res) => {
  try {
    const wallets = walletManager.getAllWallets();
    const balances = await Promise.all(
      wallets.map(async (wallet) => {
        const balance = await walletManager.getWalletBalance(wallet.id);
        return {
          id: wallet.id,
          name: wallet.name,
          type: wallet.type,
          balance,
          isActive: wallet.isActive,
          isLocked: wallet.isLocked
        };
      })
    );
    
    res.json({
      balances,
      total: balances.reduce((sum, w) => sum + w.balance, 0)
    });
  } catch (error) {
    logError('Error fetching mobile balances:', error, { endpoint: '/api/wallets/mobile/balances', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch mobile balances' });
  }
});

// Admin endpoints

// Get all wallets (admin only)
app.get('/api/admin/wallets', authenticateAdmin, (req, res) => {
  try {
    const { userId, type, network } = req.query;
    let wallets = walletManager.getAllWallets();
    
    // Apply filters
    if (userId) {
      wallets = wallets.filter(w => w.userId === userId);
    }
    if (type) {
      wallets = wallets.filter(w => w.type === type);
    }
    if (network) {
      wallets = wallets.filter(w => w.network === network);
    }
    
    res.json({
      wallets,
      count: wallets.length
    });
  } catch (error) {
    logError('Error fetching admin wallets:', error, { endpoint: '/api/admin/wallets' });
    res.status(500).json({ error: 'Failed to fetch admin wallets' });
  }
});

// Get wallet manager configuration (admin only)
app.get('/api/admin/wallets/config', authenticateAdmin, (req, res) => {
  try {
    const config = {
      maxWallets: walletManager.maxWallets,
      defaultSecurityLevel: walletManager.defaultSecurityLevel,
      securitySettings: walletManager.securitySettings,
      backupSettings: walletManager.backupSettings
    };
    
    res.json(config);
  } catch (error) {
    logError('Error fetching wallet manager config:', error, { endpoint: '/api/admin/wallets/config' });
    res.status(500).json({ error: 'Failed to fetch wallet manager config' });
  }
});

// Update wallet manager configuration (admin only)
app.put('/api/admin/wallets/config', authenticateAdmin, (req, res) => {
  try {
    const { maxWallets, defaultSecurityLevel, securitySettings, backupSettings } = req.body;
    
    // Update configuration
    if (maxWallets !== undefined) walletManager.maxWallets = maxWallets;
    if (defaultSecurityLevel !== undefined) walletManager.defaultSecurityLevel = defaultSecurityLevel;
    if (securitySettings) walletManager.securitySettings = { ...walletManager.securitySettings, ...securitySettings };
    if (backupSettings) walletManager.backupSettings = { ...walletManager.backupSettings, ...backupSettings };
    
    res.json({
      message: 'Wallet manager configuration updated successfully'
    });
  } catch (error) {
    logError('Error updating wallet manager config:', error, { endpoint: '/api/admin/wallets/config' });
    res.status(500).json({ error: 'Failed to update wallet manager config' });
  }
});

// WebSocket integration for real-time wallet updates
io.on('connection', (socket) => {
  console.log('Client connected to wallet management updates');
  
  // Join user-specific room for their wallets
  socket.on('joinUserWallets', (userId) => {
    socket.join(`user_${userId}`);
  });
  
  // Listen for wallet manager events
  walletManager.on('walletCreated', (data) => {
    io.to(`user_${data.wallet.userId}`).emit('walletCreated', data);
  });
  
  walletManager.on('walletSwitched', (data) => {
    io.to(`user_${data.wallet.userId}`).emit('walletSwitched', data);
  });
  
  walletManager.on('walletLocked', (data) => {
    io.to(`user_${data.wallet.userId}`).emit('walletLocked', data);
  });
  
  walletManager.on('walletUnlocked', (data) => {
    io.to(`user_${data.wallet.userId}`).emit('walletUnlocked', data);
  });
  
  walletManager.on('balanceUpdated', (data) => {
    io.to(`user_${data.wallet.userId}`).emit('balanceUpdated', data);
  });
  
  walletManager.on('backupCreated', (data) => {
    io.to(`user_${data.wallet.userId}`).emit('backupCreated', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from wallet management updates');
  });
});

// ==================== BLOCKCHAIN ANALYTICS API ENDPOINTS ====================

// Get transaction analytics
app.get('/api/analytics/transactions', authenticateToken, async (req, res) => {
  try {
    const options = {
      timeRange: req.query.timeRange || '24h',
      interval: req.query.interval || AGGREGATION_INTERVALS.HOUR,
      filters: req.query.filters ? JSON.parse(req.query.filters) : {},
      groupBy: req.query.groupBy ? JSON.parse(req.query.groupBy) : []
    };
    
    const analytics = await blockchainAnalytics.getTransactionAnalytics(options);
    res.json(analytics);
  } catch (error) {
    logError('Error fetching transaction analytics:', error, { endpoint: '/api/analytics/transactions', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch transaction analytics' });
  }
});

// Get network statistics
app.get('/api/analytics/network', authenticateToken, async (req, res) => {
  try {
    const options = {
      timeRange: req.query.timeRange || '24h',
      metrics: req.query.metrics ? JSON.parse(req.query.metrics) : ['all']
    };
    
    const statistics = await blockchainAnalytics.getNetworkStatistics(options);
    res.json(statistics);
  } catch (error) {
    logError('Error fetching network statistics:', error, { endpoint: '/api/analytics/network', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch network statistics' });
  }
});

// Get performance metrics
app.get('/api/analytics/performance', authenticateToken, async (req, res) => {
  try {
    const options = {
      timeRange: req.query.timeRange || '24h',
      interval: req.query.interval || AGGREGATION_INTERVALS.HOUR,
      component: req.query.component || 'all'
    };
    
    const metrics = await blockchainAnalytics.getPerformanceMetrics(options);
    res.json(metrics);
  } catch (error) {
    logError('Error fetching performance metrics:', error, { endpoint: '/api/analytics/performance', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Get cost analysis
app.get('/api/analytics/costs', authenticateToken, async (req, res) => {
  try {
    const options = {
      timeRange: req.query.timeRange || '30d',
      interval: req.query.interval || AGGREGATION_INTERVALS.DAY,
      category: req.query.category || 'all'
    };
    
    const analysis = await blockchainAnalytics.getCostAnalysis(options);
    res.json(analysis);
  } catch (error) {
    logError('Error fetching cost analysis:', error, { endpoint: '/api/analytics/costs', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch cost analysis' });
  }
});

// Get trend visualization data
app.get('/api/analytics/trends', authenticateToken, async (req, res) => {
  try {
    const options = {
      timeRange: req.query.timeRange || '7d',
      metrics: req.query.metrics ? JSON.parse(req.query.metrics) : ['transactions', 'costs', 'performance'],
      chartType: req.query.chartType || 'line'
    };
    
    const visualization = await blockchainAnalytics.getTrendVisualization(options);
    res.json(visualization);
  } catch (error) {
    logError('Error fetching trend visualization:', error, { endpoint: '/api/analytics/trends', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch trend visualization' });
  }
});

// Export analytics data
app.get('/api/analytics/export', authenticateToken, async (req, res) => {
  try {
    const options = {
      format: req.query.format || 'json',
      timeRange: req.query.timeRange || '30d',
      metrics: req.query.metrics ? JSON.parse(req.query.metrics) : ['all'],
      includeRaw: req.query.includeRaw === 'true'
    };
    
    const exportData = await blockchainAnalytics.exportAnalytics(options);
    
    // Set appropriate headers for download
    const filename = `analytics-${new Date().toISOString().split('T')[0]}.${options.format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    switch (options.format.toLowerCase()) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        break;
      case 'xlsx':
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        break;
      case 'pdf':
        res.setHeader('Content-Type', 'application/pdf');
        break;
      default:
        res.setHeader('Content-Type', 'application/json');
    }
    
    res.send(exportData);
  } catch (error) {
    logError('Error exporting analytics:', error, { endpoint: '/api/analytics/export', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// Get mobile-optimized analytics
app.get('/api/analytics/mobile', authenticateToken, async (req, res) => {
  try {
    const options = {
      timeRange: req.query.timeRange || '24h',
      limit: parseInt(req.query.limit) || 50
    };
    
    const analytics = await blockchainAnalytics.getMobileAnalytics(options);
    res.json(analytics);
  } catch (error) {
    logError('Error fetching mobile analytics:', error, { endpoint: '/api/analytics/mobile', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch mobile analytics' });
  }
});

// Get analytics dashboard overview
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h';
    
    // Fetch multiple analytics types in parallel
    const [
      transactionAnalytics,
      networkStatistics,
      performanceMetrics,
      costAnalysis
    ] = await Promise.all([
      blockchainAnalytics.getTransactionAnalytics({ timeRange }),
      blockchainAnalytics.getNetworkStatistics({ timeRange }),
      blockchainAnalytics.getPerformanceMetrics({ timeRange }),
      blockchainAnalytics.getCostAnalysis({ timeRange: '30d' })
    ]);
    
    const dashboard = {
      overview: {
        totalTransactions: transactionAnalytics.summary.totalTransactions,
        successRate: transactionAnalytics.summary.successRate,
        networkHealth: networkStatistics.overall.status,
        averageResponseTime: performanceMetrics.responseTime[0]?.avg || 0,
        totalCosts: costAnalysis.totalCosts.total,
        uptime: performanceMetrics.availability.uptime
      },
      charts: {
        transactionTrends: transactionAnalytics.trends,
        networkThroughput: networkStatistics.throughput,
        performanceOverview: performanceMetrics.responseTime,
        costBreakdown: costAnalysis.costBreakdown
      },
      alerts: [
        {
          type: networkStatistics.overall.status === 'healthy' ? 'success' : 'warning',
          message: `Network status: ${networkStatistics.overall.status}`,
          timestamp: new Date().toISOString()
        },
        {
          type: performanceMetrics.availability.uptime > 99 ? 'success' : 'warning',
          message: `System uptime: ${performanceMetrics.availability.uptime}%`,
          timestamp: new Date().toISOString()
        }
      ],
      timeRange,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(dashboard);
  } catch (error) {
    logError('Error fetching analytics dashboard:', error, { endpoint: '/api/analytics/dashboard', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch analytics dashboard' });
  }
});

// Get real-time analytics data
app.get('/api/analytics/realtime', authenticateToken, async (req, res) => {
  try {
    const realTimeData = blockchainAnalytics.realTimeData.get('current');
    
    if (!realTimeData) {
      return res.json({
        timestamp: new Date().toISOString(),
        activeUsers: 0,
        currentTPS: 0,
        avgLatency: 0,
        status: 'no_data'
      });
    }
    
    res.json(realTimeData);
  } catch (error) {
    logError('Error fetching real-time analytics:', error, { endpoint: '/api/analytics/realtime', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch real-time analytics' });
  }
});

// Get analytics engine statistics (admin only)
app.get('/api/admin/analytics/stats', authenticateAdmin, (req, res) => {
  try {
    const stats = blockchainAnalytics.getStats();
    res.json(stats);
  } catch (error) {
    logError('Error fetching analytics stats:', error, { endpoint: '/api/admin/analytics/stats' });
    res.status(500).json({ error: 'Failed to fetch analytics stats' });
  }
});

// Clear analytics cache (admin only)
app.post('/api/admin/analytics/cache/clear', authenticateAdmin, (req, res) => {
  try {
    blockchainAnalytics.clearCache();
    res.json({ message: 'Analytics cache cleared successfully' });
  } catch (error) {
    logError('Error clearing analytics cache:', error, { endpoint: '/api/admin/analytics/cache/clear' });
    res.status(500).json({ error: 'Failed to clear analytics cache' });
  }
});

// Get supported analytics options
app.get('/api/analytics/supported', (req, res) => {
  try {
    const supported = {
      timeRanges: ['1h', '24h', '7d', '30d', '90d'],
      intervals: Object.values(AGGREGATION_INTERVALS),
      metricTypes: Object.values(METRIC_TYPES),
      exportFormats: ['json', 'csv', 'xlsx', 'pdf'],
      chartTypes: ['line', 'bar', 'area', 'pie', 'scatter']
    };
    
    res.json(supported);
  } catch (error) {
    logError('Error fetching supported analytics options:', error, { endpoint: '/api/analytics/supported' });
    res.status(500).json({ error: 'Failed to fetch supported analytics options' });
  }
});

// WebSocket integration for real-time analytics updates
io.on('connection', (socket) => {
  console.log('Client connected to analytics updates');
  
  // Join user-specific room for their analytics
  socket.on('joinUserAnalytics', (userId) => {
    socket.join(`analytics_${userId}`);
  });
  
  // Listen for analytics events
  blockchainAnalytics.on('analyticsGenerated', (data) => {
    io.emit('analyticsUpdate', data);
  });
  
  blockchainAnalytics.on('realTimeData', (data) => {
    io.emit('realTimeUpdate', data);
  });
  
  blockchainAnalytics.on('error', (data) => {
    io.emit('analyticsError', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from analytics updates');
  });
});

if (sentryEnabled) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use((err, req, res, next) => {
  logError('Unhandled request error:', err, {
    endpoint: req.originalUrl,
    method: req.method,
    statusCode: err.status || err.statusCode || 500
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || err.statusCode || 500).sendData({
    error: 'An unexpected server error occurred'
  });
});

process.on('unhandledRejection', (reason) => {
  const rejectionError = reason instanceof Error ? reason : new Error(String(reason));
  logError('Unhandled Promise Rejection:', rejectionError);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:', error, { fatal: true });
  setTimeout(() => process.exit(1), 200);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Sealed-Bid Auction server running on port ${PORT}`);
});

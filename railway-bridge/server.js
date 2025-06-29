const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const DatabaseService = require('./src/services/database');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');

// Import routes
const healthRoutes = require('./src/routes/health');
const userRoutes = require('./src/routes/users');
const subscriptionRoutes = require('./src/routes/subscriptions');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database service
const dbService = new DatabaseService();
app.set('dbService', dbService);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow Cloudflare Worker origins
    const allowedOrigins = [
      /^https:\/\/.*\.workers\.dev$/,
      /^https:\/\/.*\.pages\.dev$/,
      'http://localhost:3000', // For local development
      'http://localhost:8787'  // Wrangler dev server
    ];
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return pattern === origin;
      }
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent') 
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again later'
    });
  }
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  logger.info('Request received', {
    id: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/', healthRoutes);           // /health, /ready
app.use('/api/users', userRoutes);    // /api/users/*
app.use('/api', subscriptionRoutes);  // /api/subscriptions, /api/users/:username/subscriptions

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', { 
    method: req.method, 
    url: req.url,
    ip: req.ip 
  });
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.url} is not a valid endpoint`
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close database connections
  try {
    await dbService.close();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections', { error: error.message });
  }
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Railway bridge server started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

module.exports = app;
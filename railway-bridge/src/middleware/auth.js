const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    logger.error('API_KEY environment variable not set');
    return res.status(500).json({ 
      error: 'Server configuration error' 
    });
  }

  if (!apiKey) {
    logger.warn('Missing API key in request', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent') 
    });
    return res.status(401).json({ 
      error: 'API key required. Provide X-API-Key header.' 
    });
  }

  if (apiKey !== expectedApiKey) {
    logger.warn('Invalid API key provided', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      providedKey: apiKey.substring(0, 8) + '...' 
    });
    return res.status(401).json({ 
      error: 'Invalid API key' 
    });
  }

  logger.debug('Valid API key provided', { ip: req.ip });
  next();
};

module.exports = authMiddleware;
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Database connection failed',
      message: 'Unable to connect to the database'
    });
  }

  // PostgreSQL errors
  if (err.code && err.code.length === 5) {
    // PostgreSQL error codes are 5 characters
    switch (err.code) {
      case '23505': // unique_violation
        return res.status(409).json({
          error: 'Duplicate entry',
          message: 'A record with this information already exists'
        });
      case '23503': // foreign_key_violation
        return res.status(400).json({
          error: 'Invalid reference',
          message: 'Referenced record does not exist'
        });
      case '23502': // not_null_violation
        return res.status(400).json({
          error: 'Missing required field',
          message: 'A required field was not provided'
        });
      case '42P01': // undefined_table
        return res.status(500).json({
          error: 'Database schema error',
          message: 'Database table not found'
        });
      default:
        return res.status(500).json({
          error: 'Database error',
          message: 'An error occurred while processing your request'
        });
    }
  }

  // Validation errors (from Joi)
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation failed',
      message: err.details[0].message
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again later'
    });
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
};

module.exports = errorHandler;
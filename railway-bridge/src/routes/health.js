const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Health check endpoint (no auth required)
router.get('/health', async (req, res) => {
  try {
    const dbService = req.app.get('dbService');
    const dbHealth = await dbService.healthCheck();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth,
      version: process.env.npm_package_version || '1.0.0'
    };

    logger.debug('Health check successful', health);
    res.json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Readiness check (for Railway health monitoring)
router.get('/ready', async (req, res) => {
  try {
    const dbService = req.app.get('dbService');
    await dbService.healthCheck();
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).send('Service Unavailable');
  }
});

module.exports = router;
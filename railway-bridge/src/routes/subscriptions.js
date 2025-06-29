const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { validateSubscription, validateUsername } = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// Apply authentication to all subscription routes
router.use(authMiddleware);

// GET /api/users/:username/subscriptions - Get user subscriptions
router.get('/users/:username/subscriptions', validateUsername, async (req, res, next) => {
  try {
    const { username } = req.params;
    const dbService = req.app.get('dbService');
    
    // Check if user exists first
    const user = await dbService.getUserByUsername(username);
    if (!user) {
      logger.info('Attempt to get subscriptions for non-existent user', { username });
      return res.status(404).json({ 
        error: 'User not found',
        username 
      });
    }
    
    const subscriptions = await dbService.getUserSubscriptions(username);
    
    logger.info('User subscriptions retrieved', { 
      username, 
      playerId: user.player_id,
      count: subscriptions.length 
    });
    
    res.json(subscriptions);
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions - Add new subscription
router.post('/subscriptions', validateSubscription, async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const dbService = req.app.get('dbService');
    
    // Check if user exists
    const user = await dbService.getUserByUsername(username);
    if (!user) {
      logger.warn('Attempt to create subscription for non-existent user', { 
        username, 
        email 
      });
      return res.status(404).json({ 
        error: 'User not found',
        username 
      });
    }
    
    // Check if subscription already exists and is active
    const existingSubscription = await dbService.getSubscriptionByEmail(user.player_id, email);
    if (existingSubscription && existingSubscription.is_active) {
      logger.info('Subscription already exists and is active', { 
        username, 
        email,
        playerId: user.player_id 
      });
      return res.status(409).json({ 
        error: 'Subscription already exists',
        username,
        email 
      });
    }
    
    const subscription = await dbService.addSubscription(user.player_id, email);
    
    logger.info('Subscription created or reactivated', { 
      username, 
      email,
      playerId: user.player_id,
      subscriptionId: subscription.id 
    });
    
    res.status(201).json({
      ...subscription,
      username // Include username in response for convenience
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/subscriptions - Remove subscription
router.delete('/subscriptions', validateSubscription, async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const dbService = req.app.get('dbService');
    
    // Check if user exists
    const user = await dbService.getUserByUsername(username);
    if (!user) {
      logger.info('Attempt to remove subscription for non-existent user', { 
        username, 
        email 
      });
      return res.status(404).json({ 
        error: 'User not found',
        username 
      });
    }
    
    // Check if subscription exists
    const existingSubscription = await dbService.getSubscriptionByEmail(user.player_id, email);
    if (!existingSubscription) {
      logger.info('Attempt to remove non-existent subscription', { 
        username, 
        email,
        playerId: user.player_id 
      });
      return res.status(404).json({ 
        error: 'Subscription not found',
        username,
        email 
      });
    }
    
    const result = await dbService.removeSubscription(user.player_id, email);
    
    logger.info('Subscription removed', { 
      username, 
      email,
      playerId: user.player_id,
      updatedCount: result.updatedCount 
    });
    
    res.json({ 
      success: true, 
      message: 'Subscription removed successfully',
      username,
      email 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
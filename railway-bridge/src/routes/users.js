const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { validateUser, validateUserStatus, validateUsername } = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// Apply authentication to all user routes
router.use(authMiddleware);

// GET /api/users - List all users
router.get('/', async (req, res, next) => {
  try {
    const dbService = req.app.get('dbService');
    const users = await dbService.getUsers();
    
    logger.info('Users retrieved', { count: users.length });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:username - Get specific user
router.get('/:username', validateUsername, async (req, res, next) => {
  try {
    const { username } = req.params;
    const dbService = req.app.get('dbService');
    const user = await dbService.getUserByUsername(username);
    
    if (!user) {
      logger.info('User not found', { username });
      return res.status(404).json({ 
        error: 'User not found',
        username 
      });
    }
    
    logger.info('User retrieved', { username, playerId: user.player_id });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// POST /api/users - Add new user
router.post('/', validateUser, async (req, res, next) => {
  try {
    const dbService = req.app.get('dbService');
    
    // Check if user already exists
    const existingUser = await dbService.getUserByUsername(req.body.username);
    if (existingUser) {
      logger.warn('Attempt to create duplicate user', { 
        username: req.body.username,
        existingPlayerId: existingUser.player_id 
      });
      return res.status(409).json({ 
        error: 'User already exists',
        username: req.body.username 
      });
    }
    
    const user = await dbService.addUser(req.body);
    
    logger.info('User created', { 
      username: user.username, 
      playerId: user.player_id 
    });
    
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:username - Remove user
router.delete('/:username', validateUsername, async (req, res, next) => {
  try {
    const { username } = req.params;
    const dbService = req.app.get('dbService');
    
    // Check if user exists first
    const user = await dbService.getUserByUsername(username);
    if (!user) {
      logger.info('Attempt to delete non-existent user', { username });
      return res.status(404).json({ 
        error: 'User not found',
        username 
      });
    }
    
    const result = await dbService.removeUser(username);
    
    logger.info('User deleted', { 
      username, 
      playerId: user.player_id,
      deletedCount: result.deletedCount 
    });
    
    res.json({ 
      success: true, 
      message: 'User deleted successfully',
      username 
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:username/status - Update user playing status
router.put('/:username/status', validateUsername, validateUserStatus, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { isPlaying } = req.body;
    const dbService = req.app.get('dbService');
    
    // Check if user exists first
    const user = await dbService.getUserByUsername(username);
    if (!user) {
      logger.info('Attempt to update status for non-existent user', { username });
      return res.status(404).json({ 
        error: 'User not found',
        username 
      });
    }
    
    const result = await dbService.updateUserStatus(username, isPlaying);
    
    logger.info('User status updated', { 
      username, 
      playerId: user.player_id,
      isPlaying,
      updatedCount: result.updatedCount 
    });
    
    res.json({ 
      success: true, 
      message: 'User status updated successfully',
      username,
      isPlaying 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
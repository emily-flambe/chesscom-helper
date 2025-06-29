const Joi = require('joi');
const logger = require('../utils/logger');

// User data validation schema
const userSchema = Joi.object({
  player_id: Joi.number().integer().positive().required(),
  username: Joi.string().alphanum().min(3).max(150).required(),
  name: Joi.string().max(255).allow(null, ''),
  title: Joi.string().max(10).allow(null, ''),
  followers: Joi.number().integer().min(0).default(0),
  country: Joi.string().max(200).allow(null, ''),
  location: Joi.string().max(255).allow(null, ''),
  joined: Joi.number().integer().positive().required(),
  status: Joi.string().max(50).required(),
  is_playing: Joi.boolean().default(false),
  last_online: Joi.number().integer().positive().required(),
  url: Joi.string().uri().required()
});

// Subscription validation schema
const subscriptionSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(150).required(),
  email: Joi.string().email().required()
});

// User status update schema
const userStatusSchema = Joi.object({
  isPlaying: Joi.boolean().required()
});

const validateUser = (req, res, next) => {
  const { error, value } = userSchema.validate(req.body);
  
  if (error) {
    logger.warn('User validation failed', { 
      error: error.details[0].message,
      body: req.body 
    });
    return res.status(400).json({ 
      error: 'Validation failed',
      details: error.details[0].message 
    });
  }
  
  req.body = value;
  next();
};

const validateSubscription = (req, res, next) => {
  const { error, value } = subscriptionSchema.validate(req.body);
  
  if (error) {
    logger.warn('Subscription validation failed', { 
      error: error.details[0].message,
      body: req.body 
    });
    return res.status(400).json({ 
      error: 'Validation failed',
      details: error.details[0].message 
    });
  }
  
  req.body = value;
  next();
};

const validateUserStatus = (req, res, next) => {
  const { error, value } = userStatusSchema.validate(req.body);
  
  if (error) {
    logger.warn('User status validation failed', { 
      error: error.details[0].message,
      body: req.body 
    });
    return res.status(400).json({ 
      error: 'Validation failed',
      details: error.details[0].message 
    });
  }
  
  req.body = value;
  next();
};

const validateUsername = (req, res, next) => {
  const { username } = req.params;
  const { error } = Joi.string().alphanum().min(3).max(150).validate(username);
  
  if (error) {
    logger.warn('Username validation failed', { 
      error: error.message,
      username 
    });
    return res.status(400).json({ 
      error: 'Invalid username format',
      details: error.message 
    });
  }
  
  next();
};

module.exports = {
  validateUser,
  validateSubscription,
  validateUserStatus,
  validateUsername
};
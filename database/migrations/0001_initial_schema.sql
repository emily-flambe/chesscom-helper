-- Initial database schema for Chesscom Helper MVP
-- Cloudflare D1 Migration - Version 0001

-- Users table for authentication and user management
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Player Subscriptions - tracks which users subscribe to which players
CREATE TABLE player_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, chess_com_username),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player Status - tracks current status of monitored players
CREATE TABLE player_status (
  chess_com_username TEXT PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  is_playing BOOLEAN DEFAULT false,
  current_game_url TEXT,
  last_seen DATETIME,
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences table for notification settings
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT true,
  notification_frequency TEXT DEFAULT 'immediate', -- 'immediate', 'digest', 'disabled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification Log - tracks sent notifications to avoid duplicates
CREATE TABLE notification_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'game_started', 'game_ended'
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email_delivered BOOLEAN DEFAULT false,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Monitoring Jobs - tracks scheduled monitoring tasks
CREATE TABLE monitoring_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'player_check', 'batch_poll'
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
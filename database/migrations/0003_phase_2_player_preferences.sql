-- Phase 2 Database Schema Extensions
-- Cloudflare D1 Migration - Version 0003

-- Player Notification Preferences - per-player notification settings
CREATE TABLE player_notification_preferences (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  notify_online BOOLEAN DEFAULT false,
  notify_game_start BOOLEAN DEFAULT false,
  notify_game_end BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES player_subscriptions(id) ON DELETE CASCADE
);

-- Player Activity Log - detailed activity tracking for analytics
CREATE TABLE player_activity_log (
  id TEXT PRIMARY KEY,
  chess_com_username TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'online', 'offline', 'game_start', 'game_end'
  event_data TEXT, -- JSON data for additional event information
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Index for per-player notification preference lookups
CREATE INDEX idx_player_notification_prefs_subscription 
  ON player_notification_preferences(subscription_id);

-- Index for efficient player activity queries
CREATE INDEX idx_player_activity_username_created 
  ON player_activity_log(chess_com_username, created_at DESC);

-- Index for event type filtering
CREATE INDEX idx_player_activity_event_type 
  ON player_activity_log(event_type, created_at DESC);

-- Index for user subscription queries (for bulk operations)
CREATE INDEX idx_player_subscriptions_user_created 
  ON player_subscriptions(user_id, created_at DESC);

-- Index for player status queries (for bulk status checks)
CREATE INDEX idx_player_status_username_updated 
  ON player_status(chess_com_username, updated_at DESC);
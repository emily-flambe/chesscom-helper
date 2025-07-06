-- Phase 4: User Interface & Controls - Database Schema Extensions
-- Cloudflare D1 Migration - Version 0003

-- Enhanced notification preferences with granular controls
CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY,
  email_enabled BOOLEAN DEFAULT true,
  notification_frequency TEXT DEFAULT 'immediate', -- 'immediate', 'digest_hourly', 'digest_daily', 'disabled'
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  timezone TEXT DEFAULT 'UTC',
  player_specific_settings TEXT, -- JSON: per-player notification preferences
  game_type_filters TEXT, -- JSON: {"rapid": true, "blitz": true, "bullet": false, "classical": true}
  notification_cooldown_minutes INTEGER DEFAULT 5, -- Minimum time between notifications for same player
  bulk_actions_enabled BOOLEAN DEFAULT true,
  email_preview_enabled BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification history for analytics and audit trail
CREATE TABLE notification_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'game_started', 'game_ended', 'player_online', 'player_offline'
  channel TEXT NOT NULL, -- 'email', 'push', 'sms' (for future expansion)
  status TEXT NOT NULL, -- 'queued', 'sent', 'delivered', 'failed', 'clicked', 'unsubscribed'
  subject TEXT,
  content_summary TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME,
  clicked_at DATETIME,
  failed_at DATETIME,
  error_message TEXT,
  metadata TEXT, -- JSON: additional data like game URL, rating, etc.
  delivery_duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player-specific notification settings
CREATE TABLE player_notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  notification_types TEXT, -- JSON: {"game_started": true, "game_ended": false, "online": true}
  game_type_filters TEXT, -- JSON: per-player game type preferences
  custom_cooldown_minutes INTEGER, -- Override global cooldown for this player
  priority_level TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  notes TEXT, -- User notes about this player
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, player_name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Secure unsubscribe tokens
CREATE TABLE unsubscribe_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL, -- 'global', 'player_specific', 'notification_type'
  scope_data TEXT, -- JSON: {"player_name": "MagnusCarlsen"} or {"notification_type": "game_started"}
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_unsubscribe_token (token),
  INDEX idx_unsubscribe_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification analytics for performance monitoring
CREATE TABLE notification_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date_bucket TEXT NOT NULL, -- 'YYYY-MM-DD' or 'YYYY-MM-DD-HH' for hourly
  total_notifications_sent INTEGER DEFAULT 0,
  total_notifications_delivered INTEGER DEFAULT 0,
  total_notifications_failed INTEGER DEFAULT 0,
  total_notifications_clicked INTEGER DEFAULT 0,
  average_delivery_time_ms INTEGER DEFAULT 0,
  unique_players_notified INTEGER DEFAULT 0,
  notification_types_breakdown TEXT, -- JSON: {"game_started": 10, "game_ended": 8}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date_bucket),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification queue for real-time monitoring
CREATE TABLE notification_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher number = higher priority
  scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processing_at DATETIME,
  processed_at DATETIME,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  payload TEXT, -- JSON: notification data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification templates for customization
CREATE TABLE notification_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- NULL for system templates, user_id for custom templates
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'email', 'push', 'sms'
  notification_type TEXT NOT NULL, -- 'game_started', 'game_ended', etc.
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  variables TEXT, -- JSON: array of variable names like ["player_name", "game_url"]
  is_system_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User activity tracking for UI analytics
CREATE TABLE user_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'login', 'preference_change', 'player_add', 'notification_click'
  activity_data TEXT, -- JSON: additional activity context
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Migrate existing user preferences to new notification_preferences table
INSERT INTO notification_preferences (user_id, email_enabled, notification_frequency, created_at, updated_at)
SELECT 
  user_id,
  email_notifications,
  notification_frequency,
  created_at,
  updated_at
FROM user_preferences
WHERE user_id IS NOT NULL;

-- Create system notification templates
INSERT INTO notification_templates (id, name, template_type, notification_type, subject, body_html, body_text, variables, is_system_template, is_active)
VALUES 
  (
    'system_game_started_email',
    'Game Started Notification',
    'email',
    'game_started',
    '🎯 {{player_name}} started a new game!',
    '<h2>{{player_name}} is now playing!</h2><p>Game URL: <a href="{{game_url}}">{{game_url}}</a></p><p>Game Type: {{game_type}}</p>',
    '{{player_name}} is now playing!\n\nGame URL: {{game_url}}\nGame Type: {{game_type}}',
    '["player_name", "game_url", "game_type"]',
    true,
    true
  ),
  (
    'system_game_ended_email',
    'Game Ended Notification',
    'email',
    'game_ended',
    '🏁 {{player_name}} finished their game',
    '<h2>{{player_name}} finished playing</h2><p>Game Result: {{game_result}}</p><p>Game URL: <a href="{{game_url}}">{{game_url}}</a></p>',
    '{{player_name}} finished playing\n\nGame Result: {{game_result}}\nGame URL: {{game_url}}',
    '["player_name", "game_result", "game_url"]',
    true,
    true
  ),
  (
    'system_player_online_email',
    'Player Online Notification',
    'email',
    'player_online',
    '🟢 {{player_name}} is now online',
    '<h2>{{player_name}} is online!</h2><p>Last seen: {{last_seen}}</p>',
    '{{player_name}} is online!\n\nLast seen: {{last_seen}}',
    '["player_name", "last_seen"]',
    true,
    true
  );
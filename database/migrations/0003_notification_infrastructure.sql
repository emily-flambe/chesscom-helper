-- Phase 1: Foundation Infrastructure - Notification System Enhancement
-- Migration: 0003_notification_infrastructure.sql
-- Purpose: Extend database schema to support advanced notification preferences and logging

-- Extend player_subscriptions with notification preference
ALTER TABLE player_subscriptions 
ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;

-- Extend user_preferences with global notification toggle
ALTER TABLE user_preferences 
ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;

-- Extend notification_log with additional tracking fields
ALTER TABLE notification_log 
ADD COLUMN game_details TEXT; -- JSON: time control, rated status, etc.

ALTER TABLE notification_log 
ADD COLUMN delivered_at DATETIME;

ALTER TABLE notification_log 
ADD COLUMN failed_at DATETIME;

ALTER TABLE notification_log 
ADD COLUMN failure_reason TEXT;

ALTER TABLE notification_log 
ADD COLUMN email_provider_id TEXT; -- Resend message ID

-- Create optimized indexes for notification queries
CREATE INDEX idx_notification_log_cooldown 
ON notification_log(user_id, chess_com_username, sent_at);

CREATE INDEX idx_subscriptions_notifications 
ON player_subscriptions(user_id, notifications_enabled);

CREATE INDEX idx_user_preferences_notifications 
ON user_preferences(user_id, notifications_enabled);

-- Create notification queue table for future use
CREATE TABLE notification_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  game_details TEXT,
  queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  failed_at DATETIME,
  retry_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notification_queue_processing 
ON notification_queue(queued_at, processed_at, failed_at);
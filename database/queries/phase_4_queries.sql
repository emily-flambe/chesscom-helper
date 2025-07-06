-- Phase 4: User Interface & Controls - Common Database Queries
-- Optimized queries for notification preference management and analytics

-- =============================================================================
-- NOTIFICATION PREFERENCES QUERIES
-- =============================================================================

-- Get user's notification preferences with defaults
-- name: get_user_notification_preferences
SELECT 
  np.user_id,
  np.email_enabled,
  np.notification_frequency,
  np.quiet_hours_start,
  np.quiet_hours_end,
  np.timezone,
  np.player_specific_settings,
  np.game_type_filters,
  np.notification_cooldown_minutes,
  np.bulk_actions_enabled,
  np.email_preview_enabled,
  np.created_at,
  np.updated_at
FROM notification_preferences np
WHERE np.user_id = ?;

-- Update user's notification preferences
-- name: update_user_notification_preferences
UPDATE notification_preferences 
SET 
  email_enabled = ?,
  notification_frequency = ?,
  quiet_hours_start = ?,
  quiet_hours_end = ?,
  timezone = ?,
  player_specific_settings = ?,
  game_type_filters = ?,
  notification_cooldown_minutes = ?,
  bulk_actions_enabled = ?,
  email_preview_enabled = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE user_id = ?;

-- Create user's notification preferences
-- name: create_user_notification_preferences
INSERT INTO notification_preferences (
  user_id, email_enabled, notification_frequency, quiet_hours_start, 
  quiet_hours_end, timezone, player_specific_settings, game_type_filters,
  notification_cooldown_minutes, bulk_actions_enabled, email_preview_enabled
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- =============================================================================
-- PLAYER-SPECIFIC NOTIFICATION SETTINGS QUERIES
-- =============================================================================

-- Get all player-specific settings for a user
-- name: get_user_player_notification_settings
SELECT 
  pns.id,
  pns.user_id,
  pns.player_name,
  pns.enabled,
  pns.notification_types,
  pns.game_type_filters,
  pns.custom_cooldown_minutes,
  pns.priority_level,
  pns.notes,
  pns.created_at,
  pns.updated_at
FROM player_notification_settings pns
WHERE pns.user_id = ?
ORDER BY pns.player_name;

-- Get specific player notification settings
-- name: get_player_notification_settings
SELECT 
  pns.id,
  pns.user_id,
  pns.player_name,
  pns.enabled,
  pns.notification_types,
  pns.game_type_filters,
  pns.custom_cooldown_minutes,
  pns.priority_level,
  pns.notes,
  pns.created_at,
  pns.updated_at
FROM player_notification_settings pns
WHERE pns.user_id = ? AND pns.player_name = ?;

-- Update player-specific notification settings
-- name: upsert_player_notification_settings
INSERT INTO player_notification_settings (
  id, user_id, player_name, enabled, notification_types, game_type_filters,
  custom_cooldown_minutes, priority_level, notes
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (user_id, player_name) DO UPDATE SET
  enabled = excluded.enabled,
  notification_types = excluded.notification_types,
  game_type_filters = excluded.game_type_filters,
  custom_cooldown_minutes = excluded.custom_cooldown_minutes,
  priority_level = excluded.priority_level,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;

-- Delete player-specific notification settings
-- name: delete_player_notification_settings
DELETE FROM player_notification_settings 
WHERE user_id = ? AND player_name = ?;

-- =============================================================================
-- NOTIFICATION HISTORY QUERIES
-- =============================================================================

-- Get notification history for a user with pagination
-- name: get_user_notification_history
SELECT 
  nh.id,
  nh.user_id,
  nh.player_name,
  nh.notification_type,
  nh.channel,
  nh.status,
  nh.subject,
  nh.content_summary,
  nh.sent_at,
  nh.delivered_at,
  nh.clicked_at,
  nh.failed_at,
  nh.error_message,
  nh.metadata,
  nh.delivery_duration_ms,
  nh.retry_count
FROM notification_history nh
WHERE nh.user_id = ?
ORDER BY nh.sent_at DESC
LIMIT ? OFFSET ?;

-- Get notification history with filters
-- name: get_filtered_notification_history
SELECT 
  nh.id,
  nh.user_id,
  nh.player_name,
  nh.notification_type,
  nh.channel,
  nh.status,
  nh.subject,
  nh.content_summary,
  nh.sent_at,
  nh.delivered_at,
  nh.clicked_at,
  nh.failed_at,
  nh.error_message,
  nh.metadata,
  nh.delivery_duration_ms,
  nh.retry_count
FROM notification_history nh
WHERE nh.user_id = ?
  AND (? IS NULL OR nh.player_name = ?)
  AND (? IS NULL OR nh.notification_type = ?)
  AND (? IS NULL OR nh.status = ?)
  AND (? IS NULL OR nh.sent_at >= ?)
  AND (? IS NULL OR nh.sent_at <= ?)
ORDER BY nh.sent_at DESC
LIMIT ? OFFSET ?;

-- Get notification history count for pagination
-- name: get_notification_history_count
SELECT COUNT(*) as total_count
FROM notification_history nh
WHERE nh.user_id = ?
  AND (? IS NULL OR nh.player_name = ?)
  AND (? IS NULL OR nh.notification_type = ?)
  AND (? IS NULL OR nh.status = ?)
  AND (? IS NULL OR nh.sent_at >= ?)
  AND (? IS NULL OR nh.sent_at <= ?);

-- =============================================================================
-- NOTIFICATION ANALYTICS QUERIES
-- =============================================================================

-- Get notification analytics for a user and date range
-- name: get_user_notification_analytics
SELECT 
  na.date_bucket,
  na.total_notifications_sent,
  na.total_notifications_delivered,
  na.total_notifications_failed,
  na.total_notifications_clicked,
  na.average_delivery_time_ms,
  na.unique_players_notified,
  na.notification_types_breakdown
FROM notification_analytics na
WHERE na.user_id = ?
  AND na.date_bucket >= ?
  AND na.date_bucket <= ?
ORDER BY na.date_bucket DESC;

-- Get notification analytics summary
-- name: get_notification_analytics_summary
SELECT 
  SUM(na.total_notifications_sent) as total_sent,
  SUM(na.total_notifications_delivered) as total_delivered,
  SUM(na.total_notifications_failed) as total_failed,
  SUM(na.total_notifications_clicked) as total_clicked,
  AVG(na.average_delivery_time_ms) as avg_delivery_time_ms,
  COUNT(DISTINCT na.unique_players_notified) as unique_players
FROM notification_analytics na
WHERE na.user_id = ?
  AND na.date_bucket >= ?
  AND na.date_bucket <= ?;

-- =============================================================================
-- NOTIFICATION QUEUE QUERIES
-- =============================================================================

-- Get pending notifications for a user
-- name: get_user_pending_notifications
SELECT 
  nq.id,
  nq.user_id,
  nq.player_name,
  nq.notification_type,
  nq.channel,
  nq.priority,
  nq.scheduled_at,
  nq.status,
  nq.retry_count,
  nq.max_retries,
  nq.payload
FROM notification_queue nq
WHERE nq.user_id = ?
  AND nq.status IN ('pending', 'processing')
ORDER BY nq.priority DESC, nq.scheduled_at ASC;

-- Get notification queue status for a user
-- name: get_notification_queue_status
SELECT 
  nq.status,
  COUNT(*) as count
FROM notification_queue nq
WHERE nq.user_id = ?
GROUP BY nq.status;

-- =============================================================================
-- UNSUBSCRIBE TOKEN QUERIES
-- =============================================================================

-- Get valid unsubscribe token
-- name: get_unsubscribe_token
SELECT 
  ut.id,
  ut.user_id,
  ut.token,
  ut.token_type,
  ut.scope_data,
  ut.expires_at,
  ut.used_at
FROM unsubscribe_tokens ut
WHERE ut.token = ?
  AND ut.expires_at > CURRENT_TIMESTAMP
  AND ut.used_at IS NULL;

-- Mark unsubscribe token as used
-- name: mark_unsubscribe_token_used
UPDATE unsubscribe_tokens 
SET 
  used_at = CURRENT_TIMESTAMP,
  ip_address = ?,
  user_agent = ?
WHERE token = ?;

-- Create unsubscribe token
-- name: create_unsubscribe_token
INSERT INTO unsubscribe_tokens (
  id, user_id, token, token_type, scope_data, expires_at
) VALUES (?, ?, ?, ?, ?, ?);

-- Clean up expired tokens
-- name: cleanup_expired_tokens
DELETE FROM unsubscribe_tokens 
WHERE expires_at < CURRENT_TIMESTAMP;

-- =============================================================================
-- BULK OPERATIONS QUERIES
-- =============================================================================

-- Bulk enable/disable notifications for multiple players
-- name: bulk_update_player_notifications
UPDATE player_notification_settings 
SET 
  enabled = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE user_id = ? AND player_name IN (SELECT value FROM json_each(?));

-- Bulk update notification frequency
-- name: bulk_update_notification_frequency
UPDATE notification_preferences 
SET 
  notification_frequency = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE user_id IN (SELECT value FROM json_each(?));

-- =============================================================================
-- DASHBOARD QUERIES
-- =============================================================================

-- Get dashboard statistics for a user
-- name: get_user_dashboard_stats
SELECT 
  (SELECT COUNT(*) FROM player_subscriptions ps WHERE ps.user_id = ?) as total_players,
  (SELECT COUNT(*) FROM player_notification_settings pns WHERE pns.user_id = ? AND pns.enabled = true) as enabled_players,
  (SELECT COUNT(*) FROM notification_history nh WHERE nh.user_id = ? AND nh.sent_at >= datetime('now', '-24 hours')) as notifications_24h,
  (SELECT COUNT(*) FROM notification_history nh WHERE nh.user_id = ? AND nh.sent_at >= datetime('now', '-7 days')) as notifications_7d,
  (SELECT COUNT(*) FROM notification_queue nq WHERE nq.user_id = ? AND nq.status = 'pending') as pending_notifications;

-- Get recent activity for a user
-- name: get_user_recent_activity
SELECT 
  ua.activity_type,
  ua.activity_data,
  ua.created_at
FROM user_activity ua
WHERE ua.user_id = ?
ORDER BY ua.created_at DESC
LIMIT 10;
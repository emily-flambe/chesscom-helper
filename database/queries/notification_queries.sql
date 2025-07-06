-- Phase 1: Foundation Infrastructure - Notification Query Functions
-- File: notification_queries.sql
-- Purpose: Optimized database queries for notification operations

-- Get all subscriptions with notification preferences for a user
-- Query: get_user_subscriptions_with_preferences
SELECT 
  ps.id,
  ps.user_id,
  ps.chess_com_username,
  ps.notifications_enabled as player_notifications_enabled,
  ps.created_at,
  up.notifications_enabled as user_notifications_enabled
FROM player_subscriptions ps
JOIN user_preferences up ON ps.user_id = up.user_id
WHERE ps.user_id = ?;

-- Check if notification should be sent (cooldown and preferences)
-- Query: check_notification_eligibility
SELECT 
  ps.notifications_enabled as player_enabled,
  up.notifications_enabled as user_enabled,
  nl.sent_at as last_notification
FROM player_subscriptions ps
JOIN user_preferences up ON ps.user_id = up.user_id
LEFT JOIN notification_log nl ON (
  nl.user_id = ps.user_id 
  AND nl.chess_com_username = ps.chess_com_username
  AND nl.sent_at > datetime('now', '-1 hour')
)
WHERE ps.user_id = ? AND ps.chess_com_username = ?
ORDER BY nl.sent_at DESC
LIMIT 1;

-- Get notification history for a user
-- Query: get_user_notification_history
SELECT 
  nl.id,
  nl.chess_com_username,
  nl.notification_type,
  nl.sent_at,
  nl.email_delivered,
  nl.delivered_at,
  nl.failed_at,
  nl.failure_reason,
  nl.game_details
FROM notification_log nl
WHERE nl.user_id = ?
ORDER BY nl.sent_at DESC
LIMIT ? OFFSET ?;

-- Get users to notify for a specific player
-- Query: get_users_to_notify_for_player
SELECT DISTINCT
  ps.user_id,
  u.email,
  ps.chess_com_username
FROM player_subscriptions ps
JOIN users u ON ps.user_id = u.id
JOIN user_preferences up ON ps.user_id = up.user_id
WHERE ps.chess_com_username = ?
  AND ps.notifications_enabled = TRUE
  AND up.notifications_enabled = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM notification_log nl
    WHERE nl.user_id = ps.user_id
      AND nl.chess_com_username = ps.chess_com_username
      AND nl.sent_at > datetime('now', '-1 hour')
  );

-- Get notification statistics for monitoring
-- Query: get_notification_statistics
SELECT 
  COUNT(*) as total_notifications,
  SUM(CASE WHEN email_delivered = TRUE THEN 1 ELSE 0 END) as successful_deliveries,
  SUM(CASE WHEN email_delivered = FALSE THEN 1 ELSE 0 END) as failed_deliveries,
  COUNT(DISTINCT user_id) as unique_users_notified,
  COUNT(DISTINCT chess_com_username) as unique_players_tracked
FROM notification_log
WHERE sent_at >= datetime('now', '-24 hours');

-- Get recent notification failures for debugging
-- Query: get_recent_notification_failures
SELECT 
  nl.id,
  nl.user_id,
  nl.chess_com_username,
  nl.notification_type,
  nl.sent_at,
  nl.failed_at,
  nl.failure_reason,
  u.email
FROM notification_log nl
JOIN users u ON nl.user_id = u.id
WHERE nl.email_delivered = FALSE
  AND nl.failed_at > datetime('now', '-24 hours')
ORDER BY nl.failed_at DESC
LIMIT 100;

-- Update notification delivery status
-- Query: update_notification_delivery_status
UPDATE notification_log 
SET 
  email_delivered = ?,
  delivered_at = ?,
  failed_at = ?,
  failure_reason = ?,
  email_provider_id = ?
WHERE id = ?;
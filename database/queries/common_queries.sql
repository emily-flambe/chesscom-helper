-- Common queries for Chesscom Helper MVP
-- These queries can be used for debugging, monitoring, and administration

-- ============================================================================
-- USER MANAGEMENT QUERIES
-- ============================================================================

-- Get user details with preferences
SELECT 
  u.id,
  u.email,
  u.created_at,
  up.email_notifications,
  up.notification_frequency,
  COUNT(ps.id) as subscription_count
FROM users u
LEFT JOIN user_preferences up ON u.id = up.user_id
LEFT JOIN player_subscriptions ps ON u.id = ps.user_id
GROUP BY u.id, u.email, u.created_at, up.email_notifications, up.notification_frequency;

-- Get users with most subscriptions
SELECT 
  u.email,
  COUNT(ps.id) as subscription_count
FROM users u
JOIN player_subscriptions ps ON u.id = ps.user_id
GROUP BY u.id, u.email
ORDER BY subscription_count DESC;

-- ============================================================================
-- PLAYER MONITORING QUERIES
-- ============================================================================

-- Get currently active players with subscriber count
SELECT 
  ps_summary.chess_com_username,
  ps_summary.subscriber_count,
  st.is_online,
  st.is_playing,
  st.current_game_url,
  st.last_seen,
  st.last_checked
FROM (
  SELECT 
    chess_com_username,
    COUNT(*) as subscriber_count
  FROM player_subscriptions
  GROUP BY chess_com_username
) ps_summary
LEFT JOIN player_status st ON ps_summary.chess_com_username = st.chess_com_username
ORDER BY ps_summary.subscriber_count DESC;

-- Get players that haven't been checked recently
SELECT 
  chess_com_username,
  last_checked,
  datetime('now', '-5 minutes') as threshold
FROM player_status
WHERE last_checked < datetime('now', '-5 minutes')
   OR last_checked IS NULL;

-- Get currently playing players
SELECT 
  chess_com_username,
  current_game_url,
  last_seen,
  last_checked
FROM player_status
WHERE is_playing = true;

-- ============================================================================
-- NOTIFICATION QUERIES
-- ============================================================================

-- Get notification stats by user
SELECT 
  u.email,
  COUNT(nl.id) as total_notifications,
  COUNT(CASE WHEN nl.notification_type = 'game_started' THEN 1 END) as game_started_count,
  COUNT(CASE WHEN nl.notification_type = 'game_ended' THEN 1 END) as game_ended_count,
  COUNT(CASE WHEN nl.email_delivered = true THEN 1 END) as delivered_count,
  MAX(nl.sent_at) as last_notification
FROM users u
LEFT JOIN notification_log nl ON u.id = nl.user_id
GROUP BY u.id, u.email
ORDER BY total_notifications DESC;

-- Get recent notifications (last 24 hours)
SELECT 
  u.email,
  nl.chess_com_username,
  nl.notification_type,
  nl.sent_at,
  nl.email_delivered
FROM notification_log nl
JOIN users u ON nl.user_id = u.id
WHERE nl.sent_at >= datetime('now', '-1 day')
ORDER BY nl.sent_at DESC;

-- Get notification delivery failures
SELECT 
  u.email,
  nl.chess_com_username,
  nl.notification_type,
  nl.sent_at
FROM notification_log nl
JOIN users u ON nl.user_id = u.id
WHERE nl.email_delivered = false
ORDER BY nl.sent_at DESC;

-- ============================================================================
-- MONITORING JOB QUERIES
-- ============================================================================

-- Get job execution stats
SELECT 
  job_type,
  status,
  COUNT(*) as count,
  AVG(CAST((julianday(completed_at) - julianday(started_at)) * 86400 AS INTEGER)) as avg_duration_seconds
FROM monitoring_jobs
WHERE started_at IS NOT NULL
GROUP BY job_type, status
ORDER BY job_type, status;

-- Get recent job failures
SELECT 
  job_type,
  error_message,
  started_at,
  completed_at,
  created_at
FROM monitoring_jobs
WHERE status = 'failed'
  AND created_at >= datetime('now', '-1 day')
ORDER BY created_at DESC;

-- Get long-running jobs
SELECT 
  id,
  job_type,
  status,
  started_at,
  CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER) as running_seconds
FROM monitoring_jobs
WHERE status = 'running'
  AND started_at < datetime('now', '-10 minutes');

-- ============================================================================
-- SYSTEM HEALTH QUERIES
-- ============================================================================

-- Overall system stats
SELECT 
  'users' as entity,
  COUNT(*) as count
FROM users
UNION ALL
SELECT 
  'subscriptions' as entity,
  COUNT(*) as count
FROM player_subscriptions
UNION ALL
SELECT 
  'monitored_players' as entity,
  COUNT(*) as count
FROM player_status
UNION ALL
SELECT 
  'notifications_sent' as entity,
  COUNT(*) as count
FROM notification_log
WHERE sent_at >= datetime('now', '-1 day');

-- Database activity summary (last 24 hours)
SELECT 
  'new_users' as metric,
  COUNT(*) as value
FROM users
WHERE created_at >= datetime('now', '-1 day')
UNION ALL
SELECT 
  'new_subscriptions' as metric,
  COUNT(*) as value
FROM player_subscriptions
WHERE created_at >= datetime('now', '-1 day')
UNION ALL
SELECT 
  'notifications_sent' as metric,
  COUNT(*) as value
FROM notification_log
WHERE sent_at >= datetime('now', '-1 day')
UNION ALL
SELECT 
  'jobs_completed' as metric,
  COUNT(*) as value
FROM monitoring_jobs
WHERE status = 'completed'
  AND completed_at >= datetime('now', '-1 day');

-- ============================================================================
-- CLEANUP QUERIES
-- ============================================================================

-- Clean up old notification logs (older than 30 days)
-- DELETE FROM notification_log WHERE sent_at < datetime('now', '-30 days');

-- Clean up old monitoring jobs (older than 7 days)
-- DELETE FROM monitoring_jobs WHERE created_at < datetime('now', '-7 days');

-- Clean up stale player status records (not monitored by anyone)
-- DELETE FROM player_status 
-- WHERE chess_com_username NOT IN (
--   SELECT DISTINCT chess_com_username FROM player_subscriptions
-- );
-- Development seed data for Chesscom Helper MVP
-- This file contains sample data for development and testing purposes

-- Sample users (passwords are hashed versions of 'testpassword123')
INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES
  ('user-1', 'alice@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMye.LWCaKiDQkiLFaGFfGORwcXq7a6YkKy', '2024-01-01 10:00:00', '2024-01-01 10:00:00'),
  ('user-2', 'bob@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMye.LWCaKiDQkiLFaGFfGORwcXq7a6YkKy', '2024-01-01 11:00:00', '2024-01-01 11:00:00'),
  ('user-3', 'charlie@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMye.LWCaKiDQkiLFaGFfGORwcXq7a6YkKy', '2024-01-01 12:00:00', '2024-01-01 12:00:00');

-- User preferences (default settings)
INSERT INTO user_preferences (user_id, email_notifications, notification_frequency, created_at, updated_at) VALUES
  ('user-1', true, 'immediate', '2024-01-01 10:00:00', '2024-01-01 10:00:00'),
  ('user-2', true, 'digest', '2024-01-01 11:00:00', '2024-01-01 11:00:00'),
  ('user-3', false, 'disabled', '2024-01-01 12:00:00', '2024-01-01 12:00:00');

-- Sample Chess.com player subscriptions
INSERT INTO player_subscriptions (id, user_id, chess_com_username, created_at) VALUES
  ('sub-1', 'user-1', 'magnuscarlsen', '2024-01-01 10:05:00'),
  ('sub-2', 'user-1', 'hikaru', '2024-01-01 10:10:00'),
  ('sub-3', 'user-2', 'magnuscarlsen', '2024-01-01 11:05:00'),
  ('sub-4', 'user-2', 'fabianocaruana', '2024-01-01 11:10:00'),
  ('sub-5', 'user-2', 'anishgiri', '2024-01-01 11:15:00');

-- Sample player status data
INSERT INTO player_status (chess_com_username, is_online, is_playing, current_game_url, last_seen, last_checked, updated_at) VALUES
  ('magnuscarlsen', true, false, null, '2024-01-01 14:30:00', '2024-01-01 14:35:00', '2024-01-01 14:35:00'),
  ('hikaru', true, true, 'https://chess.com/live/game/12345', '2024-01-01 14:25:00', '2024-01-01 14:35:00', '2024-01-01 14:35:00'),
  ('fabianocaruana', false, false, null, '2024-01-01 12:00:00', '2024-01-01 14:35:00', '2024-01-01 14:35:00'),
  ('anishgiri', true, false, null, '2024-01-01 14:20:00', '2024-01-01 14:35:00', '2024-01-01 14:35:00');

-- Sample notification log entries
INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered) VALUES
  ('notif-1', 'user-1', 'hikaru', 'game_started', '2024-01-01 13:15:00', true),
  ('notif-2', 'user-1', 'hikaru', 'game_ended', '2024-01-01 13:45:00', true),
  ('notif-3', 'user-2', 'magnuscarlsen', 'game_started', '2024-01-01 12:30:00', true);

-- Sample monitoring jobs
INSERT INTO monitoring_jobs (id, job_type, status, started_at, completed_at, error_message, created_at) VALUES
  ('job-1', 'batch_poll', 'completed', '2024-01-01 14:30:00', '2024-01-01 14:32:00', null, '2024-01-01 14:30:00'),
  ('job-2', 'player_check', 'completed', '2024-01-01 14:33:00', '2024-01-01 14:33:30', null, '2024-01-01 14:33:00'),
  ('job-3', 'batch_poll', 'failed', '2024-01-01 14:35:00', '2024-01-01 14:35:15', 'Chess.com API rate limit exceeded', '2024-01-01 14:35:00');
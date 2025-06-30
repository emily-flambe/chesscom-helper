-- Performance indexes for Chesscom Helper MVP
-- Cloudflare D1 Migration - Version 0002

-- Indexes for efficient user-related queries
CREATE INDEX idx_users_email ON users(email);

-- Indexes for player subscription queries
CREATE INDEX idx_player_subscriptions_user_id ON player_subscriptions(user_id);
CREATE INDEX idx_player_subscriptions_username ON player_subscriptions(chess_com_username);
CREATE INDEX idx_player_subscriptions_created_at ON player_subscriptions(created_at);

-- Indexes for player status monitoring
CREATE INDEX idx_player_status_last_checked ON player_status(last_checked);
CREATE INDEX idx_player_status_is_playing ON player_status(is_playing);
CREATE INDEX idx_player_status_is_online ON player_status(is_online);

-- Indexes for notification queries
CREATE INDEX idx_notification_log_user_player ON notification_log(user_id, chess_com_username);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at);
CREATE INDEX idx_notification_log_type ON notification_log(notification_type);

-- Indexes for monitoring job queries
CREATE INDEX idx_monitoring_jobs_status ON monitoring_jobs(status);
CREATE INDEX idx_monitoring_jobs_type ON monitoring_jobs(job_type);
CREATE INDEX idx_monitoring_jobs_created_at ON monitoring_jobs(created_at);
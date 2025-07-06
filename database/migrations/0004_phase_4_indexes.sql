-- Phase 4: User Interface & Controls - Performance Indexes
-- Cloudflare D1 Migration - Version 0004

-- Indexes for notification_preferences table
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_email_enabled ON notification_preferences(email_enabled);
CREATE INDEX idx_notification_preferences_frequency ON notification_preferences(notification_frequency);
CREATE INDEX idx_notification_preferences_updated_at ON notification_preferences(updated_at);

-- Indexes for notification_history table
CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX idx_notification_history_player_name ON notification_history(player_name);
CREATE INDEX idx_notification_history_user_player ON notification_history(user_id, player_name);
CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at);
CREATE INDEX idx_notification_history_status ON notification_history(status);
CREATE INDEX idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_channel ON notification_history(channel);
CREATE INDEX idx_notification_history_delivered_at ON notification_history(delivered_at);
CREATE INDEX idx_notification_history_clicked_at ON notification_history(clicked_at);
CREATE INDEX idx_notification_history_failed_at ON notification_history(failed_at);

-- Indexes for player_notification_settings table
CREATE INDEX idx_player_notification_settings_user_id ON player_notification_settings(user_id);
CREATE INDEX idx_player_notification_settings_player_name ON player_notification_settings(player_name);
CREATE INDEX idx_player_notification_settings_enabled ON player_notification_settings(enabled);
CREATE INDEX idx_player_notification_settings_priority ON player_notification_settings(priority_level);
CREATE INDEX idx_player_notification_settings_updated_at ON player_notification_settings(updated_at);

-- Indexes for unsubscribe_tokens table
CREATE INDEX idx_unsubscribe_tokens_user_id ON unsubscribe_tokens(user_id);
CREATE INDEX idx_unsubscribe_tokens_token ON unsubscribe_tokens(token);
CREATE INDEX idx_unsubscribe_tokens_expires_at ON unsubscribe_tokens(expires_at);
CREATE INDEX idx_unsubscribe_tokens_used_at ON unsubscribe_tokens(used_at);
CREATE INDEX idx_unsubscribe_tokens_type ON unsubscribe_tokens(token_type);

-- Indexes for notification_analytics table
CREATE INDEX idx_notification_analytics_user_id ON notification_analytics(user_id);
CREATE INDEX idx_notification_analytics_date_bucket ON notification_analytics(date_bucket);
CREATE INDEX idx_notification_analytics_user_date ON notification_analytics(user_id, date_bucket);
CREATE INDEX idx_notification_analytics_updated_at ON notification_analytics(updated_at);

-- Indexes for notification_queue table
CREATE INDEX idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority);
CREATE INDEX idx_notification_queue_processing_at ON notification_queue(processing_at);
CREATE INDEX idx_notification_queue_retry_count ON notification_queue(retry_count);
CREATE INDEX idx_notification_queue_player_name ON notification_queue(player_name);
CREATE INDEX idx_notification_queue_type ON notification_queue(notification_type);

-- Indexes for notification_templates table
CREATE INDEX idx_notification_templates_user_id ON notification_templates(user_id);
CREATE INDEX idx_notification_templates_type ON notification_templates(template_type);
CREATE INDEX idx_notification_templates_notification_type ON notification_templates(notification_type);
CREATE INDEX idx_notification_templates_system ON notification_templates(is_system_template);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);

-- Indexes for user_activity table
CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at);
CREATE INDEX idx_user_activity_user_created ON user_activity(user_id, created_at);

-- Composite indexes for common query patterns
CREATE INDEX idx_notification_history_user_sent_status ON notification_history(user_id, sent_at, status);
CREATE INDEX idx_notification_queue_status_priority_scheduled ON notification_queue(status, priority, scheduled_at);
CREATE INDEX idx_player_notification_settings_user_enabled ON player_notification_settings(user_id, enabled);
CREATE INDEX idx_notification_analytics_user_date_desc ON notification_analytics(user_id, date_bucket DESC);
-- Notification Audit Migration - Version 0004
-- Chess.com Helper Email Delivery System
-- Comprehensive audit trail for all email and notification events

-- Notification Audit Table
-- Purpose: Complete audit trail of all notification and email events
CREATE TABLE notification_audit (
  id TEXT PRIMARY KEY,
  
  -- User and notification identification
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'email_queued', 'email_sent', 'email_failed', 'email_delivered', 'email_bounced', 'email_complained'
  template_type TEXT, -- 'game_start', 'game_end', 'welcome', 'digest', 'custom'
  
  -- Event details
  event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_source TEXT NOT NULL, -- 'queue_service', 'email_service', 'resend_webhook', 'manual_action'
  event_data TEXT, -- JSON string of event-specific data
  
  -- Email tracking
  email_queue_id TEXT, -- Reference to email_queue table
  recipient_email TEXT,
  resend_message_id TEXT,
  
  -- Chess.com specific tracking
  chess_com_username TEXT,
  game_id TEXT,
  game_url TEXT,
  
  -- Success/failure tracking
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  error_code TEXT,
  
  -- Performance metrics
  processing_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  
  -- Request tracking
  request_id TEXT, -- For tracing requests across services
  session_id TEXT, -- User session if applicable
  user_agent TEXT,
  ip_address TEXT,
  
  -- Metadata
  metadata TEXT, -- JSON string for additional context
  
  -- Audit fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (email_queue_id) REFERENCES email_queue(id) ON DELETE SET NULL
);

-- Email Delivery Events Table
-- Purpose: Track specific email delivery events from webhooks
CREATE TABLE email_delivery_events (
  id TEXT PRIMARY KEY,
  
  -- Event identification
  resend_message_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained'
  event_timestamp DATETIME NOT NULL,
  
  -- Delivery details
  recipient_email TEXT NOT NULL,
  bounce_type TEXT, -- 'hard', 'soft', 'undetermined'
  bounce_reason TEXT,
  complaint_type TEXT, -- 'abuse', 'fraud', 'virus', 'other'
  
  -- Webhook data
  webhook_id TEXT,
  webhook_timestamp DATETIME,
  webhook_data TEXT, -- Full webhook payload as JSON
  
  -- Processing info
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notification_audit_id TEXT, -- Link to main audit record
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (notification_audit_id) REFERENCES notification_audit(id) ON DELETE SET NULL
);

-- Email Reputation Tracking Table
-- Purpose: Track email reputation metrics for monitoring
CREATE TABLE email_reputation_events (
  id TEXT PRIMARY KEY,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'bounce', 'complaint', 'unsubscribe', 'delivered', 'opened', 'clicked'
  recipient_email TEXT NOT NULL,
  event_timestamp DATETIME NOT NULL,
  
  -- Reputation impact
  reputation_impact INTEGER NOT NULL, -- -10 to +10 scale
  reputation_category TEXT NOT NULL, -- 'deliverability', 'engagement', 'complaints'
  
  -- Associated data
  email_queue_id TEXT,
  resend_message_id TEXT,
  template_type TEXT,
  
  -- Metadata
  metadata TEXT, -- JSON string for additional context
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (email_queue_id) REFERENCES email_queue(id) ON DELETE SET NULL
);

-- System Event Audit Table
-- Purpose: Track system-level events and administrative actions
CREATE TABLE system_event_audit (
  id TEXT PRIMARY KEY,
  
  -- Event identification
  event_type TEXT NOT NULL, -- 'queue_batch_processed', 'cleanup_run', 'admin_action', 'system_error'
  event_category TEXT NOT NULL, -- 'email_system', 'database', 'external_api', 'security'
  
  -- Event details
  event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_source TEXT NOT NULL, -- Service or component that generated the event
  event_message TEXT NOT NULL,
  
  -- Associated data
  affected_records INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  
  -- Context
  user_id TEXT, -- Admin user if applicable
  request_id TEXT,
  metadata TEXT, -- JSON string for additional context
  
  -- Severity and status
  severity TEXT DEFAULT 'info', -- 'debug', 'info', 'warning', 'error', 'critical'
  success BOOLEAN NOT NULL DEFAULT true,
  error_details TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Performance Indexes
-- Primary query patterns: user_id, event_timestamp, notification_type, success status

-- Index for user audit history
CREATE INDEX idx_notification_audit_user 
ON notification_audit(user_id, event_timestamp DESC);

-- Index for email tracking
CREATE INDEX idx_notification_audit_email 
ON notification_audit(email_queue_id, notification_type, event_timestamp);

-- Index for Resend message tracking
CREATE INDEX idx_notification_audit_resend 
ON notification_audit(resend_message_id, notification_type) 
WHERE resend_message_id IS NOT NULL;

-- Index for chess.com game tracking
CREATE INDEX idx_notification_audit_game 
ON notification_audit(chess_com_username, game_id, event_timestamp) 
WHERE chess_com_username IS NOT NULL;

-- Index for error analysis
CREATE INDEX idx_notification_audit_errors 
ON notification_audit(success, error_code, event_timestamp) 
WHERE success = false;

-- Index for template analytics
CREATE INDEX idx_notification_audit_template 
ON notification_audit(template_type, success, event_timestamp) 
WHERE template_type IS NOT NULL;

-- Index for delivery event tracking
CREATE INDEX idx_email_delivery_events_message 
ON email_delivery_events(resend_message_id, event_type, event_timestamp);

-- Index for bounce analysis
CREATE INDEX idx_email_delivery_events_bounce 
ON email_delivery_events(bounce_type, event_timestamp) 
WHERE bounce_type IS NOT NULL;

-- Index for complaint analysis
CREATE INDEX idx_email_delivery_events_complaint 
ON email_delivery_events(complaint_type, event_timestamp) 
WHERE complaint_type IS NOT NULL;

-- Index for reputation tracking
CREATE INDEX idx_email_reputation_events_recipient 
ON email_reputation_events(recipient_email, event_timestamp DESC);

-- Index for reputation category analysis
CREATE INDEX idx_email_reputation_events_category 
ON email_reputation_events(reputation_category, reputation_impact, event_timestamp);

-- Index for system event monitoring
CREATE INDEX idx_system_event_audit_monitoring 
ON system_event_audit(event_category, severity, event_timestamp DESC);

-- Index for error tracking
CREATE INDEX idx_system_event_audit_errors 
ON system_event_audit(success, severity, event_timestamp) 
WHERE success = false;

-- Analytical Views for Reporting

-- Email delivery performance view
CREATE VIEW email_delivery_performance AS
SELECT 
  template_type,
  COUNT(*) as total_emails,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_emails,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_emails,
  ROUND(
    (SUM(CASE WHEN success = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
  ) as success_rate_percent,
  AVG(processing_time_ms) as avg_processing_time_ms,
  DATE(event_timestamp) as date
FROM notification_audit 
WHERE notification_type IN ('email_sent', 'email_failed')
AND event_timestamp > datetime('now', '-30 days')
GROUP BY template_type, DATE(event_timestamp);

-- User engagement metrics view
CREATE VIEW user_engagement_metrics AS
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  SUM(CASE WHEN notification_type = 'email_sent' THEN 1 ELSE 0 END) as emails_sent,
  SUM(CASE WHEN notification_type = 'email_delivered' THEN 1 ELSE 0 END) as emails_delivered,
  SUM(CASE WHEN notification_type = 'email_failed' THEN 1 ELSE 0 END) as emails_failed,
  MAX(event_timestamp) as last_notification_at,
  DATE(event_timestamp) as date
FROM notification_audit 
WHERE event_timestamp > datetime('now', '-30 days')
GROUP BY user_id, DATE(event_timestamp);

-- Email reputation summary view
CREATE VIEW email_reputation_summary AS
SELECT 
  recipient_email,
  COUNT(*) as total_events,
  SUM(reputation_impact) as total_reputation_impact,
  AVG(reputation_impact) as avg_reputation_impact,
  SUM(CASE WHEN reputation_impact < 0 THEN 1 ELSE 0 END) as negative_events,
  SUM(CASE WHEN reputation_impact > 0 THEN 1 ELSE 0 END) as positive_events,
  MAX(event_timestamp) as last_event_at
FROM email_reputation_events
WHERE event_timestamp > datetime('now', '-30 days')
GROUP BY recipient_email;

-- System health monitoring view
CREATE VIEW system_health_summary AS
SELECT 
  event_category,
  severity,
  COUNT(*) as event_count,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_events,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_events,
  MAX(event_timestamp) as last_event_at,
  DATE(event_timestamp) as date
FROM system_event_audit 
WHERE event_timestamp > datetime('now', '-7 days')
GROUP BY event_category, severity, DATE(event_timestamp);

-- Cleanup and maintenance views

-- Old audit records for cleanup (retain 90 days)
CREATE VIEW notification_audit_cleanup AS
SELECT id, user_id, notification_type, event_timestamp
FROM notification_audit 
WHERE event_timestamp < datetime('now', '-90 days');

-- Old delivery events for cleanup (retain 60 days)
CREATE VIEW email_delivery_events_cleanup AS
SELECT id, resend_message_id, event_type, event_timestamp
FROM email_delivery_events 
WHERE event_timestamp < datetime('now', '-60 days');

-- Old reputation events for cleanup (retain 365 days)
CREATE VIEW email_reputation_events_cleanup AS
SELECT id, recipient_email, event_type, event_timestamp
FROM email_reputation_events 
WHERE event_timestamp < datetime('now', '-365 days');

-- Old system events for cleanup (retain 30 days for info/debug, 365 days for errors)
CREATE VIEW system_event_audit_cleanup AS
SELECT id, event_type, severity, event_timestamp
FROM system_event_audit 
WHERE (
  (severity IN ('debug', 'info') AND event_timestamp < datetime('now', '-30 days'))
  OR 
  (severity IN ('warning', 'error', 'critical') AND event_timestamp < datetime('now', '-365 days'))
);

-- Triggers for automatic audit logging

-- Trigger to log email queue status changes
CREATE TRIGGER log_email_queue_status_change
AFTER UPDATE OF status ON email_queue
FOR EACH ROW
WHEN NEW.status != OLD.status
BEGIN
  INSERT INTO notification_audit (
    id, user_id, notification_type, template_type, event_source, 
    email_queue_id, recipient_email, success, processing_time_ms,
    event_data, created_at
  ) VALUES (
    lower(hex(randomblob(16))), -- Generate UUID-like ID
    NEW.user_id,
    'email_status_change',
    NEW.template_type,
    'email_queue_trigger',
    NEW.id,
    NEW.recipient_email,
    CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END,
    CASE 
      WHEN NEW.sent_at IS NOT NULL AND NEW.first_attempted_at IS NOT NULL 
      THEN (julianday(NEW.sent_at) - julianday(NEW.first_attempted_at)) * 24 * 60 * 60 * 1000
      ELSE NULL 
    END,
    json_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'retry_count', NEW.retry_count,
      'error_message', NEW.error_message
    ),
    CURRENT_TIMESTAMP
  );
END;

-- Comments for documentation
PRAGMA user_version = 4;

-- Migration completed successfully
-- Next: Run 0005_user_email_metrics.sql
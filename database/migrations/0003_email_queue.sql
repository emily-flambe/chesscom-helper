-- Email Queue Migration - Version 0003
-- Chess.com Helper Email Delivery System
-- Queue-based email processing with priority, retry logic, and scheduling

-- Email Queue Table
-- Purpose: Queue system for reliable email delivery with retry logic
CREATE TABLE email_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'game_start', 'game_end', 'welcome', 'digest', 'custom'
  template_data TEXT NOT NULL, -- JSON string of template data
  priority INTEGER DEFAULT 3, -- 1=high, 2=medium, 3=low
  
  -- Email content (rendered at queue time)
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT NOT NULL,
  
  -- Queue processing fields
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  
  -- Scheduling and timing
  scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  first_attempted_at DATETIME,
  last_attempted_at DATETIME,
  sent_at DATETIME,
  
  -- Error tracking
  error_message TEXT,
  error_code TEXT,
  
  -- External service tracking
  resend_message_id TEXT,
  webhook_received_at DATETIME,
  
  -- Audit fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email Retry Policy Table
-- Purpose: Exponential backoff retry scheduling
CREATE TABLE email_retry_schedule (
  id TEXT PRIMARY KEY,
  email_queue_id TEXT NOT NULL,
  retry_number INTEGER NOT NULL,
  scheduled_at DATETIME NOT NULL,
  attempted_at DATETIME,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  backoff_seconds INTEGER NOT NULL, -- Exponential backoff delay
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (email_queue_id) REFERENCES email_queue(id) ON DELETE CASCADE,
  UNIQUE(email_queue_id, retry_number)
);

-- Email Batch Processing Table
-- Purpose: Group emails for efficient batch processing
CREATE TABLE email_batch (
  id TEXT PRIMARY KEY,
  batch_size INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  
  -- Processing timing
  started_at DATETIME,
  completed_at DATETIME,
  processing_time_ms INTEGER,
  
  -- Batch statistics
  emails_processed INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Email Batch Items - Junction table for batch processing
CREATE TABLE email_batch_items (
  batch_id TEXT NOT NULL,
  email_queue_id TEXT NOT NULL,
  processing_order INTEGER NOT NULL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (batch_id, email_queue_id),
  FOREIGN KEY (batch_id) REFERENCES email_batch(id) ON DELETE CASCADE,
  FOREIGN KEY (email_queue_id) REFERENCES email_queue(id) ON DELETE CASCADE
);

-- Performance Indexes
-- Primary query patterns: status, priority, scheduled_at, user_id

-- Index for queue processing (pending emails by priority and schedule)
CREATE INDEX idx_email_queue_processing 
ON email_queue(status, priority, scheduled_at) 
WHERE status IN ('pending', 'processing');

-- Index for retry processing
CREATE INDEX idx_email_queue_retry 
ON email_queue(status, retry_count, last_attempted_at) 
WHERE status = 'failed' AND retry_count < max_retries;

-- Index for user email history
CREATE INDEX idx_email_queue_user_history 
ON email_queue(user_id, created_at DESC);

-- Index for template type analytics
CREATE INDEX idx_email_queue_template_analytics 
ON email_queue(template_type, status, created_at);

-- Index for Resend webhook lookups
CREATE INDEX idx_email_queue_resend_message 
ON email_queue(resend_message_id) 
WHERE resend_message_id IS NOT NULL;

-- Index for retry schedule processing
CREATE INDEX idx_email_retry_schedule_processing 
ON email_retry_schedule(scheduled_at, attempted_at) 
WHERE attempted_at IS NULL;

-- Index for batch processing
CREATE INDEX idx_email_batch_processing 
ON email_batch(status, priority, created_at) 
WHERE status IN ('pending', 'processing');

-- Index for batch items ordering
CREATE INDEX idx_email_batch_items_order 
ON email_batch_items(batch_id, processing_order);

-- Triggers for automatic timestamp updates
-- Update timestamp on email_queue changes
CREATE TRIGGER update_email_queue_timestamp 
AFTER UPDATE ON email_queue
BEGIN
  UPDATE email_queue 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Update timestamp on retry schedule changes
CREATE TRIGGER update_email_retry_schedule_timestamp 
AFTER UPDATE ON email_retry_schedule
BEGIN
  UPDATE email_retry_schedule 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Update timestamp on batch changes
CREATE TRIGGER update_email_batch_timestamp 
AFTER UPDATE ON email_batch
BEGIN
  UPDATE email_batch 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Data cleanup views for maintenance
-- View for old completed emails (for cleanup)
CREATE VIEW email_queue_cleanup AS
SELECT id, user_id, status, created_at, sent_at
FROM email_queue 
WHERE status IN ('sent', 'cancelled') 
AND created_at < datetime('now', '-30 days');

-- View for failed emails needing manual review
CREATE VIEW email_queue_failed_review AS
SELECT id, user_id, recipient_email, template_type, retry_count, max_retries, 
       error_message, error_code, last_attempted_at, created_at
FROM email_queue 
WHERE status = 'failed' 
AND retry_count >= max_retries;

-- View for queue performance metrics
CREATE VIEW email_queue_metrics AS
SELECT 
  template_type,
  status,
  COUNT(*) as count,
  AVG(
    CASE 
      WHEN sent_at IS NOT NULL AND created_at IS NOT NULL 
      THEN (julianday(sent_at) - julianday(created_at)) * 24 * 60 * 60 
      ELSE NULL 
    END
  ) as avg_delivery_time_seconds,
  DATE(created_at) as date
FROM email_queue 
WHERE created_at > datetime('now', '-7 days')
GROUP BY template_type, status, DATE(created_at);

-- Comments for documentation
PRAGMA user_version = 3;

-- Migration completed successfully
-- Next: Run 0004_notification_audit.sql
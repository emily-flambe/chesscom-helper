-- User Email Metrics Migration - Version 0005
-- Chess.com Helper Email Delivery System
-- User-specific email delivery metrics and reputation tracking

-- User Email Metrics Table
-- Purpose: Track per-user email delivery metrics and reputation
CREATE TABLE user_email_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- Email delivery metrics
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_delivered INTEGER DEFAULT 0,
  total_emails_bounced INTEGER DEFAULT 0,
  total_emails_complained INTEGER DEFAULT 0,
  total_emails_failed INTEGER DEFAULT 0,
  
  -- Bounce rate tracking
  hard_bounces INTEGER DEFAULT 0,
  soft_bounces INTEGER DEFAULT 0,
  bounce_rate_percent REAL DEFAULT 0.0,
  
  -- Complaint rate tracking
  complaints INTEGER DEFAULT 0,
  complaint_rate_percent REAL DEFAULT 0.0,
  
  -- Engagement metrics
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  open_rate_percent REAL DEFAULT 0.0,
  click_rate_percent REAL DEFAULT 0.0,
  
  -- Reputation scores (0-100 scale)
  deliverability_score INTEGER DEFAULT 100,
  engagement_score INTEGER DEFAULT 100,
  overall_reputation_score INTEGER DEFAULT 100,
  
  -- Reputation status
  reputation_status TEXT DEFAULT 'good', -- 'excellent', 'good', 'warning', 'poor', 'suspended'
  is_suppressed BOOLEAN DEFAULT false,
  suppression_reason TEXT,
  suppression_date DATETIME,
  
  -- Rate limiting
  daily_email_limit INTEGER DEFAULT 100,
  current_daily_count INTEGER DEFAULT 0,
  daily_count_reset_date DATE DEFAULT (DATE('now')),
  
  -- Last activity tracking
  last_email_sent_at DATETIME,
  last_email_delivered_at DATETIME,
  last_bounce_at DATETIME,
  last_complaint_at DATETIME,
  
  -- Metrics calculation
  metrics_last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metrics_period_days INTEGER DEFAULT 30,
  
  -- Audit fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

-- Email Domain Reputation Table
-- Purpose: Track reputation by email domain for better deliverability
CREATE TABLE email_domain_reputation (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  
  -- Domain metrics
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_delivered INTEGER DEFAULT 0,
  total_emails_bounced INTEGER DEFAULT 0,
  total_emails_complained INTEGER DEFAULT 0,
  
  -- Reputation scoring
  deliverability_score INTEGER DEFAULT 100,
  bounce_rate_percent REAL DEFAULT 0.0,
  complaint_rate_percent REAL DEFAULT 0.0,
  
  -- Domain status
  domain_status TEXT DEFAULT 'good', -- 'excellent', 'good', 'warning', 'poor', 'blocked'
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  blocked_at DATETIME,
  
  -- Last activity
  last_email_sent_at DATETIME,
  last_bounce_at DATETIME,
  last_complaint_at DATETIME,
  
  -- Calculation tracking
  metrics_last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(domain)
);

-- Template Performance Metrics Table
-- Purpose: Track performance metrics by email template type
CREATE TABLE template_performance_metrics (
  id TEXT PRIMARY KEY,
  template_type TEXT NOT NULL,
  
  -- Volume metrics
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_delivered INTEGER DEFAULT 0,
  total_emails_bounced INTEGER DEFAULT 0,
  total_emails_complained INTEGER DEFAULT 0,
  total_emails_failed INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_delivery_time_seconds REAL DEFAULT 0.0,
  avg_processing_time_ms REAL DEFAULT 0.0,
  success_rate_percent REAL DEFAULT 0.0,
  
  -- Engagement metrics
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  open_rate_percent REAL DEFAULT 0.0,
  click_rate_percent REAL DEFAULT 0.0,
  
  -- Template health
  template_health_score INTEGER DEFAULT 100,
  health_status TEXT DEFAULT 'good', -- 'excellent', 'good', 'warning', 'poor'
  
  -- Optimization tracking
  last_optimization_at DATETIME,
  optimization_version INTEGER DEFAULT 1,
  
  -- Metrics calculation
  metrics_last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metrics_period_days INTEGER DEFAULT 30,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(template_type)
);

-- Daily Email Metrics Table
-- Purpose: Track daily aggregated metrics for trending analysis
CREATE TABLE daily_email_metrics (
  id TEXT PRIMARY KEY,
  metric_date DATE NOT NULL,
  
  -- Volume metrics
  total_emails_queued INTEGER DEFAULT 0,
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_delivered INTEGER DEFAULT 0,
  total_emails_bounced INTEGER DEFAULT 0,
  total_emails_complained INTEGER DEFAULT 0,
  total_emails_failed INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_queue_time_seconds REAL DEFAULT 0.0,
  avg_delivery_time_seconds REAL DEFAULT 0.0,
  avg_processing_time_ms REAL DEFAULT 0.0,
  
  -- Rate calculations
  success_rate_percent REAL DEFAULT 0.0,
  bounce_rate_percent REAL DEFAULT 0.0,
  complaint_rate_percent REAL DEFAULT 0.0,
  
  -- System performance
  queue_throughput_per_hour REAL DEFAULT 0.0,
  peak_queue_size INTEGER DEFAULT 0,
  avg_queue_size REAL DEFAULT 0.0,
  
  -- Template breakdown (JSON)
  template_breakdown TEXT, -- JSON object with template-specific metrics
  
  -- Reputation impact
  reputation_events_count INTEGER DEFAULT 0,
  avg_reputation_impact REAL DEFAULT 0.0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(metric_date)
);

-- Email Suppression List Table
-- Purpose: Track suppressed email addresses
CREATE TABLE email_suppression_list (
  id TEXT PRIMARY KEY,
  email_address TEXT NOT NULL,
  
  -- Suppression details
  suppression_type TEXT NOT NULL, -- 'bounce', 'complaint', 'unsubscribe', 'manual'
  suppression_reason TEXT NOT NULL,
  suppression_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Source information
  source_email_queue_id TEXT,
  source_template_type TEXT,
  source_event_id TEXT,
  
  -- Suppression context
  user_id TEXT,
  bounce_type TEXT, -- 'hard', 'soft'
  complaint_type TEXT, -- 'abuse', 'fraud', 'virus', 'other'
  
  -- Removal tracking
  is_active BOOLEAN DEFAULT true,
  removed_at DATETIME,
  removed_by TEXT,
  removal_reason TEXT,
  
  -- Metadata
  metadata TEXT, -- JSON for additional context
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(email_address),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (source_email_queue_id) REFERENCES email_queue(id) ON DELETE SET NULL
);

-- Performance Indexes

-- User metrics primary queries
CREATE INDEX idx_user_email_metrics_user 
ON user_email_metrics(user_id);

-- User metrics by reputation status
CREATE INDEX idx_user_email_metrics_reputation 
ON user_email_metrics(reputation_status, overall_reputation_score);

-- User metrics by suppression status
CREATE INDEX idx_user_email_metrics_suppression 
ON user_email_metrics(is_suppressed, suppression_date) 
WHERE is_suppressed = true;

-- Domain reputation queries
CREATE INDEX idx_email_domain_reputation_domain 
ON email_domain_reputation(domain);

-- Domain reputation by status
CREATE INDEX idx_email_domain_reputation_status 
ON email_domain_reputation(domain_status, deliverability_score);

-- Template performance queries
CREATE INDEX idx_template_performance_metrics_template 
ON template_performance_metrics(template_type);

-- Template performance by health
CREATE INDEX idx_template_performance_metrics_health 
ON template_performance_metrics(health_status, template_health_score);

-- Daily metrics queries
CREATE INDEX idx_daily_email_metrics_date 
ON daily_email_metrics(metric_date DESC);

-- Suppression list queries
CREATE INDEX idx_email_suppression_list_email 
ON email_suppression_list(email_address, is_active);

-- Suppression list by type
CREATE INDEX idx_email_suppression_list_type 
ON email_suppression_list(suppression_type, suppression_date);

-- Suppression list by user
CREATE INDEX idx_email_suppression_list_user 
ON email_suppression_list(user_id, is_active) 
WHERE user_id IS NOT NULL;

-- Triggers for automatic metrics updates

-- Update user metrics on email queue status change
CREATE TRIGGER update_user_metrics_on_queue_status
AFTER UPDATE OF status ON email_queue
FOR EACH ROW
WHEN NEW.status != OLD.status
BEGIN
  -- Update user metrics based on status change
  UPDATE user_email_metrics 
  SET 
    total_emails_sent = total_emails_sent + 
      CASE WHEN NEW.status = 'sent' AND OLD.status != 'sent' THEN 1 ELSE 0 END,
    total_emails_failed = total_emails_failed + 
      CASE WHEN NEW.status = 'failed' AND OLD.status != 'failed' THEN 1 ELSE 0 END,
    last_email_sent_at = 
      CASE WHEN NEW.status = 'sent' THEN NEW.sent_at ELSE last_email_sent_at END,
    updated_at = CURRENT_TIMESTAMP
  WHERE user_id = NEW.user_id;
  
  -- Insert record if it doesn't exist
  INSERT OR IGNORE INTO user_email_metrics (id, user_id, created_at)
  VALUES (lower(hex(randomblob(16))), NEW.user_id, CURRENT_TIMESTAMP);
END;

-- Update domain reputation on email events
CREATE TRIGGER update_domain_reputation_on_email_event
AFTER INSERT ON email_delivery_events
FOR EACH ROW
BEGIN
  -- Extract domain from email address
  UPDATE email_domain_reputation 
  SET 
    total_emails_delivered = total_emails_delivered + 
      CASE WHEN NEW.event_type = 'delivered' THEN 1 ELSE 0 END,
    total_emails_bounced = total_emails_bounced + 
      CASE WHEN NEW.event_type = 'bounced' THEN 1 ELSE 0 END,
    total_emails_complained = total_emails_complained + 
      CASE WHEN NEW.event_type = 'complained' THEN 1 ELSE 0 END,
    last_bounce_at = 
      CASE WHEN NEW.event_type = 'bounced' THEN NEW.event_timestamp ELSE last_bounce_at END,
    last_complaint_at = 
      CASE WHEN NEW.event_type = 'complained' THEN NEW.event_timestamp ELSE last_complaint_at END,
    updated_at = CURRENT_TIMESTAMP
  WHERE domain = substr(NEW.recipient_email, instr(NEW.recipient_email, '@') + 1);
  
  -- Insert domain record if it doesn't exist
  INSERT OR IGNORE INTO email_domain_reputation (id, domain, created_at)
  VALUES (
    lower(hex(randomblob(16))), 
    substr(NEW.recipient_email, instr(NEW.recipient_email, '@') + 1), 
    CURRENT_TIMESTAMP
  );
END;

-- Reset daily email count trigger
CREATE TRIGGER reset_daily_email_count
AFTER UPDATE ON user_email_metrics
FOR EACH ROW
WHEN DATE('now') != OLD.daily_count_reset_date
BEGIN
  UPDATE user_email_metrics 
  SET 
    current_daily_count = 0,
    daily_count_reset_date = DATE('now')
  WHERE id = NEW.id;
END;

-- Analytical Views for Reporting

-- User email health summary
CREATE VIEW user_email_health_summary AS
SELECT 
  u.id as user_id,
  u.email,
  uem.total_emails_sent,
  uem.total_emails_delivered,
  uem.bounce_rate_percent,
  uem.complaint_rate_percent,
  uem.overall_reputation_score,
  uem.reputation_status,
  uem.is_suppressed,
  uem.last_email_sent_at,
  uem.updated_at
FROM users u
LEFT JOIN user_email_metrics uem ON u.id = uem.user_id;

-- Top performing templates
CREATE VIEW top_performing_templates AS
SELECT 
  template_type,
  total_emails_sent,
  success_rate_percent,
  open_rate_percent,
  click_rate_percent,
  template_health_score,
  health_status
FROM template_performance_metrics
ORDER BY template_health_score DESC, success_rate_percent DESC;

-- Daily email trends (last 30 days)
CREATE VIEW daily_email_trends AS
SELECT 
  metric_date,
  total_emails_sent,
  total_emails_delivered,
  success_rate_percent,
  bounce_rate_percent,
  complaint_rate_percent,
  avg_delivery_time_seconds,
  queue_throughput_per_hour
FROM daily_email_metrics
WHERE metric_date >= DATE('now', '-30 days')
ORDER BY metric_date DESC;

-- Active suppression summary
CREATE VIEW active_suppression_summary AS
SELECT 
  suppression_type,
  COUNT(*) as count,
  MAX(suppression_date) as latest_suppression
FROM email_suppression_list
WHERE is_active = true
GROUP BY suppression_type;

-- High-risk users view
CREATE VIEW high_risk_users AS
SELECT 
  user_id,
  bounce_rate_percent,
  complaint_rate_percent,
  overall_reputation_score,
  reputation_status,
  last_email_sent_at
FROM user_email_metrics
WHERE 
  reputation_status IN ('warning', 'poor') 
  OR bounce_rate_percent > 5.0 
  OR complaint_rate_percent > 0.5
ORDER BY overall_reputation_score ASC;

-- Domain reputation summary
CREATE VIEW domain_reputation_summary AS
SELECT 
  domain,
  total_emails_sent,
  bounce_rate_percent,
  complaint_rate_percent,
  deliverability_score,
  domain_status,
  is_blocked,
  last_email_sent_at
FROM email_domain_reputation
WHERE total_emails_sent > 0
ORDER BY deliverability_score DESC;

-- Automatic timestamp updates
CREATE TRIGGER update_user_email_metrics_timestamp 
AFTER UPDATE ON user_email_metrics
BEGIN
  UPDATE user_email_metrics 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER update_email_domain_reputation_timestamp 
AFTER UPDATE ON email_domain_reputation
BEGIN
  UPDATE email_domain_reputation 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER update_template_performance_metrics_timestamp 
AFTER UPDATE ON template_performance_metrics
BEGIN
  UPDATE template_performance_metrics 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER update_daily_email_metrics_timestamp 
AFTER UPDATE ON daily_email_metrics
BEGIN
  UPDATE daily_email_metrics 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER update_email_suppression_list_timestamp 
AFTER UPDATE ON email_suppression_list
BEGIN
  UPDATE email_suppression_list 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Comments for documentation
PRAGMA user_version = 5;

-- Migration completed successfully
-- Email delivery system database schema is now complete
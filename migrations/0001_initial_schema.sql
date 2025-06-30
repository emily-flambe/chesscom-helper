-- Initial database schema for Chess.com Helper MVP

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Player Subscriptions - tracks which users subscribe to which players
CREATE TABLE player_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, chess_com_username),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player Status - tracks current status of monitored players
CREATE TABLE player_status (
  chess_com_username TEXT PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  is_playing BOOLEAN DEFAULT false,
  current_game_url TEXT,
  last_seen DATETIME,
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences table
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT true,
  notification_frequency TEXT DEFAULT 'immediate', -- 'immediate', 'digest', 'disabled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification Log - tracks sent notifications to avoid duplicates
CREATE TABLE notification_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'game_started', 'game_ended'
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email_delivered BOOLEAN DEFAULT false,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Monitoring Jobs - tracks scheduled monitoring tasks
CREATE TABLE monitoring_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'player_check', 'batch_poll', 'cleanup'
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent Tasks - tracks ongoing agent operations (for future Claude integration)
CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  agent_type TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_data JSON NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0,
  estimated_completion DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Agent Results - stores analysis results (for future Claude integration)
CREATE TABLE agent_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  result_type TEXT NOT NULL,
  result_data JSON NOT NULL,
  confidence_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

-- Game Analysis - stores chess game analysis (for future features)
CREATE TABLE game_analysis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pgn TEXT NOT NULL,
  analysis_data JSON NOT NULL,
  move_evaluations JSON,
  insights JSON,
  analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Behavior Insights (for future AI features)
CREATE TABLE user_behavior_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  insight_data JSON NOT NULL,
  confidence_score REAL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification Optimization (for future AI features)
CREATE TABLE notification_optimizations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  optimal_timing TIME,
  personalization_data JSON,
  effectiveness_score REAL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_player_subscriptions_user_id ON player_subscriptions(user_id);
CREATE INDEX idx_player_subscriptions_username ON player_subscriptions(chess_com_username);
CREATE INDEX idx_player_status_last_checked ON player_status(last_checked);
CREATE INDEX idx_notification_log_user_player ON notification_log(user_id, chess_com_username);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at);
CREATE INDEX idx_monitoring_jobs_status ON monitoring_jobs(status);
CREATE INDEX idx_agent_tasks_user_id ON agent_tasks(user_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_results_task_id ON agent_results(task_id);
CREATE INDEX idx_game_analysis_user_id ON game_analysis(user_id);
CREATE INDEX idx_user_behavior_insights_user_id ON user_behavior_insights(user_id);
CREATE INDEX idx_notification_optimizations_user_id ON notification_optimizations(user_id);
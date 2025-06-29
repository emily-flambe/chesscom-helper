-- D1 Database Schema for Chess.com Helper
-- This schema replicates the Django models for D1 compatibility

-- Users table
CREATE TABLE IF NOT EXISTS chesscom_app_user (
    player_id INTEGER PRIMARY KEY,
    url TEXT,
    name TEXT,
    username TEXT UNIQUE NOT NULL,
    followers INTEGER DEFAULT 0,
    country TEXT,
    location TEXT,
    last_online INTEGER,
    joined INTEGER,
    status TEXT,
    is_streamer INTEGER DEFAULT 0,  -- SQLite uses integers for booleans
    verified INTEGER DEFAULT 0,
    league TEXT,
    streaming_platforms TEXT,  -- JSON stored as TEXT
    is_playing INTEGER DEFAULT 0
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_username ON chesscom_app_user(username);

-- Email subscriptions table  
CREATE TABLE IF NOT EXISTS chesscom_app_emailsubscription (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    player_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,  -- ISO timestamp string
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (player_id) REFERENCES chesscom_app_user(player_id) ON DELETE CASCADE
);

-- Create unique constraint for email + player combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_player ON chesscom_app_emailsubscription(email, player_id);

-- Create index on player_id for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscription_player ON chesscom_app_emailsubscription(player_id);

-- Notification log table
CREATE TABLE IF NOT EXISTS chesscom_app_notificationlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    sent_at TEXT NOT NULL,  -- ISO timestamp string
    notification_type TEXT DEFAULT 'live_match',
    success INTEGER DEFAULT 1,
    error_message TEXT,
    FOREIGN KEY (subscription_id) REFERENCES chesscom_app_emailsubscription(id) ON DELETE CASCADE
);

-- Create index on subscription_id for faster log lookups
CREATE INDEX IF NOT EXISTS idx_log_subscription ON chesscom_app_notificationlog(subscription_id);

-- Create index on sent_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_log_sent_at ON chesscom_app_notificationlog(sent_at);
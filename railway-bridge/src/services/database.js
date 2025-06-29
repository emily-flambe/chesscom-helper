const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection on initialization
    this.pool.connect((err, client, release) => {
      if (err) {
        logger.error('Error acquiring client', { error: err.message });
        return;
      }
      logger.info('Database connection pool initialized');
      release();
    });
  }

  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Query executed', { duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Database query error', { 
        error: error.message, 
        query: text.substring(0, 100) 
      });
      throw error;
    }
  }

  // User operations
  async getUsers() {
    const result = await this.query(`
      SELECT player_id, username, name, title, followers, country, 
             location, joined, status, is_playing, last_online, url
      FROM chesscom_app_user 
      ORDER BY username ASC
    `);
    return result.rows;
  }

  async getUserByUsername(username) {
    const result = await this.query(`
      SELECT player_id, username, name, title, followers, country, 
             location, joined, status, is_playing, last_online, url
      FROM chesscom_app_user 
      WHERE username = $1
      LIMIT 1
    `, [username]);
    return result.rows[0] || null;
  }

  async addUser(userData) {
    const {
      player_id, username, name, title, followers, country,
      location, joined, status, is_playing, last_online, url
    } = userData;

    const result = await this.query(`
      INSERT INTO chesscom_app_user 
      (player_id, username, name, title, followers, country, location, joined, status, is_playing, last_online, url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING player_id, username, name, title, followers, country, location, joined, status, is_playing, last_online, url
    `, [player_id, username, name, title, followers, country, location, joined, status, is_playing, last_online, url]);
    
    return result.rows[0];
  }

  async removeUser(username) {
    const result = await this.query(`
      DELETE FROM chesscom_app_user 
      WHERE username = $1
    `, [username]);
    return { success: result.rowCount > 0, deletedCount: result.rowCount };
  }

  async updateUserStatus(username, isPlaying) {
    const result = await this.query(`
      UPDATE chesscom_app_user 
      SET is_playing = $1, last_online = EXTRACT(EPOCH FROM NOW())
      WHERE username = $2
    `, [isPlaying, username]);
    return { success: result.rowCount > 0, updatedCount: result.rowCount };
  }

  // Subscription operations
  async getUserSubscriptions(username) {
    const result = await this.query(`
      SELECT es.email, es.is_active, es.created_at, es.updated_at
      FROM chesscom_app_emailsubscription es
      JOIN chesscom_app_user u ON es.player_id = u.player_id
      WHERE u.username = $1
      ORDER BY es.created_at DESC
    `, [username]);
    return result.rows;
  }

  async getSubscriptionByEmail(playerId, email) {
    const result = await this.query(`
      SELECT * FROM chesscom_app_emailsubscription
      WHERE player_id = $1 AND email = $2
      LIMIT 1
    `, [playerId, email]);
    return result.rows[0] || null;
  }

  async addSubscription(playerId, email) {
    // First check if subscription exists (active or inactive)
    const existing = await this.getSubscriptionByEmail(playerId, email);
    
    if (existing) {
      // Reactivate existing subscription
      const result = await this.query(`
        UPDATE chesscom_app_emailsubscription
        SET is_active = true, updated_at = NOW()
        WHERE player_id = $1 AND email = $2
        RETURNING *
      `, [playerId, email]);
      return result.rows[0];
    } else {
      // Create new subscription
      const result = await this.query(`
        INSERT INTO chesscom_app_emailsubscription 
        (player_id, email, is_active, created_at, updated_at)
        VALUES ($1, $2, true, NOW(), NOW())
        RETURNING *
      `, [playerId, email]);
      return result.rows[0];
    }
  }

  async removeSubscription(playerId, email) {
    const result = await this.query(`
      UPDATE chesscom_app_emailsubscription
      SET is_active = false, updated_at = NOW()
      WHERE player_id = $1 AND email = $2
    `, [playerId, email]);
    return { success: result.rowCount > 0, updatedCount: result.rowCount };
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.query('SELECT NOW() as timestamp, version() as version');
      return {
        status: 'healthy',
        timestamp: result.rows[0].timestamp,
        version: result.rows[0].version
      };
    } catch (error) {
      throw new Error(`Database health check failed: ${error.message}`);
    }
  }

  async close() {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

module.exports = DatabaseService;
export class D1DatabaseService {
  constructor(db) {
    this.db = db;
  }

  async getUsers() {
    try {
      const { results } = await this.db.prepare(`
        SELECT player_id, username, name, url, country, location, 
               followers, last_online, joined, status, league, 
               is_streamer, verified, is_playing, streaming_platforms
        FROM chesscom_app_user 
        ORDER BY username ASC
      `).all();
      
      return results.map(user => ({
        ...user,
        streaming_platforms: user.streaming_platforms ? JSON.parse(user.streaming_platforms) : []
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users from database');
    }
  }

  async getUserByUsername(username) {
    try {
      const result = await this.db.prepare(`
        SELECT player_id, username, name, url, country, location, 
               followers, last_online, joined, status, league, 
               is_streamer, verified, is_playing, streaming_platforms
        FROM chesscom_app_user 
        WHERE username = ?
      `).bind(username).first();
      
      if (result) {
        result.streaming_platforms = result.streaming_platforms ? JSON.parse(result.streaming_platforms) : [];
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      throw new Error('Failed to fetch user from database');
    }
  }

  async addUser(userData) {
    try {
      const streamingPlatforms = JSON.stringify(userData.streaming_platforms || []);
      
      const result = await this.db.prepare(`
        INSERT OR REPLACE INTO chesscom_app_user 
        (player_id, username, name, url, country, location, followers, 
         last_online, joined, status, league, is_streamer, verified, 
         is_playing, streaming_platforms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userData.player_id,
        userData.username,
        userData.name,
        userData.url || null,
        userData.country || null,
        userData.location || null,
        userData.followers || 0,
        userData.last_online,
        userData.joined,
        userData.status || 'offline',
        userData.league || null,
        userData.is_streamer || false,
        userData.verified || false,
        userData.is_playing || false,
        streamingPlatforms
      ).run();

      if (!result.success) {
        throw new Error('Failed to insert user');
      }

      return {
        player_id: userData.player_id,
        username: userData.username,
        name: userData.name,
        url: userData.url,
        country: userData.country,
        location: userData.location,
        followers: userData.followers || 0,
        last_online: userData.last_online,
        joined: userData.joined,
        status: userData.status || 'offline',
        league: userData.league,
        is_streamer: userData.is_streamer || false,
        verified: userData.verified || false,
        is_playing: userData.is_playing || false,
        streaming_platforms: userData.streaming_platforms || []
      };
    } catch (error) {
      console.error('Error adding user:', error);
      throw new Error('Failed to add user to database');
    }
  }

  async removeUser(username) {
    try {
      const result = await this.db.prepare(`
        DELETE FROM chesscom_app_user WHERE username = ?
      `).bind(username).run();
      
      return { rowCount: result.changes };
    } catch (error) {
      console.error('Error removing user:', error);
      throw new Error('Failed to remove user from database');
    }
  }

  async updateUserStatus(username, isPlaying) {
    try {
      const result = await this.db.prepare(`
        UPDATE chesscom_app_user 
        SET is_playing = ?, last_online = ?
        WHERE username = ?
      `).bind(isPlaying, Date.now(), username).run();
      
      return { rowCount: result.changes };
    } catch (error) {
      console.error('Error updating user status:', error);
      throw new Error('Failed to update user status');
    }
  }

  async getSubscriptions(username) {
    try {
      const { results } = await this.db.prepare(`
        SELECT es.id, es.email, es.player_id, es.created_at, es.is_active
        FROM chesscom_app_emailsubscription es
        JOIN chesscom_app_user u ON es.player_id = u.player_id
        WHERE u.username = ? AND es.is_active = true
      `).bind(username).all();
      
      return results;
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw new Error('Failed to fetch subscriptions from database');
    }
  }

  async getSubscriptionByEmail(playerId, email) {
    try {
      const result = await this.db.prepare(`
        SELECT id, email, player_id, created_at, is_active
        FROM chesscom_app_emailsubscription 
        WHERE player_id = ? AND email = ?
      `).bind(playerId, email).first();
      
      return result;
    } catch (error) {
      console.error('Error fetching subscription by email:', error);
      throw new Error('Failed to fetch subscription from database');
    }
  }

  async getUserSubscriptions(playerId) {
    try {
      const { results } = await this.db.prepare(`
        SELECT id, email, player_id, created_at, is_active
        FROM chesscom_app_emailsubscription 
        WHERE player_id = ? AND is_active = true
      `).bind(playerId).all();
      
      return results;
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      throw new Error('Failed to fetch user subscriptions from database');
    }
  }

  async addSubscription(playerId, email) {
    try {
      const now = new Date().toISOString();
      
      // Try to reactivate existing subscription first
      const existing = await this.getSubscriptionByEmail(playerId, email);
      if (existing) {
        await this.db.prepare(`
          UPDATE chesscom_app_emailsubscription 
          SET is_active = true 
          WHERE id = ?
        `).bind(existing.id).run();
        
        return {
          id: existing.id,
          player_id: playerId,
          email: email,
          is_active: true,
          created_at: existing.created_at
        };
      }
      
      // Create new subscription
      const result = await this.db.prepare(`
        INSERT INTO chesscom_app_emailsubscription (email, player_id, created_at, is_active)
        VALUES (?, ?, ?, true)
      `).bind(email, playerId, now).run();

      if (!result.success) {
        throw new Error('Failed to insert subscription');
      }

      return {
        id: result.meta.last_row_id,
        player_id: playerId,
        email: email,
        is_active: true,
        created_at: now
      };
    } catch (error) {
      console.error('Error adding subscription:', error);
      throw new Error('Failed to add subscription to database');
    }
  }

  async removeSubscription(playerId, email) {
    try {
      const result = await this.db.prepare(`
        UPDATE chesscom_app_emailsubscription 
        SET is_active = false 
        WHERE player_id = ? AND email = ?
      `).bind(playerId, email).run();
      
      return { rowCount: result.changes };
    } catch (error) {
      console.error('Error removing subscription:', error);
      throw new Error('Failed to remove subscription from database');
    }
  }

  async logNotification(notificationData) {
    try {
      const now = new Date().toISOString();
      
      const result = await this.db.prepare(`
        INSERT INTO chesscom_app_notificationlog 
        (subscription_id, sent_at, notification_type, success, error_message)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        notificationData.subscription_id,
        notificationData.sent_at || now,
        notificationData.notification_type || 'live_match',
        notificationData.success !== false,
        notificationData.error_message || null
      ).run();

      if (!result.success) {
        throw new Error('Failed to log notification');
      }

      return {
        id: result.meta.last_row_id,
        subscription_id: notificationData.subscription_id,
        sent_at: notificationData.sent_at || now,
        notification_type: notificationData.notification_type || 'live_match',
        success: notificationData.success !== false,
        error_message: notificationData.error_message || null
      };
    } catch (error) {
      console.error('Error logging notification:', error);
      throw new Error('Failed to log notification to database');
    }
  }

  async close() {
    // D1 doesn't require explicit connection cleanup
    // The binding is managed by the Workers runtime
  }
}

// Backward compatibility alias
export const DatabaseService = D1DatabaseService;
import postgres from 'postgres';

export class DatabaseService {
  constructor(databaseUrl) {
    this.sql = postgres(databaseUrl);
  }

  async getUsers() {
    return await this.sql`
      SELECT player_id, username, name, title, followers, country, 
             location, joined, status, is_playing, last_online, avatar
      FROM chesscom_app_user 
      ORDER BY username ASC
    `;
  }

  async getUserByUsername(username) {
    const users = await this.sql`
      SELECT player_id, username, name, title, followers, country, 
             location, joined, status, is_playing, last_online, avatar
      FROM chesscom_app_user 
      WHERE username = ${username}
      LIMIT 1
    `;
    return users[0] || null;
  }

  async addUser(userData) {
    const users = await this.sql`
      INSERT INTO chesscom_app_user ${this.sql(userData)}
      RETURNING player_id, username, name, title, followers, country, 
                location, joined, status, is_playing, last_online, avatar
    `;
    return users[0];
  }

  async removeUser(username) {
    return await this.sql`
      DELETE FROM chesscom_app_user 
      WHERE username = ${username}
    `;
  }

  async updateUserStatus(username, isPlaying) {
    return await this.sql`
      UPDATE chesscom_app_user 
      SET is_playing = ${isPlaying}, last_online = NOW()
      WHERE username = ${username}
    `;
  }

  async getSubscriptions(username) {
    return await this.sql`
      SELECT es.* FROM chesscom_app_emailsubscription es
      JOIN chesscom_app_user u ON es.player_id = u.player_id
      WHERE u.username = ${username} AND es.is_active = true
    `;
  }

  async getSubscriptionByEmail(playerId, email) {
    const subscriptions = await this.sql`
      SELECT * FROM chesscom_app_emailsubscription
      WHERE player_id = ${playerId} AND email = ${email}
      LIMIT 1
    `;
    return subscriptions[0] || null;
  }

  async getUserSubscriptions(playerId) {
    return await this.sql`
      SELECT email, is_active, created_at, updated_at
      FROM chesscom_app_emailsubscription
      WHERE player_id = ${playerId}
      ORDER BY created_at DESC
    `;
  }

  async addSubscription(playerId, email) {
    // First check if subscription exists (active or inactive)
    const existing = await this.getSubscriptionByEmail(playerId, email);
    
    if (existing) {
      // Reactivate existing subscription
      const subscriptions = await this.sql`
        UPDATE chesscom_app_emailsubscription
        SET is_active = true, updated_at = NOW()
        WHERE player_id = ${playerId} AND email = ${email}
        RETURNING *
      `;
      return subscriptions[0];
    } else {
      // Create new subscription
      const subscriptions = await this.sql`
        INSERT INTO chesscom_app_emailsubscription 
        (player_id, email, is_active, created_at, updated_at)
        VALUES (${playerId}, ${email}, true, NOW(), NOW())
        RETURNING *
      `;
      return subscriptions[0];
    }
  }

  async removeSubscription(playerId, email) {
    return await this.sql`
      UPDATE chesscom_app_emailsubscription
      SET is_active = false, updated_at = NOW()
      WHERE player_id = ${playerId} AND email = ${email}
    `;
  }

  async close() {
    await this.sql.end();
  }
}
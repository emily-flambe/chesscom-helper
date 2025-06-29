import postgres from 'postgres';

export class DatabaseService {
  constructor(databaseUrl) {
    this.sql = postgres(databaseUrl);
  }

  async getUsers() {
    return await this.sql`
      SELECT player_id, username, name, is_playing, last_online
      FROM chesscom_app_user 
      ORDER BY username ASC
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

  async logNotification(notificationData) {
    return await this.sql`
      INSERT INTO chesscom_app_notificationlog ${this.sql(notificationData)}
      RETURNING *
    `;
  }

  async close() {
    await this.sql.end();
  }
}
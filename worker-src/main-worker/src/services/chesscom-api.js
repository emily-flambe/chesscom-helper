export class ChesscomAPI {
  constructor() {
    this.baseUrl = 'https://api.chess.com/pub';
  }

  /**
   * Fetch Chess.com profile to validate username
   * @param {string} username - Chess.com username
   * @returns {Object|null} Profile data or null if user doesn't exist
   */
  async fetchChesscomProfile(username) {
    try {
      const response = await fetch(`${this.baseUrl}/player/${username.toLowerCase()}`);
      
      if (!response.ok) {
        console.log(`Chess.com API returned ${response.status} for user: ${username}`);
        return null;
      }

      const profile = await response.json();
      
      // Extract player ID from URL
      const playerId = this.extractPlayerIdFromUrl(profile.url);
      
      return {
        player_id: playerId,
        username: profile.username,
        name: profile.name || profile.username,
        title: profile.title || null,
        followers: profile.followers || 0,
        country: profile.country ? this.extractCountryCode(profile.country) : null,
        location: profile.location || null,
        joined: profile.joined || null,
        status: profile.status || 'offline',
        last_online: profile.last_online || null,
        avatar: profile.avatar || null,
        url: profile.url || null
      };
    } catch (error) {
      console.error(`Error fetching Chess.com profile for ${username}:`, error);
      return null;
    }
  }

  /**
   * Extract player ID from Chess.com profile URL
   * @param {string} url - Chess.com profile URL
   * @returns {string} Player ID
   */
  extractPlayerIdFromUrl(url) {
    if (!url) return null;
    
    // URL format: https://www.chess.com/member/username
    const parts = url.split('/');
    return parts[parts.length - 1] || null;
  }

  /**
   * Extract country code from Chess.com country URL
   * @param {string} countryUrl - Chess.com country URL
   * @returns {string} Country code
   */
  extractCountryCode(countryUrl) {
    if (!countryUrl) return null;
    
    // URL format: https://api.chess.com/pub/country/US
    const parts = countryUrl.split('/');
    return parts[parts.length - 1] || null;
  }

  /**
   * Get current games for a player
   * @param {string} username - Chess.com username
   * @returns {Object|null} Current games data
   */
  async getCurrentGames(username) {
    try {
      const response = await fetch(`${this.baseUrl}/player/${username.toLowerCase()}/games/to-move`);
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching current games for ${username}:`, error);
      return null;
    }
  }

  /**
   * Check if a player is currently online/playing
   * @param {string} username - Chess.com username
   * @returns {boolean} True if player is currently playing
   */
  async isPlayerPlaying(username) {
    try {
      const games = await this.getCurrentGames(username);
      return games && games.games && games.games.length > 0;
    } catch (error) {
      console.error(`Error checking if ${username} is playing:`, error);
      return false;
    }
  }
}
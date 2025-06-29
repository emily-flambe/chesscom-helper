import { DatabaseService } from './database';

export async function checkLiveMatches(env) {
  const db = new DatabaseService(env.DATABASE_URL);
  const notifications = [];

  try {
    const users = await db.getUsers();
    
    for (const user of users) {
      const isCurrentlyPlaying = await checkChessComAPI(user.username);
      
      // User started playing (transition from false to true)
      if (isCurrentlyPlaying && !user.is_playing) {
        const subscriptions = await db.getSubscriptions(user.username);
        notifications.push(...subscriptions.map(sub => ({
          email: sub.email,
          username: user.username,
          subscriptionId: sub.id
        })));
      }
      
      // Update user status
      await db.updateUserStatus(user.username, isCurrentlyPlaying);
    }
  } finally {
    await db.close();
  }

  return notifications;
}

async function checkChessComAPI(username) {
  try {
    const response = await fetch(`https://api.chess.com/pub/player/${username}/games/to-move`);
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.games && data.games.length > 0;
  } catch (error) {
    console.error(`Error checking ${username}:`, error);
    return false;
  }
}
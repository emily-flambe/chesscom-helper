import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'

export interface PlayerSubscription {
  id: string
  userId: string
  chessComUsername: string
  createdAt: string
}

export interface CreateSubscriptionData {
  userId: string
  chessComUsername: string
}

export async function getPlayerSubscriptions(db: D1Database, userId: string): Promise<PlayerSubscription[]> {
  try {
    const result = await db.prepare(`
      SELECT id, user_id, chess_com_username, created_at
      FROM player_subscriptions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all()

    if (!result.results) {
return []
}

    return result.results.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      chessComUsername: row.chess_com_username as string,
      createdAt: row.created_at as string
    }))
  } catch (error) {
    console.error('Get player subscriptions error:', error)
    throw createApiError('Failed to fetch subscriptions', 500, 'SUBSCRIPTION_FETCH_FAILED', error)
  }
}

export async function createPlayerSubscription(db: D1Database, subscriptionData: CreateSubscriptionData): Promise<PlayerSubscription> {
  const id = await generateSecureId()
  const now = new Date().toISOString()

  try {
    const existingResult = await db.prepare(`
      SELECT id FROM player_subscriptions
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(subscriptionData.userId, subscriptionData.chessComUsername).first()

    if (existingResult) {
      throw createApiError('Already subscribed to this player', 409, 'SUBSCRIPTION_EXISTS')
    }

    const result = await db.prepare(`
      INSERT INTO player_subscriptions (id, user_id, chess_com_username, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, subscriptionData.userId, subscriptionData.chessComUsername, now).run()

    if (!result.success) {
      throw createApiError('Failed to create subscription', 500, 'SUBSCRIPTION_CREATION_FAILED')
    }

    await ensurePlayerInMonitoringSystem(db, subscriptionData.chessComUsername)

    return {
      id,
      userId: subscriptionData.userId,
      chessComUsername: subscriptionData.chessComUsername,
      createdAt: now
    }
  } catch (error) {
    console.error('Create subscription error:', error)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createApiError('Already subscribed to this player', 409, 'SUBSCRIPTION_EXISTS')
    }
    throw createApiError('Failed to create subscription', 500, 'SUBSCRIPTION_CREATION_FAILED', error)
  }
}

export async function deletePlayerSubscription(db: D1Database, userId: string, chessComUsername: string): Promise<void> {
  try {
    const result = await db.prepare(`
      DELETE FROM player_subscriptions
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(userId, chessComUsername).run()

    if (!result.success) {
      throw createApiError('Failed to delete subscription', 500, 'SUBSCRIPTION_DELETE_FAILED')
    }

    await cleanupUnusedPlayerFromMonitoring(db, chessComUsername)
  } catch (error) {
    console.error('Delete subscription error:', error)
    throw createApiError('Failed to delete subscription', 500, 'SUBSCRIPTION_DELETE_FAILED', error)
  }
}

export async function getSubscribersForPlayer(db: D1Database, chessComUsername: string): Promise<string[]> {
  try {
    const result = await db.prepare(`
      SELECT DISTINCT user_id
      FROM player_subscriptions
      WHERE chess_com_username = ?
    `).bind(chessComUsername).all()

    if (!result.results) {
return []
}

    return result.results.map(row => row.user_id as string)
  } catch (error) {
    console.error('Get subscribers for player error:', error)
    throw createApiError('Failed to fetch subscribers', 500, 'SUBSCRIBERS_FETCH_FAILED', error)
  }
}

async function ensurePlayerInMonitoringSystem(db: D1Database, chessComUsername: string): Promise<void> {
  try {
    const existingPlayer = await db.prepare(`
      SELECT chess_com_username FROM player_status
      WHERE chess_com_username = ?
    `).bind(chessComUsername).first()

    if (!existingPlayer) {
      const now = new Date().toISOString()
      await db.prepare(`
        INSERT INTO player_status (chess_com_username, is_online, is_playing, last_checked, updated_at)
        VALUES (?, false, false, ?, ?)
      `).bind(chessComUsername, now, now).run()
    }
  } catch (error) {
    console.error('Ensure player in monitoring system error:', error)
  }
}

async function cleanupUnusedPlayerFromMonitoring(db: D1Database, chessComUsername: string): Promise<void> {
  try {
    const subscribers = await getSubscribersForPlayer(db, chessComUsername)
    
    if (subscribers.length === 0) {
      await db.prepare(`
        DELETE FROM player_status
        WHERE chess_com_username = ?
      `).bind(chessComUsername).run()
    }
  } catch (error) {
    console.error('Cleanup unused player error:', error)
  }
}
import { Router, json, error } from 'itty-router'
import { 
  getNotificationPreferences, 
  updateNotificationPreferences,
  getNotificationHistory,
  getPlayerNotificationPreferences,
  updatePlayerNotificationPreferences,
  getAllPlayerNotificationPreferences
} from '../services/notificationService'
import type { Env } from '../index'

const router = Router({ base: '/api/v1/notifications' })

router.get('/preferences', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const preferences = await getNotificationPreferences(env.DB, userId)
    return json({ preferences })

  } catch (err) {
    console.error('Get notification preferences error:', err)
    return error(500, 'Failed to fetch notification preferences')
  }
})

router.put('/preferences', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const body = await request.json() as {
      emailNotifications?: boolean
      notificationFrequency?: 'immediate' | 'digest' | 'disabled'
    }

    const preferences = await updateNotificationPreferences(env.DB, userId, body)
    return json({ preferences })

  } catch (err) {
    console.error('Update notification preferences error:', err)
    return error(500, 'Failed to update notification preferences')
  }
})

router.get('/history', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const history = await getNotificationHistory(env.DB, userId, { limit, offset })
    return json({ 
      notifications: history,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit
      }
    })

  } catch (err) {
    console.error('Get notification history error:', err)
    return error(500, 'Failed to fetch notification history')
  }
})

router.post('/internal/send', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as {
      userId: string
      type: 'game_started' | 'game_ended'
      data: {
        playerName: string
        gameUrl?: string
        result?: string
      }
    }

    if (!body.userId || !body.type || !body.data?.playerName) {
      return error(400, 'Missing required fields')
    }

    const sendResult = await import('../services/emailService').then(m =>
      m.sendNotificationEmail(env, body.userId, body.type, body.data)
    )

    return json({
      message: 'Notification sent',
      notificationId: sendResult.notificationId,
      delivered: sendResult.delivered,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Send notification error:', err)
    return error(500, 'Failed to send notification')
  }
})

router.post('/internal/queue', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as {
      userId: string
      playerName: string
      eventType: 'game_started' | 'game_ended'
      gameUrl?: string
      result?: string
    }

    if (!body.userId || !body.playerName || !body.eventType) {
      return error(400, 'Missing required fields')
    }

    const queueResult = await import('../services/notificationService').then(m =>
      m.queueNotification(env.DB, body)
    )

    return json({
      message: 'Notification queued',
      queueId: queueResult.id,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Queue notification error:', err)
    return error(500, 'Failed to queue notification')
  }
})

// Per-player notification preferences

router.get('/player-preferences', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const allPreferences = await getAllPlayerNotificationPreferences(env.DB, userId)
    return json({ playerPreferences: allPreferences })

  } catch (err) {
    console.error('Get all player notification preferences error:', err)
    return error(500, 'Failed to fetch player notification preferences')
  }
})

router.get('/player-preferences/:username', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const { username } = request.params
    if (!username) {
      return error(400, 'Username parameter required')
    }

    const preferences = await getPlayerNotificationPreferences(env.DB, userId, username)
    return json({ playerPreferences: preferences })

  } catch (err) {
    console.error('Get player notification preferences error:', err)
    return error(500, 'Failed to fetch player notification preferences')
  }
})

router.put('/player-preferences/:username', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const { username } = request.params
    if (!username) {
      return error(400, 'Username parameter required')
    }

    const body = await request.json() as {
      notifyOnline?: boolean
      notifyGameStart?: boolean
      notifyGameEnd?: boolean
    }

    // Validate at least one field is provided
    if (body.notifyOnline === undefined && body.notifyGameStart === undefined && body.notifyGameEnd === undefined) {
      return error(400, 'At least one notification preference must be specified')
    }

    const preferences = await updatePlayerNotificationPreferences(env.DB, userId, username, body)
    return json({ playerPreferences: preferences })

  } catch (err) {
    console.error('Update player notification preferences error:', err)
    if (err instanceof Error && err.message.includes('SUBSCRIPTION_NOT_FOUND')) {
      return error(404, 'Player subscription not found')
    }
    return error(500, 'Failed to update player notification preferences')
  }
})

export { router as notificationRoutes }
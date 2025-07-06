import { Router, json, error } from 'itty-router'
import { getNotificationPreferences, updateNotificationPreferences } from '../services/notificationService'
import { getNotificationHistory } from '../services/notificationService'
import {
  getNotificationPreferences as getNotificationPreferencesV2,
  updateNotificationPreferences as updateNotificationPreferencesV2,
  getPlayerNotificationSettings,
  updatePlayerNotificationSettings,
  deletePlayerNotificationSettings,
  getNotificationHistory as getNotificationHistoryV2,
  getNotificationAnalytics,
  getNotificationQueue,
  getNotificationQueueStatus,
  getDashboardStats
} from '../services/notificationPreferencesService'
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

// =============================================================================
// PHASE 4: Enhanced Notification Management API Endpoints
// =============================================================================

// Enhanced notification preferences endpoint
router.get('/preferences/v2', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const preferences = await getNotificationPreferencesV2(env.DB, userId)
    return json({ preferences })

  } catch (err) {
    console.error('Get notification preferences v2 error:', err)
    return error(500, 'Failed to fetch notification preferences')
  }
})

router.put('/preferences/v2', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const body = await request.json()
    const preferences = await updateNotificationPreferencesV2(env.DB, userId, body)
    return json({ preferences })

  } catch (err) {
    console.error('Update notification preferences v2 error:', err)
    return error(500, 'Failed to update notification preferences')
  }
})

// Player-specific notification settings
router.get('/players', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const settings = await getPlayerNotificationSettings(env.DB, userId)
    return json({ settings })

  } catch (err) {
    console.error('Get player notification settings error:', err)
    return error(500, 'Failed to fetch player notification settings')
  }
})

router.get('/players/:playerName', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const playerName = request.params.playerName
    if (!playerName) {
      return error(400, 'Player name is required')
    }

    const settings = await getPlayerNotificationSettings(env.DB, userId, playerName)
    return json({ settings: settings[0] || null })

  } catch (err) {
    console.error('Get player notification settings error:', err)
    return error(500, 'Failed to fetch player notification settings')
  }
})

router.put('/players/:playerName', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const playerName = request.params.playerName
    if (!playerName) {
      return error(400, 'Player name is required')
    }

    const body = await request.json()
    const settings = await updatePlayerNotificationSettings(env.DB, userId, playerName, body)
    return json({ settings })

  } catch (err) {
    console.error('Update player notification settings error:', err)
    return error(500, 'Failed to update player notification settings')
  }
})

router.delete('/players/:playerName', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const playerName = request.params.playerName
    if (!playerName) {
      return error(400, 'Player name is required')
    }

    await deletePlayerNotificationSettings(env.DB, userId, playerName)
    return json({ message: 'Player notification settings deleted' })

  } catch (err) {
    console.error('Delete player notification settings error:', err)
    return error(500, 'Failed to delete player notification settings')
  }
})

// Enhanced notification history with filtering
router.get('/history/v2', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const playerName = url.searchParams.get('playerName') || undefined
    const notificationType = url.searchParams.get('notificationType') || undefined
    const status = url.searchParams.get('status') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    const { notifications, totalCount } = await getNotificationHistoryV2(env.DB, userId, {
      limit,
      offset,
      playerName,
      notificationType,
      status,
      startDate,
      endDate
    })

    return json({
      notifications,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (err) {
    console.error('Get notification history v2 error:', err)
    return error(500, 'Failed to fetch notification history')
  }
})

// Notification analytics
router.get('/analytics', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const groupBy = url.searchParams.get('groupBy') as 'day' | 'hour' || 'day'

    if (!startDate || !endDate) {
      return error(400, 'Start date and end date are required')
    }

    const analytics = await getNotificationAnalytics(env.DB, userId, {
      startDate,
      endDate,
      groupBy
    })

    return json({ analytics })

  } catch (err) {
    console.error('Get notification analytics error:', err)
    return error(500, 'Failed to fetch notification analytics')
  }
})

// Notification queue status
router.get('/queue', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const queue = await getNotificationQueue(env.DB, userId)
    return json({ queue })

  } catch (err) {
    console.error('Get notification queue error:', err)
    return error(500, 'Failed to fetch notification queue')
  }
})

router.get('/queue/status', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const status = await getNotificationQueueStatus(env.DB, userId)
    return json({ status })

  } catch (err) {
    console.error('Get notification queue status error:', err)
    return error(500, 'Failed to fetch notification queue status')
  }
})

// Dashboard statistics
router.get('/dashboard/stats', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const stats = await getDashboardStats(env.DB, userId)
    return json({ stats })

  } catch (err) {
    console.error('Get dashboard stats error:', err)
    return error(500, 'Failed to fetch dashboard statistics')
  }
})

// Bulk operations for player settings
router.post('/players/bulk', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const body = await request.json() as {
      action: 'enable' | 'disable' | 'delete'
      playerNames: string[]
      settings?: any
    }

    if (!body.action || !body.playerNames || body.playerNames.length === 0) {
      return error(400, 'Action and player names are required')
    }

    const results = []
    for (const playerName of body.playerNames) {
      try {
        if (body.action === 'delete') {
          await deletePlayerNotificationSettings(env.DB, userId, playerName)
          results.push({ playerName, success: true })
        } else {
          const enabled = body.action === 'enable'
          const settings = await updatePlayerNotificationSettings(env.DB, userId, playerName, {
            enabled,
            ...body.settings
          })
          results.push({ playerName, success: true, settings })
        }
      } catch (err) {
        results.push({ playerName, success: false, error: err.message })
      }
    }

    return json({ 
      message: `Bulk ${body.action} operation completed`,
      results 
    })

  } catch (err) {
    console.error('Bulk player operation error:', err)
    return error(500, 'Failed to perform bulk operation')
  }
})

// =============================================================================
// REAL-TIME FEATURES: Server-Sent Events for Live Updates
// =============================================================================

// Server-Sent Events endpoint for real-time notification updates
router.get('/stream', async (request: Request, env: Env) => {
  try {
    // Handle authentication for SSE (EventSource doesn't support custom headers)
    let userId = request.user?.id
    
    if (!userId) {
      // Try to get token from query parameter for EventSource compatibility
      const url = new URL(request.url)
      const token = url.searchParams.get('token')
      
      if (token) {
        try {
          const { verifyJWT } = await import('../utils/jwt')
          const payload = await verifyJWT(token, env.JWT_SECRET)
          userId = payload?.userId
        } catch (err) {
          console.error('Token verification error:', err)
        }
      }
    }
    
    if (!userId) {
      return error(401, 'Unauthorized - valid token required')
    }

    // Create ReadableStream for SSE
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // Set SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET'
    })

    // Send initial connection event
    const sendEvent = async (event: string, data: any) => {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      try {
        await writer.write(new TextEncoder().encode(message))
      } catch (err) {
        console.error('SSE write error:', err)
      }
    }

    // Send initial status
    try {
      const [queueStatus, dashboardStats] = await Promise.all([
        getNotificationQueueStatus(env.DB, userId),
        getDashboardStats(env.DB, userId)
      ])

      await sendEvent('queue-status', queueStatus)
      await sendEvent('dashboard-stats', dashboardStats)
      await sendEvent('connected', { timestamp: new Date().toISOString() })
    } catch (err) {
      console.error('Error sending initial SSE data:', err)
    }

    // Set up periodic updates
    const updateInterval = setInterval(async () => {
      try {
        const [queueStatus, dashboardStats] = await Promise.all([
          getNotificationQueueStatus(env.DB, userId),
          getDashboardStats(env.DB, userId)
        ])

        await sendEvent('queue-status', queueStatus)
        await sendEvent('dashboard-stats', dashboardStats)
      } catch (err) {
        console.error('Error in SSE periodic update:', err)
        clearInterval(updateInterval)
      }
    }, 30000) // Update every 30 seconds

    // Handle client disconnect
    request.signal?.addEventListener('abort', () => {
      clearInterval(updateInterval)
      writer.close()
    })

    // Keep connection alive with heartbeat
    const heartbeatInterval = setInterval(async () => {
      try {
        await sendEvent('heartbeat', { timestamp: new Date().toISOString() })
      } catch (err) {
        console.error('Heartbeat error:', err)
        clearInterval(heartbeatInterval)
        clearInterval(updateInterval)
      }
    }, 60000) // Heartbeat every minute

    // Clean up on close
    setTimeout(() => {
      clearInterval(updateInterval)
      clearInterval(heartbeatInterval)
      writer.close()
    }, 300000) // Close after 5 minutes

    return new Response(readable, { headers })

  } catch (err) {
    console.error('SSE endpoint error:', err)
    return error(500, 'Failed to establish real-time connection')
  }
})

// Enhanced queue status with real-time updates
router.get('/queue/live', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const [queueStatus, queueItems] = await Promise.all([
      getNotificationQueueStatus(env.DB, userId),
      getNotificationQueue(env.DB, userId)
    ])

    return json({
      status: queueStatus,
      queue: queueItems,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Get live queue status error:', err)
    return error(500, 'Failed to fetch live queue status')
  }
})

// Notification delivery webhook for real-time status updates
router.post('/webhook/delivery', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as {
      notificationId: string
      status: 'delivered' | 'failed' | 'clicked'
      timestamp: string
      metadata?: any
    }

    if (!body.notificationId || !body.status) {
      return error(400, 'Missing required fields')
    }

    // Update notification history with delivery status
    await env.DB.prepare(`
      UPDATE notification_history 
      SET 
        status = ?,
        ${body.status === 'delivered' ? 'delivered_at' : body.status === 'failed' ? 'failed_at' : 'clicked_at'} = ?,
        metadata = ?
      WHERE id = ?
    `).bind(
      body.status,
      body.timestamp,
      body.metadata ? JSON.stringify(body.metadata) : null,
      body.notificationId
    ).run()

    return json({ 
      message: 'Delivery status updated',
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Delivery webhook error:', err)
    return error(500, 'Failed to process delivery webhook')
  }
})

export { router as notificationRoutes }
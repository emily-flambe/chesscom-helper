import { cors, error, json, Router } from 'itty-router'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { monitoringRoutes } from './routes/monitoring'
import { notificationRoutes } from './routes/notifications'
import { authenticateUser } from './middleware/auth'
import { validateRequest } from './middleware/validation'
import { rateLimiter } from './middleware/rateLimit'
import { errorHandler } from './middleware/errorHandler'

export interface Env {
  DB: D1Database
  CACHE: KVNamespace
  JWT_SECRET: string
  CHESS_COM_API_URL: string
  EMAIL_API_KEY: string
  RESEND_API_KEY: string
}

const { preflight, corsify } = cors({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  origins: ['*'],
  headers: ['Authorization', 'Content-Type']
})

const router = Router()

router
  .all('*', preflight)
  .all('*', rateLimiter)
  .all('*', validateRequest)

router.all('/api/v1/auth/*', authRoutes.fetch)
router.all('/api/v1/users/*', authenticateUser, userRoutes.fetch)
router.all('/api/v1/monitoring/*', authenticateUser, monitoringRoutes.fetch)
router.all('/api/v1/notifications/*', authenticateUser, notificationRoutes.fetch)

router.get('/health', () => json({ status: 'ok', timestamp: new Date().toISOString() }))

router.all('*', () => error(404, 'Not Found'))

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await router.handle(request, env, ctx).then(corsify)
    } catch (err) {
      return errorHandler(err as Error)
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    switch (event.cron) {
      case '*/5 * * * *':
        await import('./jobs/playerMonitoring').then(m => m.checkPlayerStatus(env, ctx))
        break
      case '0 */6 * * *':
        await import('./jobs/cleanup').then(m => m.cleanupExpiredTasks(env, ctx))
        break
    }
  }
}
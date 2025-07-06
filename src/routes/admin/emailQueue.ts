import { Router, json, error } from 'itty-router'
import { authenticateUser } from '../../middleware/auth'
import { createEmailQueueService, DEFAULT_EMAIL_QUEUE_CONFIG } from '../../services/emailQueueService'
import { EmailTemplateService } from '../../services/emailTemplateService'
import { ResendService } from '../../services/resendService'
import { EmailRetryService } from '../../services/emailRetryService'
import { createNotificationAuditService } from '../../services/notificationAuditService'
import type { Env } from '../../index'

const router = Router({ base: '/api/v1/admin/email-queue' })

// Admin authentication middleware - in production, you'd want proper admin role checking
async function requireAdmin(request: Request, env: Env): Promise<Response | void> {
  const authResult = await authenticateUser(request, env)
  if (authResult instanceof Response) {
    return authResult
  }

  // In production, check if user has admin role
  // For now, we'll allow any authenticated user for development
  console.log(`Admin action by user: ${request.user?.id}`)
}

// Get queue statistics
router.get('/stats', requireAdmin, async (request: Request, env: Env) => {
  try {
    const queueService = createEmailQueueService(DEFAULT_EMAIL_QUEUE_CONFIG, {
      db: env.DB,
      templateService: new EmailTemplateService(),
      resendService: new ResendService(env.RESEND_API_KEY || ''),
      retryService: new EmailRetryService(env.DB),
      auditService: createNotificationAuditService(env.DB)
    })

    const [statistics, healthStatus] = await Promise.all([
      queueService.getQueueStatistics(),
      queueService.getHealthStatus()
    ])

    return json({
      statistics,
      health: healthStatus,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get queue statistics:', err)
    return error(500, 'Failed to retrieve queue statistics')
  }
})

// Get queue health status
router.get('/health', requireAdmin, async (request: Request, env: Env) => {
  try {
    const queueService = createEmailQueueService(DEFAULT_EMAIL_QUEUE_CONFIG, {
      db: env.DB,
      templateService: new EmailTemplateService(),
      resendService: new ResendService(env.RESEND_API_KEY || ''),
      retryService: new EmailRetryService(env.DB),
      auditService: createNotificationAuditService(env.DB)
    })

    const healthStatus = await queueService.getHealthStatus()

    return json({
      health: healthStatus,
      recommendations: generateHealthRecommendations(healthStatus),
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get queue health:', err)
    return error(500, 'Failed to retrieve queue health')
  }
})

// Process queue manually
router.post('/process', requireAdmin, async (request: Request, env: Env) => {
  try {
    const body = await request.json().catch(() => ({})) as {
      priority?: 1 | 2 | 3
      maxBatchSize?: number
      dryRun?: boolean
    }

    const queueService = createEmailQueueService(DEFAULT_EMAIL_QUEUE_CONFIG, {
      db: env.DB,
      templateService: new EmailTemplateService(),
      resendService: new ResendService(env.RESEND_API_KEY || ''),
      retryService: new EmailRetryService(env.DB),
      auditService: createNotificationAuditService(env.DB)
    })

    if (body.dryRun) {
      // For dry run, just get the next batch without processing
      const stats = await queueService.getQueueStatistics()
      
      return json({
        dryRun: true,
        pendingEmails: stats.totalPending,
        message: `Would process ${Math.min(stats.totalPending, body.maxBatchSize || 10)} emails`,
        timestamp: new Date().toISOString()
      })
    }

    const result = await queueService.processQueue({
      priority: body.priority,
      maxBatchSize: body.maxBatchSize || 10
    })

    return json({
      success: true,
      result,
      message: `Processed ${result.emailsProcessed} emails (${result.emailsSent} sent, ${result.emailsFailed} failed)`,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to process queue:', err)
    return error(500, 'Failed to process queue')
  }
})

// Get queue items with filtering
router.get('/items', requireAdmin, async (request: Request, env: Env) => {
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') as 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | null
    const priority = url.searchParams.get('priority') ? parseInt(url.searchParams.get('priority')!) : null
    const templateType = url.searchParams.get('templateType')
    const userId = url.searchParams.get('userId')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build query
    let query = `SELECT * FROM email_queue WHERE 1=1`
    let countQuery = `SELECT COUNT(*) as count FROM email_queue WHERE 1=1`
    const params: any[] = []

    if (status) {
      query += ` AND status = ?`
      countQuery += ` AND status = ?`
      params.push(status)
    }

    if (priority) {
      query += ` AND priority = ?`
      countQuery += ` AND priority = ?`
      params.push(priority)
    }

    if (templateType) {
      query += ` AND template_type = ?`
      countQuery += ` AND template_type = ?`
      params.push(templateType)
    }

    if (userId) {
      query += ` AND user_id = ?`
      countQuery += ` AND user_id = ?`
      params.push(userId)
    }

    // Get total count
    const countResult = await env.DB.prepare(countQuery).bind(...params).first()
    const totalCount = countResult?.count || 0

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    const queryParams = [...params, limit, offset]
    
    const result = await env.DB.prepare(query).bind(...queryParams).all()
    const items = result.results || []

    return json({
      items: items.map(item => ({
        ...item,
        template_data: item.template_data ? JSON.parse(item.template_data) : null
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + items.length < totalCount
      },
      filters: {
        status,
        priority,
        templateType,
        userId
      },
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get queue items:', err)
    return error(500, 'Failed to retrieve queue items')
  }
})

// Get specific queue item details
router.get('/items/:id', requireAdmin, async (request: Request, env: Env) => {
  try {
    const { id } = request.params

    const item = await env.DB.prepare(`
      SELECT * FROM email_queue WHERE id = ?
    `).bind(id).first()

    if (!item) {
      return error(404, 'Queue item not found')
    }

    // Get related audit entries
    const auditService = createNotificationAuditService(env.DB)
    const auditHistory = await auditService.getNotificationHistory({
      emailId: id,
      limit: 20
    })

    return json({
      item: {
        ...item,
        template_data: item.template_data ? JSON.parse(item.template_data) : null
      },
      auditHistory: auditHistory.entries,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get queue item:', err)
    return error(500, 'Failed to retrieve queue item')
  }
})

// Cancel queue item
router.post('/items/:id/cancel', requireAdmin, async (request: Request, env: Env) => {
  try {
    const { id } = request.params
    const body = await request.json().catch(() => ({})) as {
      reason?: string
    }

    const queueService = createEmailQueueService(DEFAULT_EMAIL_QUEUE_CONFIG, {
      db: env.DB,
      templateService: new EmailTemplateService(),
      resendService: new ResendService(env.RESEND_API_KEY || ''),
      retryService: new EmailRetryService(env.DB),
      auditService: createNotificationAuditService(env.DB)
    })

    await queueService.cancelEmail(id, body.reason || 'Cancelled by admin')

    return json({
      success: true,
      message: 'Email cancelled successfully',
      emailId: id,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to cancel email:', err)
    return error(500, 'Failed to cancel email')
  }
})

// Retry failed email
router.post('/items/:id/retry', requireAdmin, async (request: Request, env: Env) => {
  try {
    const { id } = request.params

    // Update email status to pending for retry
    await env.DB.prepare(`
      UPDATE email_queue 
      SET status = 'pending', 
          scheduled_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND status = 'failed'
    `).bind(id).run()

    return json({
      success: true,
      message: 'Email scheduled for retry',
      emailId: id,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to retry email:', err)
    return error(500, 'Failed to retry email')
  }
})

// Cleanup old emails
router.post('/cleanup', requireAdmin, async (request: Request, env: Env) => {
  try {
    const body = await request.json().catch(() => ({})) as {
      retentionDays?: number
      dryRun?: boolean
    }

    const retentionDays = body.retentionDays || 30
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    const cutoffIso = cutoffDate.toISOString()

    if (body.dryRun) {
      const result = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM email_queue
        WHERE status IN ('sent', 'cancelled', 'failed')
        AND updated_at < ?
        AND retry_count >= max_retries
      `).bind(cutoffIso).first()

      return json({
        dryRun: true,
        wouldDelete: result?.count || 0,
        cutoffDate: cutoffIso,
        retentionDays,
        timestamp: new Date().toISOString()
      })
    }

    const queueService = createEmailQueueService(DEFAULT_EMAIL_QUEUE_CONFIG, {
      db: env.DB,
      templateService: new EmailTemplateService(),
      resendService: new ResendService(env.RESEND_API_KEY || ''),
      retryService: new EmailRetryService(env.DB),
      auditService: createNotificationAuditService(env.DB)
    })

    const cleanupResult = await queueService.cleanup()

    return json({
      success: true,
      deletedCount: cleanupResult.deletedCount,
      errors: cleanupResult.errors,
      cutoffDate: cutoffIso,
      retentionDays,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to cleanup queue:', err)
    return error(500, 'Failed to cleanup queue')
  }
})

// Helper function to generate health recommendations
function generateHealthRecommendations(health: any): string[] {
  const recommendations: string[] = []

  if (health.queueSize > 1000) {
    recommendations.push('Consider increasing processing frequency or batch size')
  }

  if (health.errorRate > 10) {
    recommendations.push('High error rate detected - review failed emails and templates')
  }

  if (health.averageWaitTime > 300) { // 5 minutes
    recommendations.push('Long wait times detected - consider scaling email processing')
  }

  if (health.oldestItemAge > 3600) { // 1 hour
    recommendations.push('Old emails in queue - check for processing issues')
  }

  if (recommendations.length === 0) {
    recommendations.push('Email queue is healthy')
  }

  return recommendations
}

export { router as emailQueueAdminRoutes }
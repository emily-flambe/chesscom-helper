import { Router, json, error } from 'itty-router'
import { ResendWebhookHandler } from '../../services/resendWebhookHandler'
import { createNotificationAuditService } from '../../services/notificationAuditService'
import type { Env } from '../../index'

const router = Router({ base: '/api/v1/webhooks' })

// Webhook signature verification utility
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    if (!signature || !signature.startsWith('sha256=')) {
      return false
    }

    const expectedSignature = signature.replace('sha256=', '')
    
    // Create HMAC-SHA256 signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const computedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    )
    
    const computedSignatureHex = Array.from(new Uint8Array(computedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    return computedSignatureHex === expectedSignature
  } catch (err) {
    console.error('Webhook signature verification error:', err)
    return false
  }
}

// Resend webhook endpoint
router.post('/resend', async (request: Request, env: Env) => {
  try {
    // Check if webhook secret is configured
    if (!env.RESEND_WEBHOOK_SECRET) {
      console.error('RESEND_WEBHOOK_SECRET not configured')
      return error(500, 'Webhook not properly configured')
    }

    // Get raw payload for signature verification
    const payload = await request.text()
    const signature = request.headers.get('resend-signature')

    if (!signature) {
      console.error('Missing resend-signature header')
      return error(400, 'Missing webhook signature')
    }

    // Verify webhook signature
    const isValidSignature = await verifyWebhookSignature(
      payload,
      signature,
      env.RESEND_WEBHOOK_SECRET
    )

    if (!isValidSignature) {
      console.error('Invalid webhook signature')
      return error(401, 'Invalid webhook signature')
    }

    // Parse webhook payload
    let webhookData
    try {
      webhookData = JSON.parse(payload)
    } catch (parseError) {
      console.error('Invalid webhook payload format:', parseError)
      return error(400, 'Invalid JSON payload')
    }

    // Validate required webhook fields
    if (!webhookData.type || !webhookData.data) {
      console.error('Missing required webhook fields:', webhookData)
      return error(400, 'Missing required webhook fields')
    }

    console.log(`Received Resend webhook: ${webhookData.type}`, {
      messageId: webhookData.data?.email_id,
      email: webhookData.data?.to?.[0],
      timestamp: webhookData.created_at
    })

    // Initialize services
    const auditService = createNotificationAuditService(env.DB)
    const webhookHandler = new ResendWebhookHandler(env.DB, auditService)

    // Process webhook based on type
    let result
    switch (webhookData.type) {
      case 'email.sent':
        result = await webhookHandler.handleEmailSent(webhookData.data)
        break
        
      case 'email.delivered':
        result = await webhookHandler.handleEmailDelivered(webhookData.data)
        break
        
      case 'email.delivery_delayed':
        result = await webhookHandler.handleEmailDeliveryDelayed(webhookData.data)
        break
        
      case 'email.bounced':
        result = await webhookHandler.handleEmailBounced(webhookData.data)
        break
        
      case 'email.complained':
        result = await webhookHandler.handleEmailComplained(webhookData.data)
        break
        
      default:
        console.log(`Unhandled webhook type: ${webhookData.type}`)
        // Still return success to avoid webhook retries for unknown events
        result = { processed: false, reason: 'Unhandled webhook type' }
    }

    // Return success response
    return json({
      success: true,
      webhookType: webhookData.type,
      messageId: webhookData.data?.email_id,
      processed: result?.processed !== false,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Webhook processing error:', err)
    
    // Return 500 to trigger webhook retry from Resend
    return error(500, {
      error: 'Webhook processing failed',
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Webhook verification endpoint for initial setup
router.get('/resend/verify', async (request: Request, env: Env) => {
  try {
    // Check if this is a verification request from Resend
    const verificationToken = request.headers.get('resend-verification-token')
    
    if (!verificationToken) {
      return error(400, 'Missing verification token')
    }

    // In production, you might want to validate the verification token
    // For now, we'll just return success to enable webhook
    console.log(`Webhook verification request received with token: ${verificationToken}`)

    return json({
      success: true,
      message: 'Webhook endpoint verified',
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Webhook verification error:', err)
    return error(500, 'Verification failed')
  }
})

// Health check endpoint for webhook monitoring
router.get('/resend/health', async (request: Request, env: Env) => {
  try {
    return json({
      status: 'healthy',
      service: 'resend-webhook',
      timestamp: new Date().toISOString(),
      configured: !!env.RESEND_WEBHOOK_SECRET
    })
  } catch (err) {
    console.error('Webhook health check error:', err)
    return error(500, 'Health check failed')
  }
})

export { router as resendWebhookRoutes }
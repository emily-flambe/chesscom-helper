import { createApiError } from '../middleware/errorHandler'
import { generateSecureId } from '../utils/crypto'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface TemplateData {
  // Common template variables
  userEmail: string
  baseUrl: string
  unsubscribeUrl: string
  preferencesUrl: string
  
  // Game-specific variables
  playerName?: string
  opponentName?: string
  opponentRating?: string
  opponentTitle?: string
  gameType?: string
  gameId?: string
  gameUrl?: string
  gameStartTime?: string
  gameEndTime?: string
  playerColor?: string
  timeControl?: string
  result?: string
  
  // Additional data for future templates
  [key: string]: any
}

export interface EmailTemplateOptions {
  templateType: 'game_start' | 'game_end' | 'welcome' | 'digest' | 'custom'
  data: TemplateData
  userId?: string
  priority?: 'high' | 'medium' | 'low'
}

export interface TemplateRenderResult {
  templateId: string
  subject: string
  html: string
  text: string
  renderTime: number
  validatedData: TemplateData
}

// Template content for different notification types
const TEMPLATE_CONTENT = {
  game_start: {
    subject: (data: TemplateData) => `🎯 ${data.playerName} started a new game!`,
    html: (data: TemplateData) => `
      <p class="greeting">Hello there!</p>
      
      <div class="game-alert">
        <h2>🎯 New Game Started!</h2>
        <p><strong>${data.playerName}</strong> just started a new game on Chess.com!</p>
      </div>
      
      ${data.opponentName ? `
        <div class="opponent-info">
          <div class="opponent-name">${data.opponentName}</div>
          ${data.opponentRating ? `<div class="opponent-rating">Rating: ${data.opponentRating}</div>` : ''}
          ${data.opponentTitle ? `<div style="color: #666666; font-size: 14px;">${data.opponentTitle}</div>` : ''}
        </div>
      ` : ''}
      
      ${data.gameType || data.playerColor || data.gameId || data.gameStartTime ? `
        <div class="game-details">
          ${data.gameType ? `
            <div class="game-details-row">
              <span class="game-details-label">Game Type:</span>
              <span class="game-details-value">${data.gameType}</span>
            </div>
          ` : ''}
          ${data.playerColor ? `
            <div class="game-details-row">
              <span class="game-details-label">Your Color:</span>
              <span class="game-details-value">${data.playerColor}</span>
            </div>
          ` : ''}
          ${data.gameId ? `
            <div class="game-details-row">
              <span class="game-details-label">Game ID:</span>
              <span class="game-details-value">${data.gameId}</span>
            </div>
          ` : ''}
          ${data.gameStartTime ? `
            <div class="game-details-row">
              <span class="game-details-label">Started:</span>
              <span class="game-details-value">${data.gameStartTime}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      ${data.timeControl ? `
        <div class="time-control">
          <p class="time-control-text">⏱️ Time Control: ${data.timeControl}</p>
        </div>
      ` : ''}
      
      <div class="highlight-box">
        <p><strong>Analysis Ready:</strong> Once the game is complete, Chess.com Helper will automatically analyze the performance and provide detailed insights.</p>
      </div>
      
      ${data.gameUrl ? `
        <div class="btn-container">
          <a href="${data.gameUrl}" class="btn" role="button" aria-label="View game on Chess.com">
            View Game on Chess.com
          </a>
        </div>
      ` : ''}
      
      <p>Good luck with the game! Every game is an opportunity to learn and improve.</p>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666666;">
        This notification was sent because game start notifications are enabled. 
        <a href="${data.preferencesUrl}" style="color: #4caf50;">Update notification settings</a> anytime.
      </p>
    `,
    text: (data: TemplateData) => `
🎯 New Game Started!

${data.playerName} just started a new game on Chess.com!

${data.opponentName ? `Opponent: ${data.opponentName}` : ''}
${data.opponentRating ? `Rating: ${data.opponentRating}` : ''}
${data.gameType ? `Game Type: ${data.gameType}` : ''}
${data.playerColor ? `Your Color: ${data.playerColor}` : ''}
${data.timeControl ? `Time Control: ${data.timeControl}` : ''}
${data.gameId ? `Game ID: ${data.gameId}` : ''}
${data.gameStartTime ? `Started: ${data.gameStartTime}` : ''}

${data.gameUrl ? `View Game: ${data.gameUrl}` : ''}

Analysis Ready: Once the game is complete, Chess.com Helper will automatically analyze the performance and provide detailed insights.

Good luck with the game! Every game is an opportunity to learn and improve.

---
This notification was sent because game start notifications are enabled.
Update settings: ${data.preferencesUrl}
Unsubscribe: ${data.unsubscribeUrl}
    `.trim()
  },
  
  game_end: {
    subject: (data: TemplateData) => `♟️ ${data.playerName}'s game has ended`,
    html: (data: TemplateData) => `
      <p class="greeting">Game Complete!</p>
      
      <div class="game-alert">
        <h2>♟️ Game Finished</h2>
        <p><strong>${data.playerName}</strong>'s game on Chess.com has ended.</p>
      </div>
      
      ${data.result ? `
        <div class="highlight-box">
          <p><strong>Result:</strong> ${data.result}</p>
        </div>
      ` : ''}
      
      ${data.gameUrl ? `
        <div class="btn-container">
          <a href="${data.gameUrl}" class="btn" role="button" aria-label="View completed game">
            View Completed Game
          </a>
        </div>
      ` : ''}
      
      <p>The game analysis will be available shortly. Check back soon for detailed insights and improvement suggestions.</p>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666666;">
        This notification was sent because game end notifications are enabled. 
        <a href="${data.preferencesUrl}" style="color: #4caf50;">Update notification settings</a> anytime.
      </p>
    `,
    text: (data: TemplateData) => `
♟️ Game Finished

${data.playerName}'s game on Chess.com has ended.

${data.result ? `Result: ${data.result}` : ''}
${data.gameUrl ? `View Game: ${data.gameUrl}` : ''}

The game analysis will be available shortly. Check back soon for detailed insights and improvement suggestions.

---
This notification was sent because game end notifications are enabled.
Update settings: ${data.preferencesUrl}
Unsubscribe: ${data.unsubscribeUrl}
    `.trim()
  }
}

// Base HTML template loader
const BASE_HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>{{subject}}</title>
    <style type="text/css">
        /* Base styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; 
            background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; color: #333333; 
        }
        table { border-collapse: collapse; table-layout: fixed; margin: 0 auto; }
        td { padding: 0; vertical-align: top; }
        img { border: 0; outline: none; text-decoration: none; display: block; max-width: 100%; height: auto; }
        a { color: #4caf50; text-decoration: none; }
        a:hover { color: #66bb6a; text-decoration: underline; }
        
        /* Layout */
        .email-container { max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); }
        .email-header { background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
        .email-header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
        .email-header .tagline { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; font-weight: 400; }
        .email-body { padding: 40px 30px; }
        .email-content { max-width: 540px; margin: 0 auto; }
        .email-content h2 { color: #2e7d32; font-size: 22px; font-weight: 600; margin: 0 0 20px 0; line-height: 1.3; }
        .email-content p { margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #555555; }
        .email-content .greeting { font-size: 18px; color: #2e7d32; font-weight: 500; margin-bottom: 24px; }
        
        /* Components */
        .btn { display: inline-block; padding: 14px 28px; background-color: #4caf50; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center; transition: background-color 0.3s ease; margin: 10px 0; }
        .btn:hover { background-color: #45a049 !important; text-decoration: none !important; }
        .btn-container { text-align: center; margin: 30px 0; }
        .highlight-box { background-color: #e8f5e8; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
        .highlight-box p { margin: 0; color: #2e7d32; font-weight: 500; }
        .game-alert { background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%); border: 2px solid #4caf50; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; }
        .game-alert h2 { color: #2e7d32; font-size: 24px; margin-bottom: 20px; }
        .game-details { background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .game-details-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .game-details-row:last-child { border-bottom: none; }
        .game-details-label { font-weight: 600; color: #2e7d32; font-size: 14px; }
        .game-details-value { color: #555555; font-size: 14px; }
        .opponent-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .opponent-name { font-size: 20px; font-weight: 600; color: #2e7d32; margin-bottom: 8px; }
        .opponent-rating { font-size: 16px; color: #666666; margin-bottom: 4px; }
        .time-control { background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0; }
        .time-control-text { color: #1976d2; font-weight: 600; margin: 0; }
        
        /* Footer */
        .email-footer { background-color: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #e9ecef; }
        .email-footer p { margin: 0 0 10px 0; font-size: 14px; color: #666666; }
        .email-footer a { color: #4caf50; text-decoration: none; }
        .email-footer a:hover { text-decoration: underline; }
        .social-links { margin: 20px 0; }
        .social-links a { display: inline-block; margin: 0 10px; color: #666666; text-decoration: none; }
        .unsubscribe-link { font-size: 12px; color: #999999; margin-top: 20px; }
        
        /* Responsive */
        @media screen and (max-width: 600px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .email-header { padding: 20px 15px !important; }
            .email-header h1 { font-size: 24px !important; }
            .email-body { padding: 30px 20px !important; }
            .btn { display: block !important; width: 100% !important; padding: 16px 20px !important; }
            .game-details-row { flex-direction: column !important; align-items: flex-start !important; gap: 5px !important; }
        }
        
        /* Dark mode */
        @media (prefers-color-scheme: dark) {
            .email-container { background-color: #1a1a1a !important; }
            .email-body { background-color: #1a1a1a !important; }
            .email-content p { color: #cccccc !important; }
            .email-content h2 { color: #66bb6a !important; }
            .email-content .greeting { color: #66bb6a !important; }
            .game-details { background-color: #2a2a2a !important; border-color: #404040 !important; }
            .game-details-row { border-bottom-color: #404040 !important; }
            .game-details-label { color: #66bb6a !important; }
            .game-details-value { color: #cccccc !important; }
            .opponent-info { background-color: #2a2a2a !important; }
            .opponent-name { color: #66bb6a !important; }
            .opponent-rating { color: #cccccc !important; }
            .game-alert { background: linear-gradient(135deg, #2a3f2a 0%, #1f3a1f 100%) !important; border-color: #66bb6a !important; }
            .highlight-box { background-color: #2a3f2a !important; border-left-color: #66bb6a !important; }
            .highlight-box p { color: #66bb6a !important; }
            .time-control { background-color: #2a3f4a !important; border-left-color: #64b5f6 !important; }
            .time-control-text { color: #64b5f6 !important; }
            .email-footer { background-color: #2a2a2a !important; border-top-color: #404040 !important; }
            .email-footer p { color: #cccccc !important; }
        }
    </style>
</head>
<body>
    <div role="article" aria-roledescription="email" aria-label="{{subject}}" lang="en">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td align="center" style="padding: 20px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-container">
                        <tr>
                            <td class="email-header">
                                <h1>Chess.com Helper</h1>
                                <p class="tagline">Elevate Your Chess Game</p>
                            </td>
                        </tr>
                        <tr>
                            <td class="email-body">
                                <div class="email-content">
                                    {{content}}
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td class="email-footer">
                                <p><strong>Chess.com Helper</strong> - Your Personal Chess Analysis Companion</p>
                                <p>Get insights, track progress, and improve your game</p>
                                <div class="social-links">
                                    <a href="{{baseUrl}}/dashboard" aria-label="Visit your dashboard">Dashboard</a>
                                    <a href="{{baseUrl}}/settings" aria-label="Manage your settings">Settings</a>
                                    <a href="{{baseUrl}}/support" aria-label="Get help and support">Support</a>
                                </div>
                                <div class="unsubscribe-link">
                                    <p>
                                        <a href="{{unsubscribeUrl}}" aria-label="Unsubscribe from these emails">Unsubscribe</a> | 
                                        <a href="{{preferencesUrl}}" aria-label="Update your email preferences">Email Preferences</a>
                                    </p>
                                    <p style="margin-top: 10px; font-size: 11px; color: #999999;">
                                        This email was sent to {{userEmail}}. 
                                        If you no longer wish to receive these emails, you can unsubscribe at any time.
                                    </p>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
`

/**
 * EmailTemplateService - Professional email template rendering service
 * 
 * Features:
 * - Template loading and caching
 * - Data binding with validation
 * - Mobile-responsive HTML templates
 * - Text fallback generation
 * - Performance tracking
 * - Error handling and logging
 */
export class EmailTemplateService {
  private templateCache: Map<string, string> = new Map()
  private renderStats: Map<string, number> = new Map()

  /**
   * Render an email template with provided data
   */
  async renderTemplate(options: EmailTemplateOptions): Promise<TemplateRenderResult> {
    const startTime = Date.now()
    const templateId = await generateSecureId()

    try {
      // Validate template type
      if (!this.isValidTemplateType(options.templateType)) {
        throw createApiError(`Invalid template type: ${options.templateType}`, 400, 'INVALID_TEMPLATE_TYPE')
      }

      // Validate and sanitize data
      const validatedData = this.validateTemplateData(options.data)

      // Get template content
      const templateContent = this.getTemplateContent(options.templateType)

      // Render subject, HTML, and text
      const subject = templateContent.subject(validatedData)
      const htmlContent = templateContent.html(validatedData)
      const textContent = templateContent.text(validatedData)

      // Generate final HTML with base template
      const html = this.renderBaseTemplate(htmlContent, validatedData, subject)

      const renderTime = Date.now() - startTime
      this.updateRenderStats(options.templateType, renderTime)

      return {
        templateId,
        subject,
        html,
        text: textContent,
        renderTime,
        validatedData
      }

    } catch (error) {
      console.error('Template render error:', error)
      throw createApiError(
        `Failed to render template: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'TEMPLATE_RENDER_FAILED',
        error
      )
    }
  }

  /**
   * Get template content for a specific type
   */
  private getTemplateContent(templateType: string) {
    const content = TEMPLATE_CONTENT[templateType as keyof typeof TEMPLATE_CONTENT]
    if (!content) {
      throw createApiError(`Template content not found for type: ${templateType}`, 404, 'TEMPLATE_NOT_FOUND')
    }
    return content
  }

  /**
   * Validate template type
   */
  private isValidTemplateType(type: string): boolean {
    return ['game_start', 'game_end', 'welcome', 'digest', 'custom'].includes(type)
  }

  /**
   * Validate and sanitize template data
   */
  private validateTemplateData(data: TemplateData): TemplateData {
    const validatedData = { ...data }

    // Required fields
    if (!validatedData.userEmail) {
      throw createApiError('User email is required', 400, 'MISSING_USER_EMAIL')
    }
    if (!validatedData.baseUrl) {
      throw createApiError('Base URL is required', 400, 'MISSING_BASE_URL')
    }

    // Sanitize HTML content
    if (validatedData.playerName) {
      validatedData.playerName = this.sanitizeHtml(validatedData.playerName)
    }
    if (validatedData.opponentName) {
      validatedData.opponentName = this.sanitizeHtml(validatedData.opponentName)
    }
    if (validatedData.result) {
      validatedData.result = this.sanitizeHtml(validatedData.result)
    }

    // Validate URLs
    if (validatedData.gameUrl && !this.isValidUrl(validatedData.gameUrl)) {
      delete validatedData.gameUrl
    }

    return validatedData
  }

  /**
   * Render base template with content
   */
  private renderBaseTemplate(content: string, data: TemplateData, subject: string): string {
    return BASE_HTML_TEMPLATE
      .replace('{{content}}', content)
      .replace('{{subject}}', this.sanitizeHtml(subject))
      .replace('{{userEmail}}', this.sanitizeHtml(data.userEmail))
      .replace('{{baseUrl}}', data.baseUrl)
      .replace('{{unsubscribeUrl}}', data.unsubscribeUrl || `${data.baseUrl}/unsubscribe`)
      .replace('{{preferencesUrl}}', data.preferencesUrl || `${data.baseUrl}/preferences`)
      .replace(/{{baseUrl}}/g, data.baseUrl)
      .replace(/{{unsubscribeUrl}}/g, data.unsubscribeUrl || `${data.baseUrl}/unsubscribe`)
      .replace(/{{preferencesUrl}}/g, data.preferencesUrl || `${data.baseUrl}/preferences`)
  }

  /**
   * Basic HTML sanitization
   */
  private sanitizeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Update render statistics
   */
  private updateRenderStats(templateType: string, renderTime: number): void {
    const currentStats = this.renderStats.get(templateType) || 0
    this.renderStats.set(templateType, currentStats + renderTime)
  }

  /**
   * Get render statistics
   */
  getRenderStats(): Record<string, number> {
    return Object.fromEntries(this.renderStats)
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear()
  }

  /**
   * Preload templates (for performance optimization)
   */
  async preloadTemplates(): Promise<void> {
    try {
      // In the future, this could load templates from the filesystem
      // For now, templates are embedded in the service
      console.log('Templates preloaded successfully')
    } catch (error) {
      console.error('Failed to preload templates:', error)
    }
  }
}

/**
 * Factory function to create EmailTemplateService instance
 */
export function createEmailTemplateService(): EmailTemplateService {
  return new EmailTemplateService()
}

/**
 * Default service instance
 */
export const emailTemplateService = createEmailTemplateService()

/**
 * Utility function to render a template quickly
 */
export async function renderEmailTemplate(
  templateType: 'game_start' | 'game_end' | 'welcome' | 'digest' | 'custom',
  data: TemplateData
): Promise<EmailTemplate> {
  const service = createEmailTemplateService()
  const result = await service.renderTemplate({ templateType, data })
  
  return {
    subject: result.subject,
    html: result.html,
    text: result.text
  }
}
/**
 * Email Delivery Service Tests
 * Comprehensive tests for email delivery functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  sendNotificationEmail,
  type EmailSendResult,
  type NotificationEmailData
} from '../../src/services/emailService'
import { 
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockEmailEnv,
  simulateEmailServiceError,
  validateEmailTemplate,
  createTestUser
} from '../utils/emailTestHelpers'
import { 
  testUsers,
  testTemplateData,
  testResendResponses,
  testErrorScenarios
} from '../fixtures/emailTestData'

describe('Email Delivery Service', () => {
  let mockEnv: Env
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    mockEnv = testEnv.mockEnv
    
    // Mock getUserById to return test user
    vi.doMock('../../src/services/userService', () => ({
      getUserById: vi.fn().mockResolvedValue(testUsers.alice)
    }))
    
    // Mock logNotificationSent
    vi.doMock('../../src/services/notificationService', () => ({
      logNotificationSent: vi.fn().mockResolvedValue(undefined)
    }))
  })

  afterEach(() => {
    testEnv.cleanup()
    cleanupTestEnvironment()
  })

  describe('sendNotificationEmail', () => {
    it('should send game start notification successfully', async () => {
      // Setup successful Resend response
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru',
        gameUrl: 'https://chess.com/game/live/12345'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result).toEqual({
        notificationId: expect.any(String),
        delivered: true,
        messageId: testResendResponses.success.id,
        error: undefined
      })
      
      // Verify fetch was called with correct parameters
      expect(testEnv.mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-resend-key',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('hikaru')
        })
      )
    })

    it('should send game end notification successfully', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru',
        gameUrl: 'https://chess.com/game/live/12345',
        result: 'Win'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_ended',
        notificationData
      )
      
      expect(result).toEqual({
        notificationId: expect.any(String),
        delivered: true,
        messageId: testResendResponses.success.id,
        error: undefined
      })
      
      // Verify email content includes game result
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      expect(requestBody.html).toContain('Win')
      expect(requestBody.text).toContain('Win')
    })

    it('should handle user not found error', async () => {
      // Mock getUserById to return null
      const { getUserById } = await import('../../src/services/userService')
      vi.mocked(getUserById).mockResolvedValue(null)
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        'non-existent-user',
        'game_started',
        notificationData
      )
      
      expect(result).toEqual({
        notificationId: expect.any(String),
        delivered: false,
        error: 'User not found'
      })
    })

    it('should handle email service errors', async () => {
      testEnv.resendMocks.error('validation_error')
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result).toEqual({
        notificationId: expect.any(String),
        delivered: false,
        error: expect.stringContaining('Resend API error')
      })
    })

    it('should handle network errors', async () => {
      testEnv.resendMocks.networkError()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result).toEqual({
        notificationId: expect.any(String),
        delivered: false,
        error: 'Network error'
      })
    })

    it('should handle rate limiting', async () => {
      testEnv.resendMocks.error('rate_limit_exceeded')
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result).toEqual({
        notificationId: expect.any(String),
        delivered: false,
        error: expect.stringContaining('Resend API error')
      })
    })

    it('should handle server errors', async () => {
      testEnv.resendMocks.serverError()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result).toEqual({
        notificationId: expect.any(String),
        delivered: false,
        error: expect.stringContaining('502')
      })
    })

    it('should include correct unsubscribe links', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      expect(requestBody.html).toContain('/unsubscribe/test-user-alice/hikaru')
      expect(requestBody.html).toContain('/settings')
      expect(requestBody.text).toContain('/settings')
    })

    it('should generate unique notification IDs', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const result1 = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      const result2 = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result1.notificationId).not.toBe(result2.notificationId)
    })

    it('should log notification attempts', async () => {
      testEnv.resendMocks.success()
      
      const { logNotificationSent } = await import('../../src/services/notificationService')
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(logNotificationSent).toHaveBeenCalledWith(
        mockEnv.DB,
        {
          userId: testUsers.alice.id,
          chessComUsername: 'hikaru',
          notificationType: 'game_started',
          emailDelivered: true
        }
      )
    })

    it('should log failed notifications', async () => {
      testEnv.resendMocks.error('validation_error')
      
      const { logNotificationSent } = await import('../../src/services/notificationService')
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(logNotificationSent).toHaveBeenCalledWith(
        mockEnv.DB,
        {
          userId: testUsers.alice.id,
          chessComUsername: 'hikaru',
          notificationType: 'game_started',
          emailDelivered: false
        }
      )
    })

    it('should handle missing game URL gracefully', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
        // No gameUrl provided
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result.delivered).toBe(true)
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      // Should not contain game URL or watch button
      expect(requestBody.html).not.toContain('Watch Live Game')
      expect(requestBody.text).not.toContain('Watch the game live')
    })

    it('should handle missing game result gracefully', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
        // No result provided
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_ended',
        notificationData
      )
      
      expect(result.delivered).toBe(true)
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      // Should not contain result section
      expect(requestBody.html).not.toContain('<strong>Result:</strong>')
      expect(requestBody.text).not.toContain('Result:')
    })

    it('should use correct email sender', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      expect(requestBody.from).toBe('Chess.com Helper <notifications@chesshelper.app>')
      expect(requestBody.to).toBe(testUsers.alice.email)
    })

    it('should include correct email subject', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      expect(requestBody.subject).toBe('🎯 hikaru is now playing on Chess.com!')
    })

    it('should include both HTML and text content', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      expect(requestBody.html).toBeTruthy()
      expect(requestBody.text).toBeTruthy()
      expect(requestBody.html).not.toBe(requestBody.text)
    })

    it('should handle special characters in player names', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'test_player-123'
      }
      
      const result = await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result.delivered).toBe(true)
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      expect(requestBody.subject).toContain('test_player-123')
      expect(requestBody.html).toContain('test_player-123')
      expect(requestBody.text).toContain('test_player-123')
    })

    it('should handle concurrent email sends', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const promises = Array.from({ length: 5 }, (_, i) => 
        sendNotificationEmail(
          mockEnv,
          testUsers.alice.id,
          'game_started',
          { ...notificationData, playerName: `player${i + 1}` }
        )
      )
      
      const results = await Promise.all(promises)
      
      results.forEach((result, index) => {
        expect(result.delivered).toBe(true)
        expect(result.notificationId).toBeTruthy()
      })
      
      // Verify all emails were sent
      expect(testEnv.mockFetch).toHaveBeenCalledTimes(5)
    })

    it('should handle empty environment gracefully', async () => {
      const emptyEnv = {
        ...mockEnv,
        RESEND_API_KEY: ''
      }
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru'
      }
      
      const result = await sendNotificationEmail(
        emptyEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      expect(result.delivered).toBe(false)
      expect(result.error).toContain('No email service configured')
    })

    it('should properly escape HTML in templates', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: '<script>alert("xss")</script>'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      // Should not contain raw script tags
      expect(requestBody.html).not.toContain('<script>')
      expect(requestBody.html).not.toContain('alert("xss")')
    })
  })

  describe('Email Template Validation', () => {
    it('should validate game start template structure', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru',
        gameUrl: 'https://chess.com/game/live/12345'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_started',
        notificationData
      )
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      validateEmailTemplate(
        requestBody.subject,
        requestBody.html,
        requestBody.text,
        {
          userEmail: testUsers.alice.email,
          baseUrl: 'https://chesshelper.app',
          unsubscribeUrl: `/unsubscribe/${testUsers.alice.id}/hikaru`,
          preferencesUrl: '/settings'
        }
      )
    })

    it('should validate game end template structure', async () => {
      testEnv.resendMocks.success()
      
      const notificationData: NotificationEmailData = {
        playerName: 'hikaru',
        result: 'Win'
      }
      
      await sendNotificationEmail(
        mockEnv,
        testUsers.alice.id,
        'game_ended',
        notificationData
      )
      
      const fetchCall = testEnv.mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body as string)
      
      validateEmailTemplate(
        requestBody.subject,
        requestBody.html,
        requestBody.text,
        {
          userEmail: testUsers.alice.email,
          baseUrl: 'https://chesshelper.app',
          unsubscribeUrl: `/unsubscribe/${testUsers.alice.id}/hikaru`,
          preferencesUrl: '/settings'
        }
      )
    })
  })
})
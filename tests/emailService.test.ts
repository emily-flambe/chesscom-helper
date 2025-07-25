import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestEnv, createTestUser } from './setup'
import { 
  sendNotificationEmailWithRetry
} from '../src/services/emailService'
import type { GameStartEmailData } from '../src/services/emailService'
import type { Env } from '../src/index'

// Mock fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Enhanced Email Service', () => {
  let env: Env
  let testUser: any
  let gameStartData: GameStartEmailData

  beforeEach(() => {
    env = createTestEnv()
    testUser = createTestUser()
    gameStartData = {
      playerName: 'TestPlayer',
      gameDetails: {
        timeControl: '10+0',
        rated: true,
        gameType: 'rapid',
        gameUrl: 'https://chess.com/game/123',
        startTime: new Date()
      },
      userPreferences: {
        unsubscribeUrl: 'https://example.com/unsubscribe',
        managePreferencesUrl: 'https://example.com/preferences'
      },
      userName: 'TestUser'
    }
    
    // Set up user in database
    env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      testUser.id, testUser.email, testUser.passwordHash, 
      testUser.createdAt, testUser.updatedAt
    ).run()
    
    // Reset mocks
    mockFetch.mockReset()
  })

  describe('Email Template Integration', () => {
    it('should send email with enhanced template data', async () => {
      env.RESEND_API_KEY = 'test-api-key'
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-123' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(true)
      
      // Verify the email content includes game details
      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.subject).toContain('TestPlayer')
      expect(requestBody.subject).toContain('10+0')
      expect(requestBody.html).toContain('TestPlayer')
      expect(requestBody.html).toContain('rapid')
      expect(requestBody.text).toContain('TestPlayer')
    })

    it('should include proper recipient and sender information', async () => {
      env.RESEND_API_KEY = 'test-api-key'
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-456' })
      })

      await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )
      
      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.to).toBe(testUser.email)
      expect(requestBody.from).toBe('Chess.com Helper <notifications@chesshelper.app>')
    })
  })

  describe('Email Delivery with Retry Logic', () => {
    beforeEach(() => {
      // Set up RESEND_API_KEY in environment
      env.RESEND_API_KEY = 'test-api-key'
    })

    it('should succeed on first attempt', async () => {
      // Mock successful Resend response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-123' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('resend-123')
      expect(result.retryCount).toBe(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      // Mock first two failures, then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'resend-456' })
        })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('resend-456')
      expect(result.retryCount).toBe(2)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should fail after max retries', async () => {
      // Mock all attempts to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 2 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed after all retries')
      expect(result.retryCount).toBe(3) // 0 + 2 retries + 1 original
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle rate limiting specifically', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 0 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit exceeded')
    })

    it('should handle invalid API key error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid API key' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 0 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid API key')
    })

    it('should handle bad request errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid email data' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 0 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid email data')
    })

    it('should use exponential backoff for retries', async () => {
      const startTime = Date.now()
      
      // Mock all attempts to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 2 }
      )

      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should have delays: 1000ms + 2000ms = 3000ms minimum
      expect(duration).toBeGreaterThan(3000)
    })

    it('should include proper email tags for analytics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-789' })
      })

      await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.tags).toContainEqual({
        name: 'type',
        value: 'game_notification'
      })
      expect(requestBody.tags).toContainEqual({
        name: 'source',
        value: 'chesscom_helper'
      })
    })

    it('should include proper from address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-999' })
      })

      await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.from).toBe('Chess.com Helper <notifications@chesshelper.app>')
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 0 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON') }
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 0 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Resend API error: 500')
    })
  })

  describe('Email Configuration', () => {
    it('should fail gracefully when no API key is configured', async () => {
      env.RESEND_API_KEY = undefined

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('No email service configured')
    })

    it('should handle missing user gracefully', async () => {
      env.RESEND_API_KEY = 'test-key'

      const result = await sendNotificationEmailWithRetry(
        env,
        'non-existent-user',
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('User not found')
    })
  })

  describe('Email Service Integration', () => {
    it('should log detailed notification information', async () => {
      env.RESEND_API_KEY = 'test-api-key'
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-integration-test' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('resend-integration-test')
      expect(result.deliveredAt).toBeDefined()
      expect(result.retryCount).toBe(0)
    })

    it('should handle different game types correctly', async () => {
      env.RESEND_API_KEY = 'test-api-key'
      
      const blitzGameData = {
        ...gameStartData,
        gameDetails: {
          ...gameStartData.gameDetails,
          timeControl: '3+2',
          gameType: 'blitz'
        }
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-blitz' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        blitzGameData
      )

      expect(result.success).toBe(true)
      
      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.subject).toContain('3+2')
      expect(requestBody.html).toContain('blitz')
    })
  })
})
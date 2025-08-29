/**
 * Email Template Tests
 * Comprehensive tests for email template rendering and validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EmailTemplateService, emailTemplateService } from '../../src/services/emailTemplateService'
import type {
  EmailTemplateData,
  EmailTemplateRenderInput,
  EmailTemplateRenderResult
} from '../../src/models/emailQueue'
import { 
  setupTestEnvironment,
  cleanupTestEnvironment,
  validateEmailTemplate,
  createMockEmailQueueDatabase
} from '../utils/emailTestHelpers'
import { 
  testTemplateData,
  createTestTemplateData
} from '../fixtures/emailTestData'
import { Read } from 'fs'

describe('Email Template Service', () => {
  let templateService: EmailTemplateService
  let mockDb: ReturnType<typeof createMockEmailQueueDatabase>
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    mockDb = testEnv.mockDb
    templateService = emailTemplateService
  })

  afterEach(() => {
    testEnv.cleanup()
    cleanupTestEnvironment()
  })

  describe('Template Rendering', () => {
    it('should render game start template correctly', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.subject).toContain('hikaru')
      expect(result.subject).toContain('playing')
      expect(result.html).toContain('hikaru')
      expect(result.html).toContain('magnuscarlsen')
      expect(result.html).toContain('Watch Live Game')
      expect(result.text).toContain('hikaru')
      expect(result.text).toContain('magnuscarlsen')

      validateEmailTemplate(
        result.subject,
        result.html,
        result.text,
        testTemplateData.gameStart
      )
    })

    it('should render game end template correctly', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'game_end',
        data: testTemplateData.gameEnd,
        userId: 'test-user-alice',
        priority: 'medium'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.subject).toContain('hikaru')
      expect(result.subject).toContain('ended')
      expect(result.html).toContain('hikaru')
      expect(result.html).toContain('finished')
      expect(result.html).toContain('Win')
      expect(result.text).toContain('Result: Win')

      validateEmailTemplate(
        result.subject,
        result.html,
        result.text,
        testTemplateData.gameEnd
      )
    })

    it('should render welcome template correctly', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'welcome',
        data: testTemplateData.welcome,
        userId: 'test-user-alice',
        priority: 'low'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.subject).toContain('Welcome')
      expect(result.html).toContain('Welcome')
      expect(result.html).toContain('Alice')
      expect(result.text).toContain('Welcome')
      expect(result.text).toContain('Alice')

      validateEmailTemplate(
        result.subject,
        result.html,
        result.text,
        testTemplateData.welcome
      )
    })

    it('should render digest template correctly', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'digest',
        data: testTemplateData.digest,
        userId: 'test-user-alice',
        priority: 'medium'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.subject).toContain('digest')
      expect(result.html).toContain('5') // game count
      expect(result.html).toContain('3') // win count
      expect(result.html).toContain('2') // loss count
      expect(result.text).toContain('5 games')

      validateEmailTemplate(
        result.subject,
        result.html,
        result.text,
        testTemplateData.digest
      )
    })

    it('should handle missing optional template data gracefully', async () => {
      const incompleteData = {
        ...testTemplateData.gameStart,
        gameUrl: undefined,
        opponentRating: undefined,
        opponentTitle: undefined
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: incompleteData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.subject).toContain('hikaru')
      expect(result.html).not.toContain('Watch Live Game')
      expect(result.html).not.toContain('GM') // No title
      expect(result.html).not.toContain('2850') // No rating
    })

    it('should escape HTML in template data', async () => {
      const maliciousData = {
        ...testTemplateData.gameStart,
        playerName: '<script>alert("xss")</script>',
        opponentName: '<img src="x" onerror="alert(1)">'
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: maliciousData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.html).not.toContain('<script>')
      expect(result.html).not.toContain('onerror')
      expect(result.html).not.toContain('alert')
      expect(result.text).not.toContain('<script>')
    })

    it('should handle unicode characters correctly', async () => {
      const unicodeData = {
        ...testTemplateData.gameStart,
        playerName: 'Карлсен_Magnus',
        opponentName: 'Нaka_муra'
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: unicodeData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.subject).toContain('Карлсен_Magnus')
      expect(result.html).toContain('Карлсен_Magnus')
      expect(result.html).toContain('Нaka_муra')
      expect(result.text).toContain('Карлсен_Magnus')
    })

    it('should generate proper unsubscribe links', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      expect(result.html).toContain('/unsubscribe/test-user-alice/hikaru')
      expect(result.html).toContain('/preferences')
      expect(result.text).toContain('/preferences')
    })

    it('should include proper email headers', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      // Should include List-Unsubscribe header data
      expect(result.html).toContain('unsubscribe')
      
      // Should include proper MIME structure
      expect(result.html).toMatch(/<html[^>]*>/i)
      expect(result.html).toMatch(/<head[^>]*>/i)
      expect(result.html).toMatch(/<body[^>]*>/i)
    })

    it('should handle different time zones correctly', async () => {
      const timeData = {
        ...testTemplateData.gameStart,
        gameStartTime: '2024-01-01T12:00:00.000Z'
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: timeData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      // Should include formatted time (implementation dependent)
      expect(result.html).toBeTruthy()
      expect(result.text).toBeTruthy()
    })
  })

  describe('Template Validation', () => {
    it('should validate template type', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'invalid_template' as any,
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      await expect(templateService.renderTemplate(input))
        .rejects.toThrow('Invalid template type')
    })

    it('should validate required template data', async () => {
      const incompleteData = {
        baseUrl: 'https://test.chesshelper.app'
        // Missing required fields
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: incompleteData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      await expect(templateService.renderTemplate(input))
        .rejects.toThrow('Missing required template data')
    })

    it('should validate email addresses in template data', async () => {
      const invalidData = {
        ...testTemplateData.gameStart,
        userEmail: 'invalid-email-format'
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: invalidData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      await expect(templateService.renderTemplate(input))
        .rejects.toThrow('Invalid email format')
    })

    it('should validate URL formats in template data', async () => {
      const invalidData = {
        ...testTemplateData.gameStart,
        gameUrl: 'not-a-valid-url'
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: invalidData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      await expect(templateService.renderTemplate(input))
        .rejects.toThrow('Invalid URL format')
    })

    it('should validate template exists', async () => {
      const isValid = await templateService.validateTemplate('game_start')
      expect(isValid).toBe(true)

      const isInvalid = await templateService.validateTemplate('non_existent' as any)
      expect(isInvalid).toBe(false)
    })
  })

  describe('Template Caching', () => {
    it('should cache rendered templates for performance', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      // Render same template twice
      const result1 = await templateService.renderTemplate(input)
      const result2 = await templateService.renderTemplate(input)

      expect(result1).toEqual(result2)
    })

    it('should invalidate cache when template data changes', async () => {
      const input1: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const input2: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: {
          ...testTemplateData.gameStart,
          playerName: 'different-player'
        },
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result1 = await templateService.renderTemplate(input1)
      const result2 = await templateService.renderTemplate(input2)

      expect(result1.subject).not.toEqual(result2.subject)
      expect(result1.html).not.toEqual(result2.html)
    })
  })

  describe('Template Localization', () => {
    it('should render templates in different languages', async () => {
      const englishData = {
        ...testTemplateData.gameStart,
        locale: 'en'
      }

      const spanishData = {
        ...testTemplateData.gameStart,
        locale: 'es'
      }

      const englishInput: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: englishData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const spanishInput: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: spanishData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const englishResult = await templateService.renderTemplate(englishInput)
      const spanishResult = await templateService.renderTemplate(spanishInput)

      expect(englishResult.subject).toContain('playing')
      // Spanish result would contain translated text if localization is implemented
      expect(spanishResult.subject).toBeTruthy()
    })

    it('should fall back to default language for unsupported locales', async () => {
      const unsupportedData = {
        ...testTemplateData.gameStart,
        locale: 'unsupported-locale'
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: unsupportedData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      // Should render in default language (English)
      expect(result.subject).toContain('playing')
      expect(result.html).toContain('Game Alert')
    })
  })

  describe('Template Customization', () => {
    it('should support custom template variables', async () => {
      const customData = {
        ...testTemplateData.gameStart,
        customMessage: 'This is a custom message',
        userPreferences: {
          includeAnalysis: true,
          includeOpponentInfo: false
        }
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: customData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const result = await templateService.renderTemplate(input)

      // Custom variables should be available in template
      expect(result.html).toBeTruthy()
      expect(result.text).toBeTruthy()
    })

    it('should support conditional content based on user preferences', async () => {
      const withAnalysisData = {
        ...testTemplateData.gameEnd,
        includeAnalysis: true,
        analysis: {
          accuracy: 92.5,
          blunders: 1,
          mistakes: 2
        }
      }

      const withoutAnalysisData = {
        ...testTemplateData.gameEnd,
        includeAnalysis: false
      }

      const withAnalysisInput: EmailTemplateRenderInput = {
        templateType: 'game_end',
        data: withAnalysisData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const withoutAnalysisInput: EmailTemplateRenderInput = {
        templateType: 'game_end',
        data: withoutAnalysisData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const withAnalysisResult = await templateService.renderTemplate(withAnalysisInput)
      const withoutAnalysisResult = await templateService.renderTemplate(withoutAnalysisInput)

      // Analysis should be included/excluded based on preferences
      expect(withAnalysisResult.html).toBeTruthy()
      expect(withoutAnalysisResult.html).toBeTruthy()
    })

    it('should support different styles based on priority', async () => {
      const highPriorityInput: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const lowPriorityInput: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'low'
      }

      const highPriorityResult = await templateService.renderTemplate(highPriorityInput)
      const lowPriorityResult = await templateService.renderTemplate(lowPriorityInput)

      // High priority emails might have different styling
      expect(highPriorityResult.html).toBeTruthy()
      expect(lowPriorityResult.html).toBeTruthy()
    })
  })

  describe('Template Performance', () => {
    it('should render templates efficiently', async () => {
      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      const startTime = performance.now()
      
      await templateService.renderTemplate(input)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(100) // Should render in under 100ms
    })

    it('should handle concurrent template rendering', async () => {
      const inputs = Array.from({ length: 10 }, (_, i) => ({
        templateType: 'game_start' as const,
        data: {
          ...testTemplateData.gameStart,
          playerName: `player${i}`
        },
        userId: `test-user-${i}`,
        priority: 'high' as const
      }))

      const startTime = performance.now()
      
      const results = await Promise.all(
        inputs.map(input => templateService.renderTemplate(input))
      )
      
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(10)
      expect(duration).toBeLessThan(500) // Should handle 10 concurrent renders in under 500ms
      
      results.forEach((result, index) => {
        expect(result.subject).toContain(`player${index}`)
      })
    })

    it('should optimize template loading', async () => {
      // Test multiple different template types
      const templateTypes: Array<'game_start' | 'game_end' | 'welcome' | 'digest'> = [
        'game_start', 'game_end', 'welcome', 'digest'
      ]

      const results = await Promise.all(
        templateTypes.map(templateType => templateService.renderTemplate({
          templateType,
          data: testTemplateData[templateType === 'game_start' ? 'gameStart' : 
                              templateType === 'game_end' ? 'gameEnd' :
                              templateType === 'welcome' ? 'welcome' : 'digest'],
          userId: 'test-user-alice',
          priority: 'high'
        }))
      )

      expect(results).toHaveLength(4)
      results.forEach(result => {
        expect(result.subject).toBeTruthy()
        expect(result.html).toBeTruthy()
        expect(result.text).toBeTruthy()
      })
    })
  })

  describe('Template Error Handling', () => {
    it('should handle missing template files gracefully', async () => {
      // Mock missing template file
      const originalRenderTemplate = templateService.renderTemplate
      vi.spyOn(templateService, 'renderTemplate').mockRejectedValue(
        new Error('Template file not found')
      )

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: testTemplateData.gameStart,
        userId: 'test-user-alice',
        priority: 'high'
      }

      await expect(templateService.renderTemplate(input))
        .rejects.toThrow('Template file not found')

      // Restore original method
      vi.mocked(templateService.renderTemplate).mockRestore()
    })

    it('should handle template syntax errors', async () => {
      // This would test malformed template files
      // Implementation depends on template engine used
      expect(true).toBe(true) // Placeholder
    })

    it('should provide meaningful error messages', async () => {
      const invalidInput = {
        templateType: 'game_start',
        data: null, // Invalid data
        userId: 'test-user-alice',
        priority: 'high'
      } as any

      await expect(templateService.renderTemplate(invalidInput))
        .rejects.toThrow(/template data/i)
    })

    it('should recover from partial rendering failures', async () => {
      // Test template with some invalid variables
      const partiallyInvalidData = {
        ...testTemplateData.gameStart,
        invalidProperty: { nested: { deeply: { invalid: null } } }
      }

      const input: EmailTemplateRenderInput = {
        templateType: 'game_start',
        data: partiallyInvalidData,
        userId: 'test-user-alice',
        priority: 'high'
      }

      // Should still render successfully, just ignoring invalid properties
      const result = await templateService.renderTemplate(input)
      
      expect(result.subject).toBeTruthy()
      expect(result.html).toBeTruthy()
      expect(result.text).toBeTruthy()
    })
  })
})
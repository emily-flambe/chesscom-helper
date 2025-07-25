// Simple test to verify setup
const { createTestEnv, createCustomMockD1Database } = require('./tests/setup.ts')

console.log('Testing basic setup...')

try {
  const env = createTestEnv()
  console.log('✓ createTestEnv works')
  
  const mockDB = createCustomMockD1Database({ firstResult: null })
  console.log('✓ createCustomMockD1Database works')
  
  console.log('✓ All basic setup tests passed!')
} catch (error) {
  console.error('✗ Error:', error.message)
}
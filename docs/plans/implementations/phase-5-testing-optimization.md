# Phase 5: Testing & Optimization Implementation Plan
## Email Notifications System - Final Quality Assurance & Performance Optimization

**Version**: 1.0  
**Date**: 2025-07-06  
**Phase**: 5 of 5 (Days 13-15)  
**Target Audience**: Claude AI Agents  
**Estimated Duration**: 3 days  

---

## 🎯 Phase Overview

Phase 5 is the final phase of the email notifications system implementation, focusing on comprehensive testing, performance optimization, and production readiness. This phase ensures the system can handle production-scale loads while maintaining reliability and performance standards.

### Key Objectives
1. **End-to-End Testing**: Complete system validation across all user journeys
2. **Load Testing**: Validate performance under high-traffic scenarios (10,000+ users, 50,000+ emails/day)
3. **Security Testing**: Comprehensive security validation and compliance verification
4. **Performance Optimization**: Identify and resolve bottlenecks for production readiness
5. **Production Deployment**: Final preparation for live deployment with monitoring
6. **Documentation**: Complete technical and user documentation

---

## 📋 Detailed Task Breakdown

### Task 1: End-to-End Testing Suite (10 hours)

#### 1.1 Complete User Journey Tests (4 hours)
**Objective**: Validate all user flows from registration to email delivery

**Files**: 
- `tests/e2e/user-journey.test.ts`
- `tests/e2e/notification-flow.test.ts`

**Implementation Details**:
```typescript
// Complete user journey testing
describe('End-to-End User Journey Tests', () => {
  describe('New User Registration and Notification Setup', () => {
    it('should complete full user registration and notification flow', async () => {
      // Test Steps:
      // 1. User registers account
      // 2. User adds tracked players
      // 3. User enables notifications
      // 4. System detects player game start
      // 5. Notification is sent
      // 6. User receives email
      // 7. User clicks game link
      // 8. User manages preferences
      
      const testUser = await createTestUser();
      const testPlayer = 'testplayer123';
      
      // Register user
      const registrationResponse = await makeRequest('POST', '/auth/register', {
        username: testUser.username,
        email: testUser.email,
        password: testUser.password
      });
      expect(registrationResponse.status).toBe(201);
      
      // Login user
      const loginResponse = await makeRequest('POST', '/auth/login', {
        username: testUser.username,
        password: testUser.password
      });
      expect(loginResponse.status).toBe(200);
      const { token } = await loginResponse.json();
      
      // Add tracked player
      const addPlayerResponse = await makeRequest('POST', '/api/players', {
        username: testPlayer
      }, { Authorization: `Bearer ${token}` });
      expect(addPlayerResponse.status).toBe(201);
      
      // Enable notifications for player
      const enableNotificationsResponse = await makeRequest('POST', '/api/notifications/preferences', {
        playerUsername: testPlayer,
        notificationsEnabled: true
      }, { Authorization: `Bearer ${token}` });
      expect(enableNotificationsResponse.status).toBe(200);
      
      // Simulate player game start
      await simulatePlayerGameStart(testPlayer);
      
      // Trigger monitoring job
      await triggerMonitoringJob();
      
      // Wait for notification processing
      await waitForNotificationProcessing();
      
      // Verify notification was sent
      const notificationLogs = await getNotificationLogs(testUser.id, testPlayer);
      expect(notificationLogs.length).toBe(1);
      expect(notificationLogs[0].status).toBe('sent');
      
      // Verify email was queued and delivered
      const emailLogs = await getEmailLogs(testUser.email);
      expect(emailLogs.length).toBe(1);
      expect(emailLogs[0].delivered).toBe(true);
    });
    
    it('should handle notification preferences management', async () => {
      // Test notification preference changes
      const testUser = await createTestUser();
      const testPlayer = 'testplayer456';
      
      // Setup user and player
      await setupUserAndPlayer(testUser, testPlayer);
      
      // Test disabling notifications
      const disableResponse = await makeRequest('POST', '/api/notifications/preferences', {
        playerUsername: testPlayer,
        notificationsEnabled: false
      }, { Authorization: `Bearer ${testUser.token}` });
      expect(disableResponse.status).toBe(200);
      
      // Simulate game start - should not trigger notification
      await simulatePlayerGameStart(testPlayer);
      await triggerMonitoringJob();
      await waitForNotificationProcessing();
      
      const notificationLogs = await getNotificationLogs(testUser.id, testPlayer);
      expect(notificationLogs.length).toBe(0);
      
      // Test re-enabling notifications
      const enableResponse = await makeRequest('POST', '/api/notifications/preferences', {
        playerUsername: testPlayer,
        notificationsEnabled: true
      }, { Authorization: `Bearer ${testUser.token}` });
      expect(enableResponse.status).toBe(200);
      
      // Simulate game start - should trigger notification
      await simulatePlayerGameStart(testPlayer);
      await triggerMonitoringJob();
      await waitForNotificationProcessing();
      
      const newNotificationLogs = await getNotificationLogs(testUser.id, testPlayer);
      expect(newNotificationLogs.length).toBe(1);
    });
  });
  
  describe('Notification Cooldown Tests', () => {
    it('should enforce 1-hour cooldown between notifications', async () => {
      const testUser = await createTestUser();
      const testPlayer = 'testplayer789';
      
      await setupUserAndPlayer(testUser, testPlayer);
      
      // First game start - should trigger notification
      await simulatePlayerGameStart(testPlayer);
      await processNotifications();
      
      let logs = await getNotificationLogs(testUser.id, testPlayer);
      expect(logs.length).toBe(1);
      
      // Second game start within cooldown - should not trigger
      await simulatePlayerGameStart(testPlayer);
      await processNotifications();
      
      logs = await getNotificationLogs(testUser.id, testPlayer);
      expect(logs.length).toBe(1); // Still only one
      
      // Advance time by 1 hour and test again
      await advanceTimeBy(60 * 60 * 1000); // 1 hour
      await simulatePlayerGameStart(testPlayer);
      await processNotifications();
      
      logs = await getNotificationLogs(testUser.id, testPlayer);
      expect(logs.length).toBe(2); // Now two notifications
    });
  });
  
  describe('Error Recovery Tests', () => {
    it('should recover from email delivery failures', async () => {
      const testUser = await createTestUser();
      const testPlayer = 'testplayer101';
      
      await setupUserAndPlayer(testUser, testPlayer);
      
      // Mock email service to fail
      mockEmailServiceFailure();
      
      await simulatePlayerGameStart(testPlayer);
      await processNotifications();
      
      // Should be in failed state
      let logs = await getNotificationLogs(testUser.id, testPlayer);
      expect(logs[0].status).toBe('failed');
      
      // Restore email service
      restoreEmailService();
      
      // Process retry queue
      await processRetryQueue();
      
      // Should now be successful
      logs = await getNotificationLogs(testUser.id, testPlayer);
      expect(logs[0].status).toBe('sent');
    });
  });
});
```

#### 1.2 API Integration Tests (3 hours)
**Objective**: Validate all API endpoints and integrations

**Files**: 
- `tests/integration/api-endpoints.test.ts`
- `tests/integration/chess-com-api.test.ts`

**Implementation Details**:
```typescript
// API endpoint integration tests
describe('API Integration Tests', () => {
  describe('Notification API Endpoints', () => {
    it('should handle notification preferences CRUD operations', async () => {
      const testUser = await createAuthenticatedUser();
      const testPlayer = 'testplayer';
      
      // Create preference
      const createResponse = await makeRequest('POST', '/api/notifications/preferences', {
        playerUsername: testPlayer,
        notificationsEnabled: true
      }, { Authorization: `Bearer ${testUser.token}` });
      expect(createResponse.status).toBe(201);
      
      // Read preference
      const readResponse = await makeRequest('GET', `/api/notifications/preferences/${testPlayer}`, {}, {
        Authorization: `Bearer ${testUser.token}`
      });
      expect(readResponse.status).toBe(200);
      const preference = await readResponse.json();
      expect(preference.notificationsEnabled).toBe(true);
      
      // Update preference
      const updateResponse = await makeRequest('PUT', `/api/notifications/preferences/${testPlayer}`, {
        notificationsEnabled: false
      }, { Authorization: `Bearer ${testUser.token}` });
      expect(updateResponse.status).toBe(200);
      
      // Verify update
      const verifyResponse = await makeRequest('GET', `/api/notifications/preferences/${testPlayer}`, {}, {
        Authorization: `Bearer ${testUser.token}`
      });
      const updatedPreference = await verifyResponse.json();
      expect(updatedPreference.notificationsEnabled).toBe(false);
    });
    
    it('should handle notification history retrieval', async () => {
      const testUser = await createAuthenticatedUser();
      
      // Create some notification history
      await createNotificationHistory(testUser.id, 5);
      
      // Retrieve history
      const historyResponse = await makeRequest('GET', '/api/notifications/history', {}, {
        Authorization: `Bearer ${testUser.token}`
      });
      expect(historyResponse.status).toBe(200);
      
      const history = await historyResponse.json();
      expect(history.notifications.length).toBe(5);
      expect(history.notifications[0]).toHaveProperty('playerUsername');
      expect(history.notifications[0]).toHaveProperty('sentAt');
      expect(history.notifications[0]).toHaveProperty('status');
    });
    
    it('should handle unsubscribe operations', async () => {
      const testUser = await createAuthenticatedUser();
      const unsubscribeToken = generateUnsubscribeToken(testUser.email);
      
      const unsubscribeResponse = await makeRequest('POST', '/api/notifications/unsubscribe', {
        token: unsubscribeToken
      });
      expect(unsubscribeResponse.status).toBe(200);
      
      // Verify user preferences were updated
      const userPrefs = await getUserPreferences(testUser.id);
      expect(userPrefs.notificationsEnabled).toBe(false);
    });
  });
  
  describe('Chess.com API Integration', () => {
    it('should handle rate limiting gracefully', async () => {
      const players = Array.from({ length: 100 }, (_, i) => `player${i}`);
      
      const startTime = Date.now();
      const results = await optimizedBatchGetPlayerStatuses(players);
      const endTime = Date.now();
      
      // Should complete within reasonable time despite rate limiting
      expect(endTime - startTime).toBeLessThan(60000); // 1 minute
      expect(results.length).toBe(100);
    });
    
    it('should handle API failures with proper fallbacks', async () => {
      // Mock API to return errors
      mockChessComApiFailure();
      
      const players = ['player1', 'player2'];
      const results = await safeApiCall(() => optimizedBatchGetPlayerStatuses(players));
      
      // Should not throw, should return fallback data
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
```

#### 1.3 Database Integration Tests (3 hours)
**Objective**: Validate database operations and data integrity

**Files**: 
- `tests/integration/database.test.ts`
- `tests/integration/data-integrity.test.ts`

**Implementation Details**:
```typescript
// Database integration tests
describe('Database Integration Tests', () => {
  describe('Notification Data Operations', () => {
    it('should maintain data integrity across notification operations', async () => {
      const testUser = await createTestUser();
      const testPlayer = 'testplayer';
      
      // Create subscription
      await createPlayerSubscription(testUser.id, testPlayer);
      
      // Create notification
      const notification = await createNotification(testUser.id, testPlayer);
      
      // Verify foreign key relationships
      const subscription = await getPlayerSubscription(testUser.id, testPlayer);
      expect(subscription).toBeDefined();
      
      const notificationLog = await getNotificationById(notification.id);
      expect(notificationLog.userId).toBe(testUser.id);
      expect(notificationLog.playerUsername).toBe(testPlayer);
      
      // Test cascade delete
      await deleteUser(testUser.id);
      
      const orphanedSubscription = await getPlayerSubscription(testUser.id, testPlayer);
      expect(orphanedSubscription).toBeNull();
      
      const orphanedNotification = await getNotificationById(notification.id);
      expect(orphanedNotification).toBeNull();
    });
    
    it('should handle concurrent notification operations', async () => {
      const testUser = await createTestUser();
      const players = ['player1', 'player2', 'player3'];
      
      // Create concurrent notification operations
      const promises = players.map(async (player) => {
        await createPlayerSubscription(testUser.id, player);
        return createNotification(testUser.id, player);
      });
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(3);
      
      // Verify all notifications were created
      const notifications = await getNotificationsByUserId(testUser.id);
      expect(notifications.length).toBe(3);
    });
  });
  
  describe('Performance Tests', () => {
    it('should handle large notification queries efficiently', async () => {
      // Create test data
      const users = await createTestUsers(100);
      const players = ['player1', 'player2', 'player3'];
      
      // Create subscriptions for all users
      for (const user of users) {
        for (const player of players) {
          await createPlayerSubscription(user.id, player);
        }
      }
      
      // Test batch notification query
      const startTime = Date.now();
      const subscribers = await getSubscribersForPlayers(players);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second
      expect(subscribers.length).toBe(300); // 100 users × 3 players
    });
    
    it('should cleanup old data efficiently', async () => {
      // Create old test data
      await createOldNotificationLogs(1000, 30); // 1000 logs, 30 days old
      
      const startTime = Date.now();
      await cleanupOldLogs();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Under 5 seconds
      
      // Verify cleanup worked
      const remainingLogs = await getNotificationLogCount();
      expect(remainingLogs).toBe(0);
    });
  });
});
```

---

### Task 2: Load Testing & Performance Validation (12 hours)

#### 2.1 High-Volume User Simulation (4 hours)
**Objective**: Test system performance with 10,000+ users and 50,000+ daily emails

**Files**: 
- `tests/load/user-simulation.test.ts`
- `tests/load/notification-volume.test.ts`

**Implementation Details**:
```typescript
// Load testing framework
describe('Load Testing - High Volume Scenarios', () => {
  describe('10,000+ User Simulation', () => {
    it('should handle 10,000 users with active subscriptions', async () => {
      const userCount = 10000;
      const playersPerUser = 5;
      
      console.log(`Creating ${userCount} test users...`);
      const startTime = Date.now();
      
      // Create users in batches
      const batchSize = 100;
      const userBatches = Math.ceil(userCount / batchSize);
      
      for (let i = 0; i < userBatches; i++) {
        const batchUsers = await createTestUserBatch(batchSize, i);
        
        // Create subscriptions for each user
        for (const user of batchUsers) {
          await createPlayerSubscriptionsBatch(user.id, playersPerUser);
        }
        
        console.log(`Created batch ${i + 1}/${userBatches}`);
      }
      
      const setupTime = Date.now() - startTime;
      console.log(`Setup completed in ${setupTime}ms`);
      
      // Test monitoring job with large user base
      const monitoringStartTime = Date.now();
      await triggerMonitoringJob();
      const monitoringEndTime = Date.now();
      
      const monitoringDuration = monitoringEndTime - monitoringStartTime;
      console.log(`Monitoring job completed in ${monitoringDuration}ms`);
      
      // Performance benchmarks
      expect(monitoringDuration).toBeLessThan(300000); // Under 5 minutes
      expect(setupTime).toBeLessThan(600000); // Under 10 minutes
      
      // Verify system stability
      const systemHealth = await checkSystemHealth();
      expect(systemHealth.databaseConnections).toBeLessThan(10);
      expect(systemHealth.memoryUsage).toBeLessThan(512); // 512MB
    });
    
    it('should process 50,000 notifications per day', async () => {
      const dailyNotifications = 50000;
      const batchSize = 1000;
      const batches = Math.ceil(dailyNotifications / batchSize);
      
      console.log(`Simulating ${dailyNotifications} daily notifications...`);
      
      const startTime = Date.now();
      let processedCount = 0;
      
      for (let i = 0; i < batches; i++) {
        // Create batch of notifications
        const notifications = await createNotificationBatch(batchSize);
        
        // Process batch
        const batchStartTime = Date.now();
        await processNotificationBatch(notifications);
        const batchEndTime = Date.now();
        
        processedCount += notifications.length;
        
        const batchDuration = batchEndTime - batchStartTime;
        const avgTimePerNotification = batchDuration / notifications.length;
        
        console.log(`Batch ${i + 1}/${batches}: ${notifications.length} notifications in ${batchDuration}ms (${avgTimePerNotification.toFixed(2)}ms/notification)`);
        
        // Performance assertions for each batch
        expect(batchDuration).toBeLessThan(30000); // Under 30 seconds per batch
        expect(avgTimePerNotification).toBeLessThan(50); // Under 50ms per notification
      }
      
      const totalTime = Date.now() - startTime;
      const avgNotificationTime = totalTime / processedCount;
      
      console.log(`Total: ${processedCount} notifications in ${totalTime}ms (${avgNotificationTime.toFixed(2)}ms/notification)`);
      
      // Final performance assertions
      expect(totalTime).toBeLessThan(3600000); // Under 1 hour
      expect(avgNotificationTime).toBeLessThan(100); // Under 100ms per notification
      expect(processedCount).toBe(dailyNotifications);
    });
  });
  
  describe('Concurrent User Operations', () => {
    it('should handle 1000 concurrent preference updates', async () => {
      const concurrentUsers = 1000;
      const users = await createTestUsers(concurrentUsers);
      
      const startTime = Date.now();
      
      // Create concurrent preference update operations
      const promises = users.map(async (user) => {
        return makeRequest('POST', '/api/notifications/preferences', {
          playerUsername: 'testplayer',
          notificationsEnabled: true
        }, { Authorization: `Bearer ${user.token}` });
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Verify all operations succeeded
      const successCount = results.filter(r => r.status === 200).length;
      expect(successCount).toBe(concurrentUsers);
      
      // Performance assertions
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(30000); // Under 30 seconds
      
      console.log(`1000 concurrent operations completed in ${totalTime}ms`);
    });
    
    it('should handle 500 concurrent notification deliveries', async () => {
      const concurrentNotifications = 500;
      const notifications = await createNotificationBatch(concurrentNotifications);
      
      const startTime = Date.now();
      
      // Process notifications concurrently
      const promises = notifications.map(async (notification) => {
        return sendNotificationEmail(notification);
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Verify all deliveries succeeded
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(475); // Allow for some failures (95% success rate)
      
      // Performance assertions
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(60000); // Under 1 minute
      
      console.log(`500 concurrent deliveries completed in ${totalTime}ms with ${successCount} successes`);
    });
  });
});
```

#### 2.2 Database Performance Testing (4 hours)
**Objective**: Validate database performance under load

**Files**: 
- `tests/load/database-performance.test.ts`
- `tests/load/query-optimization.test.ts`

**Implementation Details**:
```typescript
// Database performance testing
describe('Database Performance Tests', () => {
  describe('Large Dataset Operations', () => {
    it('should handle 100,000 notification log queries efficiently', async () => {
      // Create large dataset
      const logCount = 100000;
      await createNotificationLogBatch(logCount);
      
      // Test various query patterns
      const queries = [
        {
          name: 'Get recent notifications by user',
          fn: () => getRecentNotificationsByUser(1, 50),
          expectedTime: 1000
        },
        {
          name: 'Get notifications by player',
          fn: () => getNotificationsByPlayer('testplayer', 50),
          expectedTime: 1000
        },
        {
          name: 'Get notification statistics',
          fn: () => getNotificationStatistics(7), // Last 7 days
          expectedTime: 2000
        },
        {
          name: 'Check cooldown for multiple players',
          fn: () => checkCooldownForMultiplePlayers(1, ['player1', 'player2', 'player3']),
          expectedTime: 500
        }
      ];
      
      for (const query of queries) {
        const startTime = Date.now();
        const result = await query.fn();
        const endTime = Date.now();
        
        const duration = endTime - startTime;
        console.log(`${query.name}: ${duration}ms`);
        
        expect(duration).toBeLessThan(query.expectedTime);
        expect(result).toBeDefined();
      }
    });
    
    it('should handle concurrent database writes', async () => {
      const concurrentWrites = 200;
      const userId = 1;
      
      const startTime = Date.now();
      
      // Create concurrent write operations
      const promises = Array.from({ length: concurrentWrites }, async (_, i) => {
        return createNotificationLog({
          userId,
          playerUsername: `player${i}`,
          notificationType: 'game_start',
          gameDetails: { gameId: `game${i}` }
        });
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Verify all writes succeeded
      expect(results.length).toBe(concurrentWrites);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      });
      
      // Performance assertions
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds
      
      console.log(`${concurrentWrites} concurrent writes completed in ${totalTime}ms`);
    });
  });
  
  describe('Index Performance', () => {
    it('should utilize indexes for notification queries', async () => {
      // Create test data with various patterns
      await createNotificationDataWithPatterns(10000);
      
      // Test queries that should use indexes
      const indexedQueries = [
        {
          name: 'User-specific notifications',
          query: 'SELECT * FROM notification_log WHERE user_id = ? ORDER BY sent_at DESC LIMIT 50',
          params: [1]
        },
        {
          name: 'Player-specific notifications',
          query: 'SELECT * FROM notification_log WHERE player_username = ? ORDER BY sent_at DESC LIMIT 50',
          params: ['testplayer']
        },
        {
          name: 'Cooldown check',
          query: 'SELECT COUNT(*) FROM notification_log WHERE user_id = ? AND player_username = ? AND sent_at > ?',
          params: [1, 'testplayer', new Date(Date.now() - 3600000).toISOString()]
        }
      ];
      
      for (const { name, query, params } of indexedQueries) {
        const startTime = Date.now();
        const result = await executeQuery(query, params);
        const endTime = Date.now();
        
        const duration = endTime - startTime;
        console.log(`${name}: ${duration}ms`);
        
        // Indexed queries should be very fast
        expect(duration).toBeLessThan(100); // Under 100ms
        expect(result).toBeDefined();
      }
    });
  });
});
```

#### 2.3 API Rate Limiting Tests (4 hours)
**Objective**: Test Chess.com API rate limiting and system resilience

**Files**: 
- `tests/load/api-rate-limiting.test.ts`
- `tests/load/system-resilience.test.ts`

**Implementation Details**:
```typescript
// API rate limiting and resilience tests
describe('API Rate Limiting & Resilience Tests', () => {
  describe('Chess.com API Rate Limiting', () => {
    it('should handle API rate limits gracefully', async () => {
      const players = Array.from({ length: 1000 }, (_, i) => `player${i}`);
      
      const startTime = Date.now();
      
      // This should trigger rate limiting
      const results = await optimizedBatchGetPlayerStatuses(players);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete despite rate limiting
      expect(results.length).toBe(1000);
      
      // Should take longer due to rate limiting but not too long
      expect(duration).toBeGreaterThan(60000); // At least 1 minute
      expect(duration).toBeLessThan(600000); // Under 10 minutes
      
      console.log(`Processed 1000 players in ${duration}ms with rate limiting`);
    });
    
    it('should recover from temporary API failures', async () => {
      const players = ['player1', 'player2', 'player3'];
      
      // Mock API to fail initially, then recover
      mockChessComApiFailureThenRecover(3); // Fail 3 times, then succeed
      
      const startTime = Date.now();
      const results = await optimizedBatchGetPlayerStatuses(players);
      const endTime = Date.now();
      
      // Should eventually succeed
      expect(results.length).toBe(3);
      
      // Should take some time due to retries
      expect(endTime - startTime).toBeGreaterThan(5000); // At least 5 seconds
      
      console.log(`Recovered from API failures in ${endTime - startTime}ms`);
    });
  });
  
  describe('System Resilience', () => {
    it('should handle email service outages', async () => {
      const notifications = await createNotificationBatch(100);
      
      // Mock email service to fail
      mockEmailServiceOutage();
      
      const startTime = Date.now();
      await processNotificationBatch(notifications);
      const endTime = Date.now();
      
      // Should complete quickly (not hang)
      expect(endTime - startTime).toBeLessThan(30000); // Under 30 seconds
      
      // All notifications should be marked as failed
      const failedCount = await getFailedNotificationCount();
      expect(failedCount).toBe(100);
      
      // Restore email service
      restoreEmailService();
      
      // Process retry queue
      const retryStartTime = Date.now();
      await processRetryQueue();
      const retryEndTime = Date.now();
      
      // Should successfully retry
      const successCount = await getSuccessfulNotificationCount();
      expect(successCount).toBe(100);
      
      console.log(`Recovered from email outage in ${retryEndTime - retryStartTime}ms`);
    });
    
    it('should handle database connection issues', async () => {
      // Simulate database connection pool exhaustion
      await exhaustDatabaseConnectionPool();
      
      const startTime = Date.now();
      
      // Should handle gracefully without crashing
      const result = await safeExecute(() => processNotificationQueue());
      
      const endTime = Date.now();
      
      // Should complete without error
      expect(result.error).toBeUndefined();
      expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds
      
      // Restore database connections
      await restoreDatabaseConnections();
    });
  });
});
```

---

### Task 3: Security Testing & Compliance (8 hours)

#### 3.1 Email Security Testing (3 hours)
**Objective**: Validate email security and compliance

**Files**: 
- `tests/security/email-security.test.ts`
- `tests/security/compliance.test.ts`

**Implementation Details**:
```typescript
// Email security testing
describe('Email Security Tests', () => {
  describe('Email Authentication', () => {
    it('should include proper SPF, DKIM, and DMARC headers', async () => {
      const testUser = await createTestUser();
      const notification = await createTestNotification(testUser);
      
      // Send email and capture headers
      const emailResult = await sendNotificationEmailWithHeaders(notification);
      
      // Verify SPF
      expect(emailResult.headers['Received-SPF']).toContain('pass');
      
      // Verify DKIM
      expect(emailResult.headers['DKIM-Signature']).toBeDefined();
      
      // Verify DMARC
      expect(emailResult.headers['Authentication-Results']).toContain('dmarc=pass');
    });
    
    it('should prevent email injection attacks', async () => {
      const maliciousInputs = [
        'test@example.com\nBcc: hacker@evil.com',
        'test@example.com\r\nTo: victim@example.com',
        'test@example.com\n\nMALICIOUS CONTENT',
        'test@example.com%0A%0AAttack'
      ];
      
      for (const maliciousInput of maliciousInputs) {
        const testUser = { email: maliciousInput };
        
        // Should sanitize or reject malicious input
        const result = await safeExecute(() => sendNotificationEmail(testUser, 'testplayer'));
        
        if (result.error) {
          // Should reject malicious input
          expect(result.error.message).toContain('Invalid email');
        } else {
          // Should sanitize input
          expect(result.sanitizedEmail).not.toContain('\n');
          expect(result.sanitizedEmail).not.toContain('\r');
        }
      }
    });
  });
  
  describe('Unsubscribe Security', () => {
    it('should use secure unsubscribe tokens', async () => {
      const testUser = await createTestUser();
      const unsubscribeToken = generateUnsubscribeToken(testUser.email);
      
      // Token should be properly signed/encrypted
      expect(unsubscribeToken).toMatch(/^[a-zA-Z0-9+/=]+$/); // Base64 pattern
      expect(unsubscribeToken.length).toBeGreaterThan(32); // Should be substantial
      
      // Should be able to validate token
      const isValid = await validateUnsubscribeToken(unsubscribeToken, testUser.email);
      expect(isValid).toBe(true);
      
      // Should reject invalid tokens
      const invalidToken = unsubscribeToken.slice(0, -1) + 'x'; // Modify token
      const isInvalid = await validateUnsubscribeToken(invalidToken, testUser.email);
      expect(isInvalid).toBe(false);
    });
    
    it('should prevent unsubscribe token reuse', async () => {
      const testUser = await createTestUser();
      const unsubscribeToken = generateUnsubscribeToken(testUser.email);
      
      // First use should succeed
      const firstUse = await processUnsubscribe(unsubscribeToken);
      expect(firstUse.success).toBe(true);
      
      // Second use should fail
      const secondUse = await processUnsubscribe(unsubscribeToken);
      expect(secondUse.success).toBe(false);
      expect(secondUse.error).toContain('Token already used');
    });
  });
  
  describe('Content Security', () => {
    it('should sanitize email content', async () => {
      const maliciousContent = {
        playerName: '<script>alert("xss")</script>',
        gameType: 'rapid"><img src=x onerror=alert(1)>',
        opponent: 'player\n\nMALICIOUS CONTENT'
      };
      
      const emailContent = await composeGameStartEmail(
        { email: 'test@example.com' },
        maliciousContent.playerName,
        { gameType: maliciousContent.gameType, opponent: maliciousContent.opponent }
      );
      
      // Should escape HTML entities
      expect(emailContent.html).not.toContain('<script>');
      expect(emailContent.html).not.toContain('onerror=');
      expect(emailContent.html).not.toContain('MALICIOUS CONTENT');
      
      // Should escape in text version too
      expect(emailContent.text).not.toContain('<script>');
      expect(emailContent.text).not.toContain('MALICIOUS CONTENT');
    });
  });
});
```

#### 3.2 Data Privacy & Compliance Testing (3 hours)
**Objective**: Validate GDPR/privacy compliance

**Files**: 
- `tests/security/privacy-compliance.test.ts`
- `tests/security/data-protection.test.ts`

**Implementation Details**:
```typescript
// Privacy and compliance testing
describe('Privacy & Compliance Tests', () => {
  describe('GDPR Compliance', () => {
    it('should support data export requests', async () => {
      const testUser = await createTestUser();
      
      // Create user data
      await createUserActivity(testUser.id, 30); // 30 days of activity
      
      // Request data export
      const exportRequest = await requestDataExport(testUser.id);
      expect(exportRequest.success).toBe(true);
      
      // Verify export includes all user data
      const exportData = await getDataExport(exportRequest.exportId);
      
      expect(exportData.user).toBeDefined();
      expect(exportData.subscriptions).toBeDefined();
      expect(exportData.notifications).toBeDefined();
      expect(exportData.preferences).toBeDefined();
      
      // Verify data completeness
      expect(exportData.user.email).toBe(testUser.email);
      expect(exportData.subscriptions.length).toBeGreaterThan(0);
      expect(exportData.notifications.length).toBeGreaterThan(0);
    });
    
    it('should support data deletion requests', async () => {
      const testUser = await createTestUser();
      
      // Create user data
      await createUserActivity(testUser.id, 30);
      
      // Verify data exists
      const userData = await getUserData(testUser.id);
      expect(userData.subscriptions.length).toBeGreaterThan(0);
      
      // Request data deletion
      const deletionRequest = await requestDataDeletion(testUser.id);
      expect(deletionRequest.success).toBe(true);
      
      // Verify data is deleted
      const deletedUserData = await getUserData(testUser.id);
      expect(deletedUserData).toBeNull();
      
      // Verify cascading deletion
      const orphanedSubscriptions = await getPlayerSubscriptionsByUserId(testUser.id);
      expect(orphanedSubscriptions.length).toBe(0);
      
      const orphanedNotifications = await getNotificationsByUserId(testUser.id);
      expect(orphanedNotifications.length).toBe(0);
    });
    
    it('should anonymize data when required', async () => {
      const testUser = await createTestUser();
      
      // Create notification history
      await createNotificationHistory(testUser.id, 10);
      
      // Request anonymization
      const anonymizationRequest = await requestDataAnonymization(testUser.id);
      expect(anonymizationRequest.success).toBe(true);
      
      // Verify user data is anonymized
      const anonymizedUser = await getUserById(testUser.id);
      expect(anonymizedUser.email).toMatch(/^anon_[a-f0-9]+@deleted\.local$/);
      expect(anonymizedUser.username).toMatch(/^anon_[a-f0-9]+$/);
      
      // Verify notification history is preserved but anonymized
      const notifications = await getNotificationsByUserId(testUser.id);
      expect(notifications.length).toBe(10);
      notifications.forEach(notification => {
        expect(notification.userId).toBe(testUser.id);
        expect(notification.playerUsername).toBeDefined(); // Preserved for analytics
      });
    });
  });
  
  describe('Data Retention', () => {
    it('should automatically delete old data', async () => {
      // Create old data
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      await createNotificationLogsWithDate(100, oldDate);
      
      // Create recent data
      await createNotificationLogsWithDate(100, new Date());
      
      // Run cleanup
      await cleanupOldData();
      
      // Verify old data is deleted
      const remainingLogs = await getNotificationLogCount();
      expect(remainingLogs).toBe(100); // Only recent logs should remain
    });
    
    it('should respect retention periods by data type', async () => {
      const retentionPolicies = [
        { type: 'notification_log', days: 30 },
        { type: 'status_change_log', days: 7 },
        { type: 'monitoring_jobs', days: 7 }
      ];
      
      for (const policy of retentionPolicies) {
        // Create data older than retention period
        const oldDate = new Date(Date.now() - (policy.days + 1) * 24 * 60 * 60 * 1000);
        await createDataWithDate(policy.type, 50, oldDate);
        
        // Create data within retention period
        const recentDate = new Date(Date.now() - (policy.days - 1) * 24 * 60 * 60 * 1000);
        await createDataWithDate(policy.type, 50, recentDate);
        
        // Run cleanup
        await cleanupDataByType(policy.type);
        
        // Verify only recent data remains
        const remainingCount = await getDataCountByType(policy.type);
        expect(remainingCount).toBe(50);
      }
    });
  });
});
```

#### 3.3 Authentication & Authorization Testing (2 hours)
**Objective**: Validate access control and security

**Files**: 
- `tests/security/authentication.test.ts`
- `tests/security/authorization.test.ts`

**Implementation Details**:
```typescript
// Authentication and authorization testing
describe('Authentication & Authorization Tests', () => {
  describe('API Authentication', () => {
    it('should reject requests without authentication', async () => {
      const endpoints = [
        { method: 'GET', path: '/api/notifications/preferences' },
        { method: 'POST', path: '/api/notifications/preferences' },
        { method: 'GET', path: '/api/notifications/history' },
        { method: 'POST', path: '/api/players' }
      ];
      
      for (const endpoint of endpoints) {
        const response = await makeRequest(endpoint.method, endpoint.path);
        expect(response.status).toBe(401);
        
        const body = await response.json();
        expect(body.error).toContain('Authentication required');
      }
    });
    
    it('should reject requests with invalid tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid',
        '',
        null
      ];
      
      for (const token of invalidTokens) {
        const response = await makeRequest('GET', '/api/notifications/preferences', {}, {
          Authorization: token
        });
        expect(response.status).toBe(401);
      }
    });
    
    it('should reject expired tokens', async () => {
      const expiredToken = await createExpiredToken();
      
      const response = await makeRequest('GET', '/api/notifications/preferences', {}, {
        Authorization: `Bearer ${expiredToken}`
      });
      expect(response.status).toBe(401);
      
      const body = await response.json();
      expect(body.error).toContain('Token expired');
    });
  });
  
  describe('Data Access Authorization', () => {
    it('should prevent users from accessing other users data', async () => {
      const user1 = await createAuthenticatedUser();
      const user2 = await createAuthenticatedUser();
      
      // Create data for user1
      await createPlayerSubscription(user1.id, 'testplayer');
      await createNotificationHistory(user1.id, 5);
      
      // User2 should not be able to access user1's data
      const response = await makeRequest('GET', `/api/notifications/history`, {}, {
        Authorization: `Bearer ${user2.token}`
      });
      expect(response.status).toBe(200);
      
      const history = await response.json();
      expect(history.notifications.length).toBe(0); // Should not see user1's notifications
    });
    
    it('should prevent unauthorized preference modifications', async () => {
      const user1 = await createAuthenticatedUser();
      const user2 = await createAuthenticatedUser();
      
      // Create subscription for user1
      await createPlayerSubscription(user1.id, 'testplayer');
      
      // User2 should not be able to modify user1's preferences
      const response = await makeRequest('POST', '/api/notifications/preferences', {
        playerUsername: 'testplayer',
        notificationsEnabled: false
      }, { Authorization: `Bearer ${user2.token}` });
      
      // Should succeed (user2 creates their own preference)
      expect(response.status).toBe(201);
      
      // Verify user1's preferences are unchanged
      const user1Prefs = await getNotificationPreferences(user1.id, 'testplayer');
      expect(user1Prefs.notificationsEnabled).toBe(true);
    });
  });
});
```

---

### Task 4: Performance Optimization (10 hours)

#### 4.1 Database Query Optimization (4 hours)
**Objective**: Optimize database queries for production performance

**Files**: 
- `src/services/optimizedQueries.ts`
- `tests/performance/query-optimization.test.ts`

**Implementation Details**:
```typescript
// Optimized database queries
export class OptimizedNotificationQueries {
  /**
   * Batch get subscribers for multiple players
   * Optimized to reduce database round trips
   */
  static async getBatchSubscribers(
    db: D1Database,
    playerUsernames: string[]
  ): Promise<Map<string, number[]>> {
    const placeholders = playerUsernames.map(() => '?').join(',');
    
    const query = `
      SELECT ps.chess_com_username, ps.user_id
      FROM player_subscriptions ps
      JOIN user_preferences up ON ps.user_id = up.user_id
      WHERE ps.chess_com_username IN (${placeholders})
        AND ps.notifications_enabled = 1
        AND up.notifications_enabled = 1
        AND ps.deleted_at IS NULL
    `;
    
    const result = await db.prepare(query).bind(...playerUsernames).all();
    
    const subscriberMap = new Map<string, number[]>();
    
    for (const row of result.results || []) {
      const username = row.chess_com_username as string;
      const userId = row.user_id as number;
      
      if (!subscriberMap.has(username)) {
        subscriberMap.set(username, []);
      }
      subscriberMap.get(username)!.push(userId);
    }
    
    return subscriberMap;
  }
  
  /**
   * Batch cooldown check for multiple user-player pairs
   * Optimized with single query instead of multiple
   */
  static async batchCheckCooldown(
    db: D1Database,
    userPlayerPairs: Array<{ userId: number; playerUsername: string }>,
    cooldownMinutes: number = 60
  ): Promise<Map<string, boolean>> {
    const cutoffTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
    
    // Build dynamic query for multiple pairs
    const conditions = userPlayerPairs.map(() => '(user_id = ? AND player_username = ?)').join(' OR ');
    const params = userPlayerPairs.flatMap(pair => [pair.userId, pair.playerUsername]);
    
    const query = `
      SELECT user_id, player_username, COUNT(*) as count
      FROM notification_log
      WHERE (${conditions}) AND sent_at > ?
      GROUP BY user_id, player_username
    `;
    
    const result = await db.prepare(query).bind(...params, cutoffTime).all();
    
    const cooldownMap = new Map<string, boolean>();
    
    // Initialize all pairs as allowed
    for (const pair of userPlayerPairs) {
      const key = `${pair.userId}:${pair.playerUsername}`;
      cooldownMap.set(key, true);
    }
    
    // Mark pairs with recent notifications as blocked
    for (const row of result.results || []) {
      const key = `${row.user_id}:${row.player_username}`;
      cooldownMap.set(key, false);
    }
    
    return cooldownMap;
  }
  
  /**
   * Optimized notification history with pagination
   */
  static async getNotificationHistory(
    db: D1Database,
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ notifications: NotificationLog[]; total: number }> {
    // Get total count and paginated results in parallel
    const [countResult, notificationsResult] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM notification_log WHERE user_id = ?')
        .bind(userId).first(),
      db.prepare(`
        SELECT nl.*, ps.chess_com_username as player_display_name
        FROM notification_log nl
        LEFT JOIN player_subscriptions ps ON nl.user_id = ps.user_id 
          AND nl.player_username = ps.chess_com_username
        WHERE nl.user_id = ?
        ORDER BY nl.sent_at DESC
        LIMIT ? OFFSET ?
      `).bind(userId, limit, offset).all()
    ]);
    
    const total = countResult?.count as number || 0;
    const notifications = notificationsResult.results?.map(row => ({
      id: row.id as string,
      userId: row.user_id as number,
      playerUsername: row.player_username as string,
      notificationType: row.notification_type as string,
      gameDetails: JSON.parse(row.game_details as string || 'null'),
      sentAt: row.sent_at as string,
      deliveredAt: row.delivered_at as string,
      failedAt: row.failed_at as string,
      failureReason: row.failure_reason as string,
      playerDisplayName: row.player_display_name as string
    })) || [];
    
    return { notifications, total };
  }
  
  /**
   * Optimized batch notification creation
   */
  static async batchCreateNotifications(
    db: D1Database,
    notifications: Array<{
      userId: number;
      playerUsername: string;
      notificationType: string;
      gameDetails?: any;
    }>
  ): Promise<void> {
    if (notifications.length === 0) return;
    
    // Use batch insert for better performance
    const values = notifications.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
    const params = notifications.flatMap(notification => [
      generateSecureId(),
      notification.userId,
      notification.playerUsername,
      notification.notificationType,
      JSON.stringify(notification.gameDetails || null),
      new Date().toISOString()
    ]);
    
    await db.prepare(`
      INSERT INTO notification_log (
        id, user_id, player_username, notification_type, game_details, sent_at
      ) VALUES ${values}
    `).bind(...params).run();
  }
}
```

#### 4.2 Memory and Resource Optimization (3 hours)
**Objective**: Optimize memory usage and resource consumption

**Files**: 
- `src/services/resourceOptimization.ts`
- `tests/performance/memory-usage.test.ts`

**Implementation Details**:
```typescript
// Resource optimization utilities
export class ResourceOptimizer {
  /**
   * Streaming processor for large datasets
   * Processes data in chunks to avoid memory issues
   */
  static async processLargeDataset<T, R>(
    data: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    chunkSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
      
      // Allow garbage collection between chunks
      if (i % (chunkSize * 10) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }
  
  /**
   * Memory-efficient batch processing
   */
  static async processBatchWithMemoryLimit<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    concurrency: number = 10,
    memoryCheckInterval: number = 100
  ): Promise<void> {
    const semaphore = new Semaphore(concurrency);
    let processedCount = 0;
    
    const promises = items.map(async (item) => {
      await semaphore.acquire();
      
      try {
        await processor(item);
        processedCount++;
        
        // Check memory usage periodically
        if (processedCount % memoryCheckInterval === 0) {
          const memoryUsage = await getMemoryUsage();
          if (memoryUsage > 400) { // 400MB threshold
            console.warn(`High memory usage: ${memoryUsage}MB`);
            await waitForGarbageCollection();
          }
        }
      } finally {
        semaphore.release();
      }
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Connection pool optimization
   */
  static createOptimizedDatabasePool(maxConnections: number = 5) {
    return new DatabaseConnectionPool({
      maxConnections,
      idleTimeout: 30000, // 30 seconds
      connectionTimeout: 5000, // 5 seconds
      retryAttempts: 3,
      retryDelay: 1000
    });
  }
}

// Memory monitoring utilities
export class MemoryMonitor {
  private static samples: number[] = [];
  private static maxSamples: number = 100;
  
  static async recordMemoryUsage(): Promise<void> {
    const usage = await getMemoryUsage();
    
    this.samples.push(usage);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }
  
  static getMemoryStats(): { current: number; average: number; peak: number } {
    if (this.samples.length === 0) return { current: 0, average: 0, peak: 0 };
    
    const current = this.samples[this.samples.length - 1];
    const average = this.samples.reduce((sum, val) => sum + val, 0) / this.samples.length;
    const peak = Math.max(...this.samples);
    
    return { current, average, peak };
  }
  
  static async waitForGarbageCollection(): Promise<void> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Wait for a tick
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

#### 4.3 Caching Strategy Implementation (3 hours)
**Objective**: Implement efficient caching for frequently accessed data

**Files**: 
- `src/services/caching.ts`
- `tests/performance/caching.test.ts`

**Implementation Details**:
```typescript
// Caching implementation
export class NotificationCache {
  private static cache = new Map<string, CacheEntry>();
  private static maxSize = 1000;
  private static defaultTTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Cache player status to reduce API calls
   */
  static async cachePlayerStatus(
    username: string,
    status: ChessComGameStatus,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const key = `player_status:${username}`;
    const entry: CacheEntry = {
      value: status,
      timestamp: Date.now(),
      ttl
    };
    
    this.cache.set(key, entry);
    await this.cleanupExpiredEntries();
  }
  
  /**
   * Get cached player status
   */
  static getCachedPlayerStatus(username: string): ChessComGameStatus | null {
    const key = `player_status:${username}`;
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as ChessComGameStatus;
  }
  
  /**
   * Cache notification preferences
   */
  static async cacheNotificationPreferences(
    userId: number,
    playerUsername: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    const key = `notification_prefs:${userId}:${playerUsername}`;
    const entry: CacheEntry = {
      value: preferences,
      timestamp: Date.now(),
      ttl: this.defaultTTL
    };
    
    this.cache.set(key, entry);
  }
  
  /**
   * Get cached notification preferences
   */
  static getCachedNotificationPreferences(
    userId: number,
    playerUsername: string
  ): NotificationPreferences | null {
    const key = `notification_prefs:${userId}:${playerUsername}`;
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as NotificationPreferences;
  }
  
  /**
   * Cache cooldown status
   */
  static async cacheCooldownStatus(
    userId: number,
    playerUsername: string,
    isInCooldown: boolean
  ): Promise<void> {
    const key = `cooldown:${userId}:${playerUsername}`;
    const entry: CacheEntry = {
      value: isInCooldown,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000 // 5 minutes
    };
    
    this.cache.set(key, entry);
  }
  
  /**
   * Get cached cooldown status
   */
  static getCachedCooldownStatus(userId: number, playerUsername: string): boolean | null {
    const key = `cooldown:${userId}:${playerUsername}`;
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as boolean;
  }
  
  /**
   * Clear cache for user (when preferences change)
   */
  static clearUserCache(userId: number): void {
    const keysToDelete = [];
    
    for (const [key] of this.cache) {
      if (key.includes(`:${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
  
  /**
   * Cleanup expired entries
   */
  private static async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    // If cache is too large, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }
}

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
}
```

---

### Task 5: Production Readiness & Monitoring (8 hours)

#### 5.1 Monitoring and Alerting Implementation (4 hours)
**Objective**: Implement comprehensive monitoring and alerting

**Files**: 
- `src/services/monitoring.ts`
- `src/services/alerting.ts`

**Implementation Details**:
```typescript
// Monitoring implementation
export class NotificationMonitoring {
  /**
   * Track notification metrics
   */
  static async recordNotificationMetrics(
    type: 'sent' | 'failed' | 'delivered' | 'bounced',
    metadata?: any
  ): Promise<void> {
    const metrics = {
      type,
      timestamp: Date.now(),
      metadata: metadata || {}
    };
    
    // Store in database for analysis
    await this.storeMetrics(metrics);
    
    // Send to external monitoring if configured
    if (process.env.MONITORING_WEBHOOK) {
      await this.sendToExternalMonitoring(metrics);
    }
  }
  
  /**
   * Get notification statistics
   */
  static async getNotificationStats(
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<NotificationStats> {
    const timeRangeMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };
    
    const since = new Date(Date.now() - timeRangeMs[timeRange]);
    
    const stats = await this.queryNotificationStats(since);
    
    return {
      totalSent: stats.sent || 0,
      totalFailed: stats.failed || 0,
      totalDelivered: stats.delivered || 0,
      deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
      failureRate: stats.sent > 0 ? (stats.failed / stats.sent) * 100 : 0,
      timeRange
    };
  }
  
  /**
   * Monitor system health
   */
  static async checkSystemHealth(): Promise<SystemHealth> {
    const [
      databaseHealth,
      apiHealth,
      queueHealth,
      memoryUsage
    ] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkChessComApiHealth(),
      this.checkNotificationQueueHealth(),
      this.getMemoryUsage()
    ]);
    
    return {
      database: databaseHealth,
      chessComApi: apiHealth,
      notificationQueue: queueHealth,
      memory: memoryUsage,
      timestamp: Date.now(),
      status: this.calculateOverallHealth([databaseHealth, apiHealth, queueHealth])
    };
  }
  
  /**
   * Check for alert conditions
   */
  static async checkAlertConditions(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    // Check failure rate
    const stats = await this.getNotificationStats('hour');
    if (stats.failureRate > 10) {
      alerts.push({
        type: 'HIGH_FAILURE_RATE',
        severity: 'critical',
        message: `Notification failure rate is ${stats.failureRate.toFixed(1)}%`,
        timestamp: Date.now()
      });
    }
    
    // Check queue backlog
    const queueSize = await this.getNotificationQueueSize();
    if (queueSize > 100) {
      alerts.push({
        type: 'QUEUE_BACKLOG',
        severity: 'warning',
        message: `Notification queue has ${queueSize} pending items`,
        timestamp: Date.now()
      });
    }
    
    // Check API health
    const apiHealth = await this.checkChessComApiHealth();
    if (apiHealth.status !== 'healthy') {
      alerts.push({
        type: 'API_HEALTH',
        severity: 'critical',
        message: `Chess.com API is ${apiHealth.status}`,
        timestamp: Date.now()
      });
    }
    
    return alerts;
  }
}

// Alerting implementation
export class AlertingService {
  /**
   * Send alert notifications
   */
  static async sendAlert(alert: Alert): Promise<void> {
    // Log alert
    console.error(`ALERT [${alert.severity}]: ${alert.message}`);
    
    // Send to external alerting service
    if (process.env.ALERT_WEBHOOK) {
      await this.sendWebhookAlert(alert);
    }
    
    // Send email alert for critical issues
    if (alert.severity === 'critical' && process.env.ALERT_EMAIL) {
      await this.sendEmailAlert(alert);
    }
  }
  
  /**
   * Check and send alerts
   */
  static async processAlerts(): Promise<void> {
    const alerts = await NotificationMonitoring.checkAlertConditions();
    
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }
}
```

#### 5.2 Deployment Configuration (2 hours)
**Objective**: Prepare production deployment configuration

**Files**: 
- `wrangler.toml`
- `src/config/production.ts`

**Implementation Details**:
```toml
# Production wrangler.toml configuration
name = "chesscom-helper-notifications"
main = "src/index.ts"
compatibility_date = "2023-05-18"

# Environment variables
[env.production]
name = "chesscom-helper-notifications"
routes = [
  { pattern = "api.chesscomhelper.com/*", zone_name = "chesscomhelper.com" }
]

# Database configuration
[[env.production.d1_databases]]
binding = "DB"
database_name = "chesscom-helper-prod"
database_id = "your-d1-database-id"

# Cron triggers for production
[[env.production.triggers]]
crons = [
  "*/5 * * * *",  # Every 5 minutes - monitoring
  "*/2 * * * *",  # Every 2 minutes - notification queue
  "0 */6 * * *"   # Every 6 hours - cleanup
]

# Environment variables (set via wrangler secret)
[env.production.vars]
CHESS_COM_API_URL = "https://api.chess.com/pub"
ENVIRONMENT = "production"
NOTIFICATION_COOLDOWN_MINUTES = "60"
MAX_BATCH_SIZE = "10"
RATE_LIMIT_PER_MINUTE = "300"
LOG_LEVEL = "info"

# Secrets (set via wrangler secret put)
# RESEND_API_KEY
# JWT_SECRET
# ALERT_WEBHOOK
# ALERT_EMAIL
```

```typescript
// Production configuration
export const ProductionConfig = {
  // API Configuration
  chessComApi: {
    baseUrl: 'https://api.chess.com/pub',
    rateLimit: {
      requestsPerMinute: 300,
      burstLimit: 50,
      backoffMultiplier: 1.5
    },
    timeout: 10000,
    retries: 3
  },
  
  // Notification Configuration
  notifications: {
    cooldownMinutes: 60,
    maxBatchSize: 10,
    queueProcessingLimit: 50,
    retryAttempts: 3,
    retryDelayMs: 1000
  },
  
  // Database Configuration
  database: {
    maxConnections: 5,
    connectionTimeout: 5000,
    queryTimeout: 10000
  },
  
  // Monitoring Configuration
  monitoring: {
    metricsRetentionDays: 30,
    healthCheckInterval: 60000, // 1 minute
    alertThresholds: {
      failureRate: 10, // 10%
      queueSize: 100,
      responseTime: 5000, // 5 seconds
      memoryUsage: 400 // 400MB
    }
  },
  
  // Security Configuration
  security: {
    jwtExpirationHours: 24,
    bcryptRounds: 12,
    rateLimitRequests: 100,
    rateLimitWindowMs: 60000
  },
  
  // Email Configuration
  email: {
    from: 'Chess.com Helper <notifications@chesscomhelper.com>',
    replyTo: 'support@chesscomhelper.com',
    templates: {
      gameStart: 'game_start_notification',
      unsubscribe: 'unsubscribe_confirmation'
    }
  }
};
```

#### 5.3 Documentation and Runbooks (2 hours)
**Objective**: Create comprehensive documentation and operational runbooks

**Files**: 
- `docs/deployment-guide.md`
- `docs/monitoring-runbook.md`
- `docs/troubleshooting-guide.md`

**Implementation Details**:
```markdown
# Production Deployment Guide

## Pre-Deployment Checklist

### Environment Setup
- [ ] Wrangler CLI installed and configured
- [ ] Production D1 database created
- [ ] Environment variables configured
- [ ] Secrets stored securely
- [ ] DNS records configured

### Testing
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Load tests completed
- [ ] Security tests passed
- [ ] Performance benchmarks met

### Monitoring
- [ ] Monitoring dashboard configured
- [ ] Alert webhooks tested
- [ ] Log aggregation configured
- [ ] Health check endpoints verified

## Deployment Steps

### 1. Database Migration
```bash
# Apply database migrations
wrangler d1 migrations apply --env production

# Verify migration success
wrangler d1 execute --env production --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### 2. Application Deployment
```bash
# Deploy application
wrangler deploy --env production

# Verify deployment
curl -f https://api.chesscomhelper.com/health
```

### 3. Post-Deployment Verification
```bash
# Check cron triggers
wrangler tail --env production

# Monitor logs
wrangler tail --env production --format pretty
```

## Rollback Procedure

### 1. Quick Rollback
```bash
# Rollback to previous deployment
wrangler rollback --env production

# Verify rollback
curl -f https://api.chesscomhelper.com/health
```

### 2. Database Rollback (if needed)
```bash
# Rollback database migration
wrangler d1 migrations rollback --env production
```

## Monitoring and Alerting

### Key Metrics to Monitor
- Notification delivery rate
- API response times
- Database query performance
- Memory usage
- Error rates

### Alert Thresholds
- Failure rate > 10%
- Queue size > 100 items
- Response time > 5 seconds
- Memory usage > 400MB

### Health Check Endpoints
- `/health` - Basic health check
- `/health/detailed` - Detailed system health
- `/metrics` - Prometheus metrics

## Troubleshooting

### Common Issues

#### High Failure Rate
1. Check email service status
2. Verify API credentials
3. Review error logs
4. Check rate limiting

#### Queue Backlog
1. Scale notification processing
2. Check database performance
3. Review API rate limits
4. Analyze error patterns

#### Database Issues
1. Check connection pool
2. Review query performance
3. Verify migrations
4. Check disk space

### Emergency Contacts
- On-call engineer: [contact info]
- Database admin: [contact info]
- Infrastructure team: [contact info]
```

---

### Task 6: Final Testing and Validation (6 hours)

#### 6.1 Production Simulation Testing (3 hours)
**Objective**: Test the complete system in production-like conditions

**Files**: 
- `tests/production/simulation.test.ts`
- `tests/production/end-to-end.test.ts`

**Implementation Details**:
```typescript
// Production simulation testing
describe('Production Simulation Tests', () => {
  describe('Complete System Test', () => {
    it('should handle realistic production load', async () => {
      // Simulate realistic production scenario
      const users = 1000;
      const playersPerUser = 3;
      const activePlayerPercentage = 0.1; // 10% of players are active
      
      console.log('Setting up production simulation...');
      
      // Setup test environment
      await setupProductionSimulation(users, playersPerUser);
      
      // Simulate player activity
      const activeUsers = Math.floor(users * activePlayerPercentage);
      await simulateRealisticPlayerActivity(activeUsers);
      
      // Run full monitoring cycle
      const results = await runFullMonitoringCycle();
      
      // Verify results
      expect(results.playersChecked).toBeGreaterThan(0);
      expect(results.notificationsSent).toBeGreaterThan(0);
      expect(results.errors.length).toBeLessThan(results.playersChecked * 0.05); // <5% error rate
      expect(results.duration).toBeLessThan(300000); // Under 5 minutes
      
      console.log('Production simulation results:', results);
    });
    
    it('should maintain performance under sustained load', async () => {
      const duration = 30 * 60 * 1000; // 30 minutes
      const checkInterval = 5 * 60 * 1000; // 5 minutes
      
      console.log('Starting sustained load test...');
      
      const startTime = Date.now();
      const results = [];
      
      while (Date.now() - startTime < duration) {
        const cycleStart = Date.now();
        
        // Run monitoring cycle
        const result = await runMonitoringCycle();
        results.push(result);
        
        // Check performance degradation
        const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
        const lastFiveAverage = results.slice(-5).reduce((sum, r) => sum + r.duration, 0) / Math.min(5, results.length);
        
        // Alert if performance is degrading
        if (lastFiveAverage > averageTime * 1.5) {
          console.warn('Performance degradation detected');
        }
        
        // Wait until next cycle
        const cycleTime = Date.now() - cycleStart;
        const waitTime = Math.max(0, checkInterval - cycleTime);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Verify sustained performance
      const finalAverage = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(finalAverage).toBeLessThan(60000); // Under 1 minute average
      
      console.log(`Sustained load test completed: ${results.length} cycles, ${finalAverage}ms average`);
    });
  });
  
  describe('Real-world Scenario Tests', () => {
    it('should handle tournament notification spike', async () => {
      // Simulate tournament scenario with many players starting games simultaneously
      const tournamentPlayers = 50;
      const subscribersPerPlayer = 20;
      
      console.log('Simulating tournament notification spike...');
      
      // Setup tournament scenario
      await setupTournamentScenario(tournamentPlayers, subscribersPerPlayer);
      
      // Simulate all players starting games at once
      const startTime = Date.now();
      await simulateSimultaneousGameStarts(tournamentPlayers);
      
      // Process notifications
      const results = await processNotificationSpike();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify spike handling
      const expectedNotifications = tournamentPlayers * subscribersPerPlayer;
      expect(results.notificationsSent).toBeGreaterThan(expectedNotifications * 0.9); // 90% success rate
      expect(duration).toBeLessThan(600000); // Under 10 minutes
      
      console.log(`Tournament spike handled: ${results.notificationsSent} notifications in ${duration}ms`);
    });
  });
});
```

#### 6.2 Security Validation (2 hours)
**Objective**: Final security validation and penetration testing

**Files**: 
- `tests/security/penetration.test.ts`
- `tests/security/security-scan.test.ts`

**Implementation Details**:
```typescript
// Security validation tests
describe('Security Validation', () => {
  describe('Penetration Testing', () => {
    it('should resist common attack vectors', async () => {
      const attackVectors = [
        {
          name: 'SQL Injection',
          test: async () => {
            const maliciousInputs = [
              "'; DROP TABLE users; --",
              "' OR '1'='1",
              "admin'--",
              "' UNION SELECT * FROM users--"
            ];
            
            for (const input of maliciousInputs) {
              const response = await makeRequest('POST', '/api/notifications/preferences', {
                playerUsername: input,
                notificationsEnabled: true
              });
              
              // Should not execute malicious SQL
              expect(response.status).not.toBe(500);
            }
          }
        },
        {
          name: 'XSS Prevention',
          test: async () => {
            const xssPayloads = [
              '<script>alert("xss")</script>',
              'javascript:alert("xss")',
              '<img src=x onerror=alert("xss")>',
              '<svg onload=alert("xss")>'
            ];
            
            for (const payload of xssPayloads) {
              const response = await makeRequest('POST', '/api/players', {
                username: payload
              });
              
              // Should sanitize input
              if (response.status === 200) {
                const body = await response.json();
                expect(body.username).not.toContain('<script>');
                expect(body.username).not.toContain('javascript:');
              }
            }
          }
        },
        {
          name: 'CSRF Protection',
          test: async () => {
            // Attempt request without proper authentication
            const response = await makeRequest('POST', '/api/notifications/preferences', {
              playerUsername: 'testplayer',
              notificationsEnabled: false
            });
            
            expect(response.status).toBe(401);
          }
        }
      ];
      
      for (const vector of attackVectors) {
        console.log(`Testing ${vector.name}...`);
        await vector.test();
      }
    });
    
    it('should enforce rate limiting', async () => {
      const rapidRequests = 150; // Above rate limit
      const promises = [];
      
      for (let i = 0; i < rapidRequests; i++) {
        promises.push(makeRequest('GET', '/api/notifications/preferences'));
      }
      
      const results = await Promise.all(promises);
      
      // Should rate limit after threshold
      const rateLimitedCount = results.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });
  
  describe('Data Protection Validation', () => {
    it('should encrypt sensitive data', async () => {
      const testUser = await createTestUser();
      
      // Verify password is hashed
      const storedUser = await getUserFromDatabase(testUser.id);
      expect(storedUser.password).not.toBe(testUser.password);
      expect(storedUser.password).toMatch(/^\$2[aby]\$\d+\$.{53}$/); // bcrypt pattern
      
      // Verify email is not stored in plain text in logs
      const logs = await getApplicationLogs();
      logs.forEach(log => {
        expect(log.message).not.toContain(testUser.email);
      });
    });
  });
});
```

#### 6.3 Performance Validation (1 hour)
**Objective**: Final performance validation and benchmarking

**Files**: 
- `tests/performance/final-validation.test.ts`

**Implementation Details**:
```typescript
// Final performance validation
describe('Performance Validation', () => {
  describe('Performance Benchmarks', () => {
    it('should meet all performance SLAs', async () => {
      const benchmarks = [
        {
          name: 'Notification Delivery Time',
          test: async () => {
            const testUser = await createTestUser();
            const testPlayer = 'testplayer';
            
            await setupUserAndPlayer(testUser, testPlayer);
            
            const startTime = Date.now();
            await simulatePlayerGameStart(testPlayer);
            await waitForNotificationDelivery(testUser.id, testPlayer);
            const endTime = Date.now();
            
            const deliveryTime = endTime - startTime;
            expect(deliveryTime).toBeLessThan(300000); // Under 5 minutes
            
            return deliveryTime;
          }
        },
        {
          name: 'API Response Time',
          test: async () => {
            const testUser = await createAuthenticatedUser();
            
            const startTime = Date.now();
            const response = await makeRequest('GET', '/api/notifications/preferences', {}, {
              Authorization: `Bearer ${testUser.token}`
            });
            const endTime = Date.now();
            
            const responseTime = endTime - startTime;
            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(2000); // Under 2 seconds
            
            return responseTime;
          }
        },
        {
          name: 'Database Query Performance',
          test: async () => {
            const testUser = await createTestUser();
            
            const startTime = Date.now();
            await getNotificationHistory(testUser.id, 50);
            const endTime = Date.now();
            
            const queryTime = endTime - startTime;
            expect(queryTime).toBeLessThan(1000); // Under 1 second
            
            return queryTime;
          }
        }
      ];
      
      const results = {};
      
      for (const benchmark of benchmarks) {
        console.log(`Running ${benchmark.name} benchmark...`);
        const result = await benchmark.test();
        results[benchmark.name] = result;
        console.log(`${benchmark.name}: ${result}ms`);
      }
      
      console.log('Performance benchmark results:', results);
    });
  });
});
```

---

## 📊 Success Criteria & Acceptance Tests

### Technical Acceptance Criteria
- [ ] **End-to-End Testing**: 100% of critical user journeys tested and passing
- [ ] **Load Testing**: System handles 10,000+ users and 50,000+ daily emails
- [ ] **Performance**: 99% of operations complete within SLA times
- [ ] **Security**: All security tests pass with zero critical vulnerabilities
- [ ] **Reliability**: 99.5% uptime demonstrated in testing
- [ ] **Scalability**: System scales gracefully under load
- [ ] **Monitoring**: Full observability with alerting configured

### Quality Gates
- [ ] **Code Coverage**: >90% for all new code
- [ ] **Test Coverage**: All critical paths tested
- [ ] **Performance Benchmarks**: All SLAs met
- [ ] **Security Scan**: Zero critical or high-severity issues
- [ ] **Documentation**: Complete technical and operational documentation
- [ ] **Deployment**: Automated deployment pipeline working
- [ ] **Monitoring**: All alerts configured and tested

### Production Readiness Checklist
- [ ] **Environment Configuration**: Production environment fully configured
- [ ] **Database**: Production database migrated and optimized
- [ ] **Monitoring**: Full monitoring and alerting implemented
- [ ] **Security**: All security measures implemented and tested
- [ ] **Performance**: System optimized for production load
- [ ] **Documentation**: Complete deployment and troubleshooting guides
- [ ] **Backup & Recovery**: Backup and recovery procedures tested
- [ ] **Rollback Plan**: Rollback procedures documented and tested

---

## 🔧 Tools and Technologies

### Testing Frameworks
- **Vitest**: Unit and integration testing
- **Artillery**: Load testing
- **OWASP ZAP**: Security testing
- **Lighthouse**: Performance testing

### Monitoring Tools
- **Cloudflare Analytics**: Built-in monitoring
- **Custom Metrics**: Application-specific metrics
- **Webhook Alerts**: Real-time alerting
- **Log Aggregation**: Centralized logging

### Performance Tools
- **Chrome DevTools**: Performance profiling
- **Memory Profilers**: Memory usage analysis
- **Database Profilers**: Query performance analysis
- **APM Tools**: Application performance monitoring

---

## 📈 Performance Benchmarks

### Load Testing Targets
- **Concurrent Users**: 1,000+ simultaneous users
- **Daily Notifications**: 50,000+ emails per day
- **API Throughput**: 1,000+ requests per minute
- **Database Operations**: 10,000+ queries per minute

### Performance SLAs
- **Notification Delivery**: <5 minutes from game start
- **API Response Time**: <2 seconds for 95% of requests
- **Database Queries**: <1 second for 99% of queries
- **Memory Usage**: <512MB peak usage
- **CPU Usage**: <80% average usage

### Reliability Targets
- **Uptime**: 99.5% availability
- **Error Rate**: <1% for all operations
- **Data Loss**: Zero notification loss
- **Recovery Time**: <5 minutes from failure

---

## 🚀 Deployment Strategy

### Pre-Production Testing
1. **Staging Environment**: Complete system testing
2. **Performance Testing**: Load and stress testing
3. **Security Testing**: Penetration testing
4. **Integration Testing**: End-to-end validation

### Production Deployment
1. **Blue-Green Deployment**: Zero-downtime deployment
2. **Canary Release**: Gradual rollout to users
3. **Feature Flags**: Controlled feature enablement
4. **Monitoring**: Real-time health monitoring

### Post-Deployment
1. **Health Checks**: Automated health verification
2. **Performance Monitoring**: Real-time performance tracking
3. **Error Monitoring**: Immediate error detection
4. **User Feedback**: User experience monitoring

---

## 📚 Documentation Requirements

### Technical Documentation
- **API Documentation**: Complete API specification
- **Architecture Documentation**: System architecture overview
- **Database Documentation**: Schema and query documentation
- **Security Documentation**: Security measures and procedures

### Operational Documentation
- **Deployment Guide**: Step-by-step deployment procedures
- **Monitoring Runbook**: Monitoring and alerting procedures
- **Troubleshooting Guide**: Common issues and solutions
- **Emergency Procedures**: Incident response procedures

### User Documentation
- **Feature Guide**: User-facing feature documentation
- **FAQ**: Frequently asked questions
- **Privacy Policy**: Data handling and privacy information
- **Terms of Service**: Service terms and conditions

---

This comprehensive Phase 5 implementation plan provides complete coverage of testing, optimization, and production readiness requirements. The plan ensures the email notifications system is thoroughly validated, optimized for production performance, and ready for deployment with full monitoring and operational support.
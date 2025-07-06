# Phase 2: Monitoring Integration Implementation Plan
## Email Notifications System - Detailed Technical Implementation

**Version**: 1.0  
**Date**: 2025-07-06  
**Phase**: 2 of 5 (Days 4-6)  
**Target Audience**: Claude AI Agents  
**Estimated Duration**: 3 days  

---

## 🎯 Phase Overview

Phase 2 focuses on integrating the notification system with the existing player monitoring infrastructure. This phase builds upon the foundation infrastructure from Phase 1 and establishes the core notification trigger mechanisms that detect when players start new games.

### Key Objectives
1. **Enhanced Status Detection**: Upgrade monitoring to detect game start/end events
2. **Chess.com API Integration**: Implement robust API handling with rate limiting  
3. **Notification Triggers**: Connect status changes to notification system
4. **Job System Integration**: Extend background processing for notifications
5. **Error Handling**: Comprehensive error recovery and retry mechanisms

---

## 📋 Detailed Task Breakdown

### Task 1: Enhanced Status Detection (8 hours)

#### 1.1 Player Status Change Detection Logic (3 hours)
**Objective**: Implement logic to detect when players transition between playing states

**File**: `src/services/monitoringService.ts`

**Implementation Details**:
```typescript
// Add new interfaces for status change detection
export interface PlayerStatusChange {
  username: string;
  previousStatus: PlayerStatus | null;
  currentStatus: PlayerStatus;
  changeType: 'game_start' | 'game_end' | 'status_change';
  timestamp: Date;
  gameDetails?: ChessComGame;
}

export interface StatusChangeResult {
  changes: PlayerStatusChange[];
  errors: string[];
  playersChecked: number;
}

// New method to detect and categorize status changes
export async function detectPlayerStatusChanges(
  db: D1Database, 
  playerStatuses: ChessComGameStatus[]
): Promise<StatusChangeResult> {
  const changes: PlayerStatusChange[] = [];
  const errors: string[] = [];
  let playersChecked = 0;

  for (const currentStatus of playerStatuses) {
    try {
      const previousStatus = await getPlayerStatus(db, currentStatus.username);
      
      // Detect game start event
      if (!previousStatus?.isPlaying && currentStatus.isPlaying) {
        changes.push({
          username: currentStatus.username,
          previousStatus,
          currentStatus: mapToPlayerStatus(currentStatus),
          changeType: 'game_start',
          timestamp: new Date(),
          gameDetails: currentStatus.currentGames[0]
        });
      }
      
      // Detect game end event
      if (previousStatus?.isPlaying && !currentStatus.isPlaying) {
        changes.push({
          username: currentStatus.username,
          previousStatus,
          currentStatus: mapToPlayerStatus(currentStatus),
          changeType: 'game_end',
          timestamp: new Date()
        });
      }
      
      playersChecked++;
    } catch (error) {
      errors.push(`Error checking ${currentStatus.username}: ${error}`);
    }
  }

  return { changes, errors, playersChecked };
}

// Helper function to map Chess.com API response to internal PlayerStatus
function mapToPlayerStatus(apiStatus: ChessComGameStatus): PlayerStatus {
  return {
    chessComUsername: apiStatus.username,
    isOnline: apiStatus.isOnline,
    isPlaying: apiStatus.isPlaying,
    currentGameUrl: apiStatus.currentGames[0]?.url || null,
    lastSeen: apiStatus.isOnline ? new Date().toISOString() : null,
    lastChecked: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
```

**Testing Requirements**:
- Unit tests for status change detection logic
- Test cases for all transition types (not playing → playing, playing → not playing)
- Edge cases: multiple games, API errors, missing previous status

#### 1.2 Game Details Extraction (2 hours)
**Objective**: Extract detailed game information from Chess.com API responses

**File**: `src/services/chessComService.ts`

**Implementation Details**:
```typescript
// Extend ChessComGame interface with additional details
export interface ExtendedChessComGame extends ChessComGame {
  gameType: 'rapid' | 'blitz' | 'bullet' | 'correspondence' | 'daily';
  opponent?: string;
  userColor?: 'white' | 'black';
  timeControlDisplay: string; // Human-readable format like "10+0"
}

// New method to get enhanced game details
export async function getEnhancedGameDetails(
  username: string, 
  gameUrl: string,
  baseUrl?: string
): Promise<ExtendedChessComGame | null> {
  try {
    const gameId = extractGameIdFromUrl(gameUrl);
    const apiUrl = baseUrl || CHESS_COM_BASE_URL;
    
    const response = await fetchWithTimeout(
      `${apiUrl}/game/${gameId}`,
      {
        method: 'GET',
        headers: { 'User-Agent': 'ChessComHelper/1.0' }
      },
      REQUEST_TIMEOUT
    );

    if (!response.ok) {
      return null;
    }

    const gameData = await response.json();
    
    return {
      ...gameData,
      gameType: classifyGameType(gameData.time_control),
      opponent: getOpponentName(gameData, username),
      userColor: getUserColor(gameData, username),
      timeControlDisplay: formatTimeControl(gameData.time_control)
    };
  } catch (error) {
    console.error('Error fetching enhanced game details:', error);
    return null;
  }
}

// Helper functions
function extractGameIdFromUrl(gameUrl: string): string {
  const match = gameUrl.match(/\/game\/(\d+)/);
  return match ? match[1] : '';
}

function classifyGameType(timeControl: string): 'rapid' | 'blitz' | 'bullet' | 'correspondence' | 'daily' {
  // Parse time control string and classify
  const seconds = parseTimeControl(timeControl);
  
  if (seconds < 180) return 'bullet';
  if (seconds < 600) return 'blitz';
  if (seconds < 1800) return 'rapid';
  return 'correspondence';
}

function parseTimeControl(timeControl: string): number {
  // Parse formats like "600+0", "300+3", "1/86400"
  if (timeControl.includes('+')) {
    const [base, increment] = timeControl.split('+').map(Number);
    return base + (increment * 40); // Estimate with 40 moves
  }
  
  if (timeControl.includes('/')) {
    const [moves, time] = timeControl.split('/').map(Number);
    return time / moves;
  }
  
  return parseInt(timeControl) || 0;
}

function formatTimeControl(timeControl: string): string {
  // Convert to human-readable format
  if (timeControl.includes('+')) {
    const [base, increment] = timeControl.split('+');
    return `${Math.floor(parseInt(base) / 60)}+${increment}`;
  }
  return timeControl;
}

function getOpponentName(gameData: any, username: string): string {
  const white = gameData.white?.username;
  const black = gameData.black?.username;
  
  if (white && white.toLowerCase() !== username.toLowerCase()) return white;
  if (black && black.toLowerCase() !== username.toLowerCase()) return black;
  
  return 'Unknown';
}

function getUserColor(gameData: any, username: string): 'white' | 'black' {
  const white = gameData.white?.username;
  return white && white.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
}
```

**Testing Requirements**:
- Test time control classification for all game types
- Test game detail extraction from various API responses
- Test error handling for invalid game URLs

#### 1.3 Status Change Auditing (3 hours)
**Objective**: Implement comprehensive logging for all status changes

**File**: `src/services/monitoringService.ts`

**Implementation Details**:
```typescript
// Add status change logging
export async function logStatusChange(
  db: D1Database,
  change: PlayerStatusChange
): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO status_change_log (
        id, chess_com_username, change_type, 
        previous_status, current_status, game_details,
        timestamp, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      await generateSecureId(),
      change.username,
      change.changeType,
      JSON.stringify(change.previousStatus),
      JSON.stringify(change.currentStatus),
      JSON.stringify(change.gameDetails),
      change.timestamp.toISOString(),
      now
    ).run();
  } catch (error) {
    console.error('Failed to log status change:', error);
    // Don't throw - logging shouldn't break the monitoring flow
  }
}

// Get recent status changes for debugging/analysis
export async function getRecentStatusChanges(
  db: D1Database,
  limit: number = 50
): Promise<PlayerStatusChange[]> {
  try {
    const result = await db.prepare(`
      SELECT chess_com_username, change_type, previous_status, 
             current_status, game_details, timestamp
      FROM status_change_log
      ORDER BY timestamp DESC
      LIMIT ?
    `).bind(limit).all();

    return result.results?.map(row => ({
      username: row.chess_com_username as string,
      changeType: row.change_type as 'game_start' | 'game_end' | 'status_change',
      previousStatus: JSON.parse(row.previous_status as string),
      currentStatus: JSON.parse(row.current_status as string),
      gameDetails: JSON.parse(row.game_details as string || 'null'),
      timestamp: new Date(row.timestamp as string)
    })) || [];
  } catch (error) {
    console.error('Failed to fetch recent status changes:', error);
    return [];
  }
}
```

**Database Schema Addition**:
```sql
-- Add to Phase 1 migration
CREATE TABLE status_change_log (
  id TEXT PRIMARY KEY,
  chess_com_username TEXT NOT NULL,
  change_type TEXT NOT NULL, -- 'game_start', 'game_end', 'status_change'
  previous_status TEXT, -- JSON of previous PlayerStatus
  current_status TEXT NOT NULL, -- JSON of current PlayerStatus
  game_details TEXT, -- JSON of game details if available
  timestamp DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_status_change_log_player_time 
ON status_change_log(chess_com_username, timestamp);

CREATE INDEX idx_status_change_log_type_time 
ON status_change_log(change_type, timestamp);
```

---

### Task 2: Chess.com API Integration Enhancements (10 hours)

#### 2.1 Rate Limiting Implementation (4 hours)
**Objective**: Implement sophisticated rate limiting to handle API constraints

**File**: `src/services/chessComService.ts`

**Implementation Details**:
```typescript
// Rate limiting configuration
interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  backoffMultiplier: number;
  maxRetries: number;
}

class ChessComRateLimiter {
  private requestTimes: number[] = [];
  private isThrottled: boolean = false;
  private throttleUntil: number = 0;
  
  constructor(private config: RateLimitConfig = {
    requestsPerMinute: 300, // Conservative limit
    burstLimit: 50,
    backoffMultiplier: 1.5,
    maxRetries: 3
  }) {}

  async throttle(): Promise<void> {
    const now = Date.now();
    
    // Check if we're in a throttle period
    if (this.isThrottled && now < this.throttleUntil) {
      const waitTime = this.throttleUntil - now;
      console.log(`Rate limited, waiting ${waitTime}ms`);
      await delay(waitTime);
      this.isThrottled = false;
    }
    
    // Clean old request times (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    
    // Check if we're approaching rate limit
    if (this.requestTimes.length >= this.config.requestsPerMinute) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = 60000 - (now - oldestRequest);
      await delay(waitTime);
    }
    
    // Check burst limit
    const recentRequests = this.requestTimes.filter(time => time > now - 10000); // Last 10 seconds
    if (recentRequests.length >= this.config.burstLimit) {
      await delay(10000); // Wait 10 seconds
    }
    
    this.requestTimes.push(now);
  }

  handleRateLimit(response: Response): void {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      
      this.isThrottled = true;
      this.throttleUntil = Date.now() + waitTime;
      
      console.log(`Rate limit hit, throttling for ${waitTime}ms`);
    }
  }
}

// Global rate limiter instance
const rateLimiter = new ChessComRateLimiter();

// Enhanced fetch with rate limiting
export async function fetchWithRateLimit(
  url: string, 
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  await rateLimiter.throttle();
  
  let retries = 0;
  const maxRetries = 3;
  
  while (retries <= maxRetries) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      
      if (response.status === 429) {
        rateLimiter.handleRateLimit(response);
        
        if (retries < maxRetries) {
          const backoffTime = Math.pow(2, retries) * 1000; // Exponential backoff
          console.log(`Rate limit retry ${retries + 1}, waiting ${backoffTime}ms`);
          await delay(backoffTime);
          retries++;
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (retries < maxRetries) {
        const backoffTime = Math.pow(2, retries) * 1000;
        console.log(`Request failed, retry ${retries + 1}, waiting ${backoffTime}ms`);
        await delay(backoffTime);
        retries++;
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Update all API calls to use rate limiting
export async function getPlayerInfoWithRateLimit(
  username: string, 
  baseUrl?: string
): Promise<ChessComPlayer | null> {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL;
  
  try {
    const response = await fetchWithRateLimit(`${apiUrl}/player/${username}`, {
      method: 'GET',
      headers: { 'User-Agent': 'ChessComHelper/1.0' }
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw createApiError(`Chess.com API error: ${response.status}`, 502, 'CHESS_COM_API_ERROR');
    }

    const data = await response.json();
    return mapPlayerData(data);
  } catch (error) {
    console.error('Get player info error:', error);
    throw createApiError('Failed to fetch player information', 502, 'CHESS_COM_API_ERROR', error);
  }
}
```

#### 2.2 Batch Processing Optimization (3 hours)
**Objective**: Optimize batch processing for large numbers of players

**File**: `src/services/chessComService.ts`

**Implementation Details**:
```typescript
// Optimized batch processing with adaptive batch sizes
export async function optimizedBatchGetPlayerStatuses(
  usernames: string[],
  baseUrl?: string
): Promise<ChessComGameStatus[]> {
  const results: ChessComGameStatus[] = [];
  const errors: string[] = [];
  
  // Adaptive batch sizing based on API performance
  let batchSize = 5; // Start conservative
  const maxBatchSize = 20;
  const minBatchSize = 1;
  
  // Track performance metrics
  let avgResponseTime = 0;
  let successRate = 100;
  
  const batches = chunkArray(usernames, batchSize);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchStartTime = Date.now();
    
    try {
      console.log(`Processing batch ${i + 1}/${batches.length}, size: ${batch.length}`);
      
      // Process batch with concurrent requests (limited concurrency)
      const batchResults = await processBatchConcurrently(batch, baseUrl);
      
      results.push(...batchResults.results);
      errors.push(...batchResults.errors);
      
      // Update performance metrics
      const batchTime = Date.now() - batchStartTime;
      avgResponseTime = (avgResponseTime + batchTime) / 2;
      successRate = (results.length / (results.length + errors.length)) * 100;
      
      // Adapt batch size based on performance
      if (successRate > 95 && avgResponseTime < 5000 && batchSize < maxBatchSize) {
        batchSize = Math.min(batchSize + 2, maxBatchSize);
      } else if (successRate < 80 || avgResponseTime > 10000) {
        batchSize = Math.max(batchSize - 1, minBatchSize);
      }
      
      console.log(`Batch completed: ${batchResults.results.length} success, ${batchResults.errors.length} errors`);
      console.log(`Performance: ${avgResponseTime}ms avg, ${successRate}% success rate`);
      
    } catch (error) {
      console.error(`Batch ${i + 1} failed:`, error);
      errors.push(`Batch ${i + 1} failed: ${error}`);
      
      // Reduce batch size on batch failure
      batchSize = Math.max(batchSize - 2, minBatchSize);
    }
    
    // Inter-batch delay to respect rate limits
    if (i < batches.length - 1) {
      await delay(1000);
    }
  }
  
  console.log(`Batch processing complete: ${results.length} players processed, ${errors.length} errors`);
  return results;
}

// Process batch with controlled concurrency
async function processBatchConcurrently(
  usernames: string[],
  baseUrl?: string,
  concurrency: number = 3
): Promise<{ results: ChessComGameStatus[], errors: string[] }> {
  const results: ChessComGameStatus[] = [];
  const errors: string[] = [];
  
  // Process with limited concurrency
  const semaphore = new Semaphore(concurrency);
  
  const promises = usernames.map(async (username) => {
    await semaphore.acquire();
    
    try {
      const status = await getPlayerGameStatus(username, baseUrl);
      results.push(status);
    } catch (error) {
      errors.push(`${username}: ${error}`);
      // Add fallback status for failed requests
      results.push({
        username,
        isOnline: false,
        isPlaying: false,
        currentGames: []
      });
    } finally {
      semaphore.release();
    }
  });
  
  await Promise.all(promises);
  return { results, errors };
}

// Simple semaphore for concurrency control
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      if (resolve) {
        this.permits--;
        resolve();
      }
    }
  }
}
```

#### 2.3 API Error Handling (3 hours)
**Objective**: Implement comprehensive error handling for API failures

**File**: `src/services/chessComService.ts`

**Implementation Details**:
```typescript
// Enhanced error handling types
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
  retryAfter?: number;
}

export class ChessComApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public retryable: boolean,
    public retryAfter?: number,
    message?: string
  ) {
    super(message || `Chess.com API error: ${code}`);
    this.name = 'ChessComApiError';
  }
}

// Error classification and handling
export function classifyApiError(response: Response): ChessComApiError {
  const statusCode = response.status;
  
  switch (statusCode) {
    case 429: // Rate Limited
      const retryAfter = response.headers.get('Retry-After');
      return new ChessComApiError(
        'RATE_LIMITED',
        429,
        true,
        retryAfter ? parseInt(retryAfter) * 1000 : 60000,
        'Rate limit exceeded'
      );
    
    case 404: // Not Found
      return new ChessComApiError(
        'PLAYER_NOT_FOUND',
        404,
        false,
        undefined,
        'Player not found'
      );
    
    case 502: // Bad Gateway
    case 503: // Service Unavailable
    case 504: // Gateway Timeout
      return new ChessComApiError(
        'SERVICE_UNAVAILABLE',
        statusCode,
        true,
        5000, // Retry after 5 seconds
        'Chess.com service temporarily unavailable'
      );
    
    case 500: // Internal Server Error
      return new ChessComApiError(
        'SERVER_ERROR',
        500,
        true,
        10000, // Retry after 10 seconds
        'Chess.com server error'
      );
    
    default:
      return new ChessComApiError(
        'UNKNOWN_ERROR',
        statusCode,
        false,
        undefined,
        `Unexpected API error: ${statusCode}`
      );
  }
}

// Retry logic with exponential backoff
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: ChessComApiError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error instanceof ChessComApiError) {
        lastError = error;
        
        // Don't retry non-retryable errors
        if (!error.retryable) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay (exponential backoff with jitter)
        const delay = error.retryAfter || (baseDelay * Math.pow(2, attempt));
        const jitter = Math.random() * 0.3 * delay; // Add up to 30% jitter
        const totalDelay = delay + jitter;
        
        console.log(`API call failed (attempt ${attempt + 1}), retrying in ${totalDelay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      } else {
        // Non-API errors are not retryable
        throw error;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Enhanced API call wrapper
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  fallbackValue?: T
): Promise<T | null> {
  try {
    return await retryApiCall(apiCall);
  } catch (error) {
    console.error('API call failed after retries:', error);
    
    // Return fallback value if provided
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    
    // For non-critical errors, return null instead of throwing
    if (error instanceof ChessComApiError && error.code === 'PLAYER_NOT_FOUND') {
      return null;
    }
    
    throw error;
  }
}
```

---

### Task 3: Notification Trigger Integration (8 hours)

#### 3.1 Notification Service Integration (4 hours)
**Objective**: Connect status changes to notification system

**File**: `src/services/notificationService.ts`

**Implementation Details**:
```typescript
// Add notification preferences checking
export async function shouldSendNotification(
  db: D1Database,
  userId: number,
  playerUsername: string,
  notificationType: 'game_start' | 'game_end' = 'game_start'
): Promise<boolean> {
  try {
    // Check global user preferences
    const globalPrefs = await getUserPreferences(db, userId);
    if (!globalPrefs?.notifications_enabled) {
      return false;
    }
    
    // Check per-player subscription preferences
    const subscription = await getPlayerSubscription(db, userId, playerUsername);
    if (!subscription?.notifications_enabled) {
      return false;
    }
    
    // Check cooldown period (1 hour per player)
    const cooldownPassed = await checkNotificationCooldown(db, userId, playerUsername);
    if (!cooldownPassed) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking notification eligibility:', error);
    return false; // Fail safe - don't send if we can't verify
  }
}

// Check notification cooldown
async function checkNotificationCooldown(
  db: D1Database,
  userId: number,
  playerUsername: string,
  cooldownMinutes: number = 60
): Promise<boolean> {
  try {
    const cutoffTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
    
    const result = await db.prepare(`
      SELECT COUNT(*) as count
      FROM notification_log
      WHERE user_id = ? AND player_username = ? AND sent_at > ?
    `).bind(userId, playerUsername, cutoffTime).first();
    
    return (result?.count as number || 0) === 0;
  } catch (error) {
    console.error('Error checking notification cooldown:', error);
    return false; // Fail safe
  }
}

// Queue notification for processing
export async function queueNotification(
  db: D1Database,
  notification: {
    userId: number;
    playerName: string;
    eventType: 'game_start' | 'game_end';
    gameUrl?: string;
    gameDetails?: ExtendedChessComGame;
  }
): Promise<void> {
  try {
    const notificationId = await generateSecureId();
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO notification_queue (
        id, user_id, player_username, notification_type,
        game_url, game_details, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      notificationId,
      notification.userId,
      notification.playerName,
      notification.eventType,
      notification.gameUrl || null,
      JSON.stringify(notification.gameDetails || null),
      now
    ).run();
    
    console.log(`Queued ${notification.eventType} notification for user ${notification.userId}, player ${notification.playerName}`);
  } catch (error) {
    console.error('Error queueing notification:', error);
    throw error;
  }
}

// Process notification queue
export async function processNotificationQueue(
  db: D1Database,
  resendApiKey: string,
  limit: number = 10
): Promise<number> {
  try {
    // Get pending notifications
    const result = await db.prepare(`
      SELECT id, user_id, player_username, notification_type, 
             game_url, game_details, created_at
      FROM notification_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(limit).all();
    
    if (!result.results || result.results.length === 0) {
      return 0;
    }
    
    let processed = 0;
    
    for (const notification of result.results) {
      try {
        // Mark as processing
        await updateNotificationStatus(db, notification.id as string, 'processing');
        
        // Send notification
        await sendNotificationEmail(db, {
          id: notification.id as string,
          userId: notification.user_id as number,
          playerUsername: notification.player_username as string,
          notificationType: notification.notification_type as 'game_start' | 'game_end',
          gameUrl: notification.game_url as string,
          gameDetails: JSON.parse(notification.game_details as string || 'null')
        }, resendApiKey);
        
        // Mark as sent
        await updateNotificationStatus(db, notification.id as string, 'sent');
        processed++;
        
      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error);
        await updateNotificationStatus(db, notification.id as string, 'failed', error.toString());
      }
    }
    
    return processed;
  } catch (error) {
    console.error('Error processing notification queue:', error);
    throw error;
  }
}

// Update notification status
async function updateNotificationStatus(
  db: D1Database,
  notificationId: string,
  status: 'pending' | 'processing' | 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await db.prepare(`
      UPDATE notification_queue
      SET status = ?, updated_at = ?, error_message = ?
      WHERE id = ?
    `).bind(status, now, errorMessage || null, notificationId).run();
  } catch (error) {
    console.error('Error updating notification status:', error);
  }
}
```

#### 3.2 Game Start Notification Logic (4 hours)
**Objective**: Implement specific logic for game start notifications

**File**: `src/services/notificationService.ts`

**Implementation Details**:
```typescript
// Game start notification processing
export async function processGameStartNotification(
  db: D1Database,
  statusChange: PlayerStatusChange,
  resendApiKey: string
): Promise<number> {
  try {
    // Get all subscribers for this player
    const subscribers = await getSubscribersForPlayer(db, statusChange.username);
    let notificationsSent = 0;
    
    for (const userId of subscribers) {
      try {
        // Check if notification should be sent
        const shouldSend = await shouldSendNotification(db, userId, statusChange.username);
        
        if (shouldSend) {
          // Get enhanced game details if available
          let gameDetails: ExtendedChessComGame | null = null;
          if (statusChange.gameDetails) {
            gameDetails = await getEnhancedGameDetails(
              statusChange.username,
              statusChange.gameDetails.url
            );
          }
          
          // Queue notification
          await queueNotification(db, {
            userId,
            playerName: statusChange.username,
            eventType: 'game_start',
            gameUrl: statusChange.gameDetails?.url,
            gameDetails
          });
          
          notificationsSent++;
        }
      } catch (error) {
        console.error(`Failed to process game start notification for user ${userId}:`, error);
      }
    }
    
    return notificationsSent;
  } catch (error) {
    console.error('Error processing game start notifications:', error);
    throw error;
  }
}

// Email composition for game start
async function sendNotificationEmail(
  db: D1Database,
  notification: {
    id: string;
    userId: number;
    playerUsername: string;
    notificationType: 'game_start' | 'game_end';
    gameUrl?: string;
    gameDetails?: ExtendedChessComGame;
  },
  resendApiKey: string
): Promise<void> {
  try {
    // Get user details
    const user = await getUserById(db, notification.userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Compose email content
    const emailContent = await composeGameStartEmail(
      user,
      notification.playerUsername,
      notification.gameDetails
    );
    
    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Chess.com Helper <notifications@chesscomhelper.com>',
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      })
    });
    
    if (!response.ok) {
      throw new Error(`Email send failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Log successful notification
    await logNotificationSent(db, {
      userId: notification.userId,
      playerUsername: notification.playerUsername,
      notificationType: notification.notificationType,
      gameDetails: notification.gameDetails,
      emailProviderId: result.id
    });
    
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw error;
  }
}

// Compose game start email content
async function composeGameStartEmail(
  user: { email: string, username?: string },
  playerName: string,
  gameDetails?: ExtendedChessComGame | null
): Promise<{ subject: string, html: string, text: string }> {
  const subject = `🎯 ${playerName} started a new game`;
  
  // Basic game info
  const gameInfo = gameDetails ? {
    timeControl: gameDetails.timeControlDisplay,
    gameType: gameDetails.gameType,
    rated: gameDetails.rated,
    opponent: gameDetails.opponent,
    gameUrl: gameDetails.url
  } : null;
  
  // HTML template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; }
        .header { text-align: center; margin-bottom: 30px; }
        .player-name { color: #769656; font-weight: bold; }
        .game-details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .game-details h3 { margin-top: 0; color: #333; }
        .game-details ul { margin: 10px 0; padding-left: 20px; }
        .game-details li { margin: 5px 0; }
        .cta-button { display: inline-block; background: #769656; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        .footer a { color: #769656; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 <span class="player-name">${playerName}</span> started a new game!</h1>
        </div>
        
        ${gameInfo ? `
          <div class="game-details">
            <h3>Game Details</h3>
            <ul>
              <li><strong>Time Control:</strong> ${gameInfo.timeControl}</li>
              <li><strong>Game Type:</strong> ${gameInfo.gameType}</li>
              <li><strong>Rated:</strong> ${gameInfo.rated ? 'Yes' : 'No'}</li>
              ${gameInfo.opponent ? `<li><strong>Opponent:</strong> ${gameInfo.opponent}</li>` : ''}
              <li><strong>Started:</strong> Just now</li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${gameInfo.gameUrl}" class="cta-button">Watch Live Game</a>
          </div>
        ` : `
          <div class="game-details">
            <p><strong>${playerName}</strong> has started playing a new game on Chess.com!</p>
            <p>Visit Chess.com to watch the game live.</p>
          </div>
        `}
        
        <div class="footer">
          <p>This notification was sent because you're subscribed to updates for ${playerName}.</p>
          <p>
            <a href="https://chesscomhelper.com/preferences">Manage your preferences</a> | 
            <a href="https://chesscomhelper.com/unsubscribe?token=${generateUnsubscribeToken(user.email)}">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Plain text version
  const text = `
    🎯 ${playerName} started a new game!
    
    ${gameInfo ? `
    Game Details:
    - Time Control: ${gameInfo.timeControl}
    - Game Type: ${gameInfo.gameType}
    - Rated: ${gameInfo.rated ? 'Yes' : 'No'}
    ${gameInfo.opponent ? `- Opponent: ${gameInfo.opponent}` : ''}
    - Started: Just now
    
    Watch live: ${gameInfo.gameUrl}
    ` : `
    ${playerName} has started playing a new game on Chess.com!
    Visit Chess.com to watch the game live.
    `}
    
    ---
    Manage preferences: https://chesscomhelper.com/preferences
    Unsubscribe: https://chesscomhelper.com/unsubscribe?token=${generateUnsubscribeToken(user.email)}
  `;
  
  return { subject, html, text };
}

// Log notification sent
async function logNotificationSent(
  db: D1Database,
  notification: {
    userId: number;
    playerUsername: string;
    notificationType: string;
    gameDetails?: ExtendedChessComGame;
    emailProviderId: string;
  }
): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO notification_log (
        id, user_id, player_username, notification_type,
        game_details, sent_at, email_provider_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      await generateSecureId(),
      notification.userId,
      notification.playerUsername,
      notification.notificationType,
      JSON.stringify(notification.gameDetails || null),
      now,
      notification.emailProviderId
    ).run();
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

// Helper functions
function generateUnsubscribeToken(email: string): string {
  // Generate secure unsubscribe token
  return Buffer.from(email).toString('base64');
}
```

---

### Task 4: Job System Integration (6 hours)

#### 4.1 Enhanced Player Monitoring Jobs (4 hours)
**Objective**: Update existing job system to handle notifications

**File**: `src/jobs/playerMonitoring.ts`

**Implementation Details**:
```typescript
// Enhanced monitoring job with notification integration
export async function checkPlayerStatusWithNotifications(
  env: Env, 
  ctx: ExecutionContext
): Promise<MonitoringJobResult> {
  const startTime = Date.now();
  const jobId = await generateSecureId();
  const errors: string[] = [];
  let playersChecked = 0;
  let notificationsSent = 0;

  try {
    await logJobStart(env.DB, jobId, 'enhanced_monitoring');

    // Get monitored players
    const monitoredPlayers = await getAllMonitoredPlayers(env.DB);
    if (monitoredPlayers.length === 0) {
      await logJobComplete(env.DB, jobId, 'completed');
      return { playersChecked: 0, notificationsSent: 0, errors: [], duration: Date.now() - startTime };
    }

    console.log(`Starting enhanced monitoring for ${monitoredPlayers.length} players`);

    // Use optimized batch processing
    const playerStatuses = await optimizedBatchGetPlayerStatuses(monitoredPlayers, env.CHESS_COM_API_URL);
    
    // Detect status changes
    const statusChangeResult = await detectPlayerStatusChanges(env.DB, playerStatuses);
    playersChecked = statusChangeResult.playersChecked;
    errors.push(...statusChangeResult.errors);

    // Process status changes and trigger notifications
    for (const change of statusChangeResult.changes) {
      try {
        // Update player status in database
        await updatePlayerStatus(env.DB, change.username, {
          isOnline: change.currentStatus.isOnline,
          isPlaying: change.currentStatus.isPlaying,
          currentGameUrl: change.currentStatus.currentGameUrl,
          lastSeen: change.currentStatus.lastSeen
        });

        // Log status change
        await logStatusChange(env.DB, change);

        // Process game start notifications
        if (change.changeType === 'game_start') {
          const gameNotifications = await processGameStartNotification(
            env.DB,
            change,
            env.RESEND_API_KEY
          );
          notificationsSent += gameNotifications;
        }

      } catch (error) {
        const errorMsg = `Error processing status change for ${change.username}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Process notification queue
    const queueProcessed = await processNotificationQueue(
      env.DB,
      env.RESEND_API_KEY,
      20 // Process up to 20 notifications per job run
    );
    
    console.log(`Processed ${queueProcessed} notifications from queue`);

    await logJobComplete(env.DB, jobId, 'completed');
    console.log(`Enhanced monitoring completed: ${playersChecked} players, ${notificationsSent} notifications triggered`);

  } catch (error) {
    const errorMsg = `Enhanced monitoring job failed: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    await logJobComplete(env.DB, jobId, 'failed', errorMsg);
  }

  return {
    playersChecked,
    notificationsSent,
    errors,
    duration: Date.now() - startTime
  };
}

// Notification-specific job for processing queue
export async function processNotificationQueueJob(
  env: Env,
  ctx: ExecutionContext
): Promise<{ processed: number, errors: string[] }> {
  const errors: string[] = [];
  
  try {
    const processed = await processNotificationQueue(
      env.DB,
      env.RESEND_API_KEY,
      50 // Process more notifications in dedicated job
    );
    
    console.log(`Notification queue job processed ${processed} notifications`);
    return { processed, errors };
    
  } catch (error) {
    const errorMsg = `Notification queue job failed: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    return { processed: 0, errors };
  }
}
```

#### 4.2 Job Scheduling Configuration (2 hours)
**Objective**: Configure job scheduling for notifications

**File**: `src/index.ts` (or wherever jobs are scheduled)

**Implementation Details**:
```typescript
// Enhanced job scheduling with notification support
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron;
    console.log(`Scheduled job triggered: ${cron}`);
    
    try {
      switch (cron) {
        case '*/5 * * * *': // Every 5 minutes - main monitoring
          await checkPlayerStatusWithNotifications(env, ctx);
          break;
          
        case '*/2 * * * *': // Every 2 minutes - notification queue processing
          await processNotificationQueueJob(env, ctx);
          break;
          
        case '0 */6 * * *': // Every 6 hours - cleanup old logs
          await cleanupOldLogs(env.DB);
          break;
          
        default:
          console.log(`Unknown cron pattern: ${cron}`);
      }
    } catch (error) {
      console.error('Scheduled job error:', error);
    }
  }
}

// Cleanup job for old logs
async function cleanupOldLogs(db: D1Database): Promise<void> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Clean up old status change logs
    await db.prepare(`
      DELETE FROM status_change_log 
      WHERE created_at < ?
    `).bind(sevenDaysAgo).run();
    
    // Clean up old monitoring jobs
    await db.prepare(`
      DELETE FROM monitoring_jobs 
      WHERE created_at < ?
    `).bind(sevenDaysAgo).run();
    
    // Clean up old notification logs (keep for 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare(`
      DELETE FROM notification_log 
      WHERE sent_at < ?
    `).bind(thirtyDaysAgo).run();
    
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Cleanup job failed:', error);
  }
}
```

---

### Task 5: Error Handling and Retry Mechanisms (4 hours)

#### 5.1 Notification Retry Logic (2 hours)
**Objective**: Implement retry logic for failed notifications

**File**: `src/services/notificationService.ts`

**Implementation Details**:
```typescript
// Retry failed notifications
export async function retryFailedNotifications(
  db: D1Database,
  resendApiKey: string,
  maxRetries: number = 3
): Promise<number> {
  try {
    // Get failed notifications that haven't exceeded retry limit
    const result = await db.prepare(`
      SELECT id, user_id, player_username, notification_type, 
             game_url, game_details, retry_count, created_at
      FROM notification_queue
      WHERE status = 'failed' AND retry_count < ?
      ORDER BY created_at ASC
      LIMIT 20
    `).bind(maxRetries).all();
    
    if (!result.results || result.results.length === 0) {
      return 0;
    }
    
    let retried = 0;
    
    for (const notification of result.results) {
      try {
        const retryCount = (notification.retry_count as number) || 0;
        
        // Calculate backoff delay
        const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        
        // Check if enough time has passed since last attempt
        const lastAttempt = new Date(notification.updated_at as string || notification.created_at as string);
        const nextAttempt = new Date(lastAttempt.getTime() + backoffDelay);
        
        if (new Date() < nextAttempt) {
          continue; // Not ready for retry yet
        }
        
        // Increment retry count
        await db.prepare(`
          UPDATE notification_queue
          SET retry_count = retry_count + 1, status = 'processing'
          WHERE id = ?
        `).bind(notification.id).run();
        
        // Attempt to resend
        await sendNotificationEmail(db, {
          id: notification.id as string,
          userId: notification.user_id as number,
          playerUsername: notification.player_username as string,
          notificationType: notification.notification_type as 'game_start' | 'game_end',
          gameUrl: notification.game_url as string,
          gameDetails: JSON.parse(notification.game_details as string || 'null')
        }, resendApiKey);
        
        // Mark as sent
        await updateNotificationStatus(db, notification.id as string, 'sent');
        retried++;
        
      } catch (error) {
        console.error(`Retry failed for notification ${notification.id}:`, error);
        await updateNotificationStatus(db, notification.id as string, 'failed', error.toString());
      }
    }
    
    return retried;
  } catch (error) {
    console.error('Error retrying failed notifications:', error);
    throw error;
  }
}
```

#### 5.2 API Failure Recovery (2 hours)
**Objective**: Implement recovery mechanisms for API failures

**File**: `src/services/chessComService.ts`

**Implementation Details**:
```typescript
// API health monitoring
export class ApiHealthMonitor {
  private failures: number = 0;
  private lastFailure: Date | null = null;
  private isHealthy: boolean = true;
  
  recordSuccess(): void {
    this.failures = 0;
    this.isHealthy = true;
  }
  
  recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
    
    // Consider API unhealthy after 5 consecutive failures
    if (this.failures >= 5) {
      this.isHealthy = false;
    }
  }
  
  isApiHealthy(): boolean {
    // Auto-recover after 10 minutes
    if (!this.isHealthy && this.lastFailure) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (this.lastFailure < tenMinutesAgo) {
        this.isHealthy = true;
        this.failures = 0;
      }
    }
    
    return this.isHealthy;
  }
  
  getFailureCount(): number {
    return this.failures;
  }
}

// Global API health monitor
const apiHealthMonitor = new ApiHealthMonitor();

// Enhanced API wrapper with health monitoring
export async function healthyApiCall<T>(
  apiCall: () => Promise<T>,
  fallbackValue?: T
): Promise<T | null> {
  if (!apiHealthMonitor.isApiHealthy()) {
    console.log('API is unhealthy, skipping call');
    return fallbackValue || null;
  }
  
  try {
    const result = await retryApiCall(apiCall);
    apiHealthMonitor.recordSuccess();
    return result;
  } catch (error) {
    apiHealthMonitor.recordFailure();
    console.error('API call failed:', error);
    
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    
    throw error;
  }
}

// Circuit breaker pattern for API calls
export class ApiCircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(apiCall: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await apiCall();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
           Date.now() - this.lastFailureTime.getTime() >= this.timeout;
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests (4 hours)

#### Core Logic Tests
**File**: `tests/monitoring-integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { detectPlayerStatusChanges, logStatusChange } from '../src/services/monitoringService';

describe('Status Change Detection', () => {
  it('should detect game start transitions', async () => {
    // Test implementation
  });
  
  it('should detect game end transitions', async () => {
    // Test implementation
  });
  
  it('should handle missing previous status', async () => {
    // Test implementation
  });
});

describe('Notification Logic', () => {
  it('should respect cooldown periods', async () => {
    // Test implementation
  });
  
  it('should check user preferences', async () => {
    // Test implementation
  });
  
  it('should handle notification queue processing', async () => {
    // Test implementation
  });
});
```

### Integration Tests (4 hours)

#### API Integration Tests
**File**: `tests/chess-com-api.test.ts`

```typescript
describe('Chess.com API Integration', () => {
  it('should handle rate limiting gracefully', async () => {
    // Test rate limiting behavior
  });
  
  it('should retry failed requests', async () => {
    // Test retry logic
  });
  
  it('should process batches efficiently', async () => {
    // Test batch processing
  });
});
```

### End-to-End Tests (4 hours)

#### Complete Flow Tests
**File**: `tests/notification-flow.test.ts`

```typescript
describe('Notification Flow', () => {
  it('should process complete game start flow', async () => {
    // Test: Status change → notification check → email send
  });
  
  it('should handle notification failures gracefully', async () => {
    // Test error handling and retry
  });
});
```

---

## 📊 Performance Optimization

### Batch Processing Optimization
- **Adaptive Batch Sizing**: Adjust batch size based on API performance
- **Concurrent Processing**: Limited concurrency to avoid overwhelming APIs
- **Request Deduplication**: Avoid duplicate requests for same players

### Database Optimization
- **Indexed Queries**: All notification queries use proper indexes
- **Connection Pooling**: Efficient D1 connection usage
- **Query Batching**: Batch database operations where possible

### Memory Management
- **Streaming Processing**: Process large player lists in chunks
- **Garbage Collection**: Proper cleanup of temporary objects
- **Memory Monitoring**: Track memory usage in long-running jobs

---

## 🔐 Security Considerations

### API Security
- **Rate Limiting**: Respect Chess.com API limits
- **Error Handling**: Don't expose sensitive API errors
- **Authentication**: Secure API key management

### Data Protection
- **User Data**: Encrypt sensitive user information
- **Notification Content**: Sanitize email content
- **Access Control**: User-scoped data access only

### Email Security
- **Unsubscribe Links**: Secure token-based unsubscribe
- **Content Security**: Prevent email injection attacks
- **Delivery Tracking**: Monitor for abuse patterns

---

## 📈 Success Criteria

### Technical Acceptance Criteria
- [ ] **Status Change Detection**: 99%+ accuracy in detecting game start/end events
- [ ] **Notification Delivery**: <5 minute delay from game start to email delivery
- [ ] **API Performance**: <10% failure rate for Chess.com API calls
- [ ] **Queue Processing**: All notifications processed within 2 minutes
- [ ] **Error Handling**: Graceful recovery from all failure scenarios

### Performance Benchmarks
- [ ] **Batch Processing**: 100+ players processed per minute
- [ ] **Database Queries**: All queries complete within 1 second
- [ ] **Memory Usage**: <50MB peak memory usage during processing
- [ ] **API Rate Limits**: Stay within 300 requests/minute limit

### Quality Gates
- [ ] **Code Coverage**: >85% for all new code
- [ ] **Unit Tests**: All unit tests passing
- [ ] **Integration Tests**: All integration tests passing
- [ ] **Performance Tests**: All benchmarks met
- [ ] **Security Review**: All security checks passed

---

## 🚀 Deployment Strategy

### Environment Configuration
```typescript
// Environment variables required
interface Env {
  CHESS_COM_API_URL?: string;
  RESEND_API_KEY: string;
  DB: D1Database;
  NOTIFICATION_COOLDOWN_MINUTES?: string;
  MAX_BATCH_SIZE?: string;
  RATE_LIMIT_PER_MINUTE?: string;
}
```

### Feature Flags
- **ENABLE_NOTIFICATIONS**: Global notification toggle
- **ENABLE_BATCH_PROCESSING**: Batch processing toggle
- **ENABLE_ENHANCED_MONITORING**: Enhanced monitoring toggle

### Rollback Plan
- **Database Rollback**: Revert schema changes if needed
- **Feature Disable**: Quick disable via environment variables
- **Service Isolation**: Notification failures don't affect core functionality

---

## 🔧 Maintenance & Monitoring

### Monitoring Metrics
- **Notification Volume**: Track daily/hourly notification counts
- **Delivery Success Rate**: Monitor email delivery success
- **API Performance**: Track Chess.com API response times
- **Queue Health**: Monitor notification queue size and processing time

### Alerting Thresholds
- **High Failure Rate**: >10% notification delivery failures
- **Queue Backlog**: >100 pending notifications
- **API Issues**: >20% Chess.com API errors
- **Performance Degradation**: >10 second processing delays

### Maintenance Tasks
- **Log Cleanup**: Automated cleanup of old logs
- **Performance Monitoring**: Regular performance reviews
- **Dependency Updates**: Keep dependencies current
- **Security Audits**: Regular security reviews

---

This comprehensive implementation plan provides all the technical details needed to successfully implement Phase 2 of the email notifications system. The plan includes specific code examples, testing strategies, and success criteria to ensure a robust and reliable notification system.
# Technical Implementation Plan
## Player Tracking Table Enhancement

### Document Information
- **Feature**: Player Tracking Table with Actions
- **Version**: 1.0
- **Created**: January 2025
- **Technical Lead**: Engineering Team
- **Status**: Ready for Implementation

---

## 1. Architecture Overview

### Current State
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  API Endpoints   │────▶│   D1 Database   │
│  (Embedded JS)  │     │  (Cloudflare)    │     │   (SQLite)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
   Card Layout            RESTful API              Player Data
   Simple Grid          Authentication            Subscriptions
   Basic Actions          Rate Limiting             Status Info
```

### Target State
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  API Endpoints   │────▶│   D1 Database   │
│  (Enhanced JS)  │     │  (Extended)      │     │   (Extended)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
   Table View            Bulk Operations          Notification Prefs
   Sort/Filter          Status Aggregation        Activity Tracking
   Inline Actions       Preference Management      Extended Metadata
```

## 2. Database Schema Updates

### New Tables (Phase 2+)

```sql
-- Notification preferences per player subscription
CREATE TABLE IF NOT EXISTS player_notification_preferences (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  notify_online BOOLEAN DEFAULT false,
  notify_game_start BOOLEAN DEFAULT false,
  notify_game_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES player_subscriptions(id) ON DELETE CASCADE
);

-- Player activity tracking
CREATE TABLE IF NOT EXISTS player_activity_log (
  id TEXT PRIMARY KEY,
  chess_com_username TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'online', 'offline', 'game_start', 'game_end'
  event_data TEXT, -- JSON data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username_created (chess_com_username, created_at)
);
```

### Existing Table Modifications

```sql
-- Add index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_player_subscriptions_user_created 
  ON player_subscriptions(user_id, created_at DESC);

-- Add index for player status queries
CREATE INDEX IF NOT EXISTS idx_player_status_username_updated 
  ON player_status(chess_com_username, updated_at DESC);
```

## 3. Implementation Phases

### Phase 1: Frontend Table Implementation (Current Scope)

#### 1.1 HTML Structure Updates
**File**: `src/index.ts` (HTML template section)

```html
<!-- Replace player grid with table structure -->
<div class="players-container">
  <div class="table-actions">
    <div class="bulk-actions" id="bulkActions" style="display: none;">
      <span class="selected-count">0 selected</span>
      <button class="bulk-button">Enable Alerts</button>
      <button class="bulk-button">Disable Alerts</button>
      <button class="bulk-button danger">Remove Selected</button>
    </div>
  </div>
  
  <div class="table-wrapper">
    <table class="players-table" id="playersTable">
      <thead>
        <tr>
          <th class="checkbox-column">
            <input type="checkbox" id="selectAll" />
          </th>
          <th class="sortable" data-sort="username">
            Player <span class="sort-indicator"></span>
          </th>
          <th class="sortable" data-sort="status">
            Status <span class="sort-indicator"></span>
          </th>
          <th class="sortable" data-sort="lastSeen">
            Last Seen <span class="sort-indicator"></span>
          </th>
          <th class="sortable" data-sort="gamestoday">
            Games Today <span class="sort-indicator"></span>
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="playerTableBody">
        <!-- Rows will be inserted here -->
      </tbody>
    </table>
  </div>
</div>
```

#### 1.2 CSS Styles
**File**: `src/index.ts` (CSS section)

```css
/* Table Styles */
.players-container {
  width: 100%;
  background: var(--bg-green-gray);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.players-table {
  width: 100%;
  border-collapse: collapse;
}

.players-table th {
  background: var(--bg-dark-green);
  color: var(--text-secondary);
  font-weight: 500;
  text-align: left;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-green);
  white-space: nowrap;
}

.players-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.players-table th.sortable:hover {
  color: var(--text-primary);
}

.sort-indicator::after {
  content: '⇅';
  opacity: 0.3;
  margin-left: 4px;
}

.sort-asc .sort-indicator::after {
  content: '▲';
  opacity: 1;
}

.sort-desc .sort-indicator::after {
  content: '▼';
  opacity: 1;
}

.players-table td {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid rgba(46, 93, 50, 0.3);
}

.players-table tbody tr {
  transition: background-color 0.2s ease;
}

.players-table tbody tr:hover {
  background: rgba(102, 187, 106, 0.05);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.action-btn {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-btn.alert {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
}

.action-btn.alert.active {
  background: var(--primary-green);
  border-color: var(--primary-green);
  color: white;
}

.action-btn.view {
  border-color: var(--primary-green);
  color: var(--primary-green);
}

.action-btn.view:hover {
  background: var(--primary-green);
  color: white;
}

.action-btn.remove {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
}

.action-btn.remove:hover {
  border-color: var(--error-red);
  color: var(--error-red);
  background: rgba(244, 67, 54, 0.1);
}

/* Player Info Cell */
.player-info-cell {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.player-avatar {
  width: 32px;
  height: 32px;
  background: var(--primary-green);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
  font-size: 0.875rem;
}

.player-username {
  font-weight: 500;
  color: var(--text-primary);
}

/* Status Indicators */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
}

.status-badge.online {
  background: rgba(76, 175, 80, 0.1);
  color: var(--success-green);
}

.status-badge.offline {
  background: rgba(158, 158, 158, 0.1);
  color: var(--text-secondary);
}

.status-badge.playing {
  background: rgba(255, 152, 0, 0.1);
  color: var(--warning-amber);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .players-table {
    font-size: 0.875rem;
  }
  
  .checkbox-column,
  .players-table th:nth-child(5) {
    display: none;
  }
  
  .players-table td {
    padding: var(--spacing-sm) var(--spacing-md);
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }
  
  .action-btn {
    padding: 4px 8px;
    font-size: 0.75rem;
  }
}
```

#### 1.3 JavaScript Implementation
**File**: `src/index.ts` (JavaScript section)

```javascript
// Enhanced player tracking state
let players = [];
let sortColumn = 'username';
let sortDirection = 'asc';
let selectedPlayers = new Set();

// Mock notification preferences (Phase 1)
let notificationPrefs = {};

// Table rendering function
function renderPlayersTable() {
  const tbody = document.getElementById('playerTableBody');
  const playersList = document.getElementById('playersList');
  
  if (!players.length) {
    playersList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">♟️</div>
        <div class="empty-state-text">No players monitored yet</div>
        <div class="empty-state-subtext">Add a Chess.com username above to start tracking</div>
      </div>
    `;
    return;
  }
  
  // Sort players
  const sortedPlayers = [...players].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    
    if (sortColumn === 'lastSeen') {
      aVal = new Date(aVal || 0).getTime();
      bVal = new Date(bVal || 0).getTime();
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Build table HTML
  tbody.innerHTML = sortedPlayers.map(player => `
    <tr data-username="${player.username}">
      <td class="checkbox-column">
        <input type="checkbox" class="player-checkbox" value="${player.username}" 
          ${selectedPlayers.has(player.username) ? 'checked' : ''} />
      </td>
      <td>
        <div class="player-info-cell">
          <div class="player-avatar">${player.username[0].toUpperCase()}</div>
          <a href="https://chess.com/member/${player.username}" target="_blank" 
             class="player-username">${player.username}</a>
        </div>
      </td>
      <td>
        ${getStatusBadge(player)}
      </td>
      <td>${formatLastSeen(player.lastSeen)}</td>
      <td>${player.gamesToday || 0}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn alert ${notificationPrefs[player.username] ? 'active' : ''}" 
                  onclick="toggleAlert('${player.username}')" 
                  title="${notificationPrefs[player.username] ? 'Disable' : 'Enable'} notifications">
            🔔 Alert Me
          </button>
          <button class="action-btn view" onclick="viewDetails('${player.username}')" 
                  title="View player details">
            📊 View Details
          </button>
          <button class="action-btn remove" onclick="removePlayer('${player.username}')" 
                  title="Remove from tracking">
            🗑️ Remove
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  
  // Update bulk actions visibility
  updateBulkActions();
}

// Helper functions
function getStatusBadge(player) {
  if (player.isPlaying) {
    return '<span class="status-badge playing">🎮 In Game</span>';
  } else if (player.isOnline) {
    return '<span class="status-badge online">🟢 Online</span>';
  } else {
    return '<span class="status-badge offline">⚫ Offline</span>';
  }
}

function formatLastSeen(timestamp) {
  if (!timestamp) return 'Never';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Action handlers
function toggleAlert(username) {
  notificationPrefs[username] = !notificationPrefs[username];
  renderPlayersTable();
  showNotification(
    notificationPrefs[username] 
      ? `Notifications enabled for ${username}` 
      : `Notifications disabled for ${username}`,
    'success'
  );
}

function viewDetails(username) {
  // Phase 1: Just show coming soon
  showNotification('Player details coming soon!', 'info');
}

async function removePlayer(username) {
  if (!confirm(`Remove ${username} from tracking?`)) return;
  
  try {
    const response = await fetch(`/api/v1/users/me/subscriptions/${username}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });
    
    if (response.ok) {
      players = players.filter(p => p.username !== username);
      selectedPlayers.delete(username);
      renderPlayersTable();
      showNotification(`${username} removed from tracking`, 'success');
    } else {
      throw new Error('Failed to remove player');
    }
  } catch (error) {
    showNotification('Failed to remove player', 'error');
  }
}

// Sorting functionality
document.querySelectorAll('.sortable').forEach(th => {
  th.addEventListener('click', function() {
    const column = this.dataset.sort;
    
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
    
    // Update UI
    document.querySelectorAll('.sortable').forEach(el => {
      el.classList.remove('sort-asc', 'sort-desc');
    });
    this.classList.add(`sort-${sortDirection}`);
    
    renderPlayersTable();
  });
});

// Selection handling
document.getElementById('selectAll').addEventListener('change', function() {
  if (this.checked) {
    players.forEach(p => selectedPlayers.add(p.username));
  } else {
    selectedPlayers.clear();
  }
  renderPlayersTable();
});

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('player-checkbox')) {
    const username = e.target.value;
    if (e.target.checked) {
      selectedPlayers.add(username);
    } else {
      selectedPlayers.delete(username);
    }
    updateBulkActions();
  }
});

function updateBulkActions() {
  const bulkActions = document.getElementById('bulkActions');
  const selectAll = document.getElementById('selectAll');
  const count = selectedPlayers.size;
  
  if (count > 0) {
    bulkActions.style.display = 'flex';
    bulkActions.querySelector('.selected-count').textContent = `${count} selected`;
  } else {
    bulkActions.style.display = 'none';
  }
  
  selectAll.checked = count === players.length && players.length > 0;
  selectAll.indeterminate = count > 0 && count < players.length;
}

// Enhanced load players function
async function loadPlayers() {
  const list = document.getElementById('playersList');
  list.innerHTML = '<div class="loading">Loading players...</div>';
  
  try {
    // Fetch subscriptions
    const response = await fetch('/api/v1/users/me/subscriptions', {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });
    
    const data = await response.json();
    
    // For Phase 1, create mock player data
    players = data.subscriptions.map(sub => ({
      username: sub.chessComUsername,
      isOnline: Math.random() > 0.5,
      isPlaying: Math.random() > 0.7,
      lastSeen: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      gamesToday: Math.floor(Math.random() * 10)
    }));
    
    renderPlayersTable();
  } catch (error) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-text">Error loading players</div>
        <div class="empty-state-subtext">Please try refreshing the page</div>
      </div>
    `;
  }
}
```

### Phase 2: Backend Integration

#### 2.1 New API Endpoints

**File**: `src/routes/notifications.ts` (extend existing)

```typescript
// GET /api/v1/users/me/notification-preferences
router.get('/users/me/notification-preferences', authenticate, async (c) => {
  const userId = c.get('user').id;
  const prefs = await getNotificationPreferences(c.env.DB, userId);
  return c.json({ preferences: prefs });
});

// PUT /api/v1/users/me/notification-preferences/:username
router.put('/users/me/notification-preferences/:username', authenticate, async (c) => {
  const userId = c.get('user').id;
  const { username } = c.req.param();
  const { notifyOnline, notifyGameStart, notifyGameEnd } = await c.req.json();
  
  const updated = await updateNotificationPreference(c.env.DB, {
    userId,
    chessComUsername: username,
    notifyOnline,
    notifyGameStart,
    notifyGameEnd
  });
  
  return c.json({ preference: updated });
});

// GET /api/v1/monitoring/players/bulk-status
router.post('/monitoring/players/bulk-status', authenticate, async (c) => {
  const { usernames } = await c.req.json();
  const statuses = await getBulkPlayerStatus(c.env.DB, usernames);
  return c.json({ statuses });
});
```

#### 2.2 Service Layer Updates

**File**: `src/services/notificationService.ts` (extend)

```typescript
export interface NotificationPreference {
  id: string
  subscriptionId: string
  notifyOnline: boolean
  notifyGameStart: boolean
  notifyGameEnd: boolean
}

export async function getNotificationPreferences(
  db: D1Database, 
  userId: string
): Promise<NotificationPreference[]> {
  const result = await db.prepare(`
    SELECT np.*, ps.chess_com_username
    FROM player_notification_preferences np
    JOIN player_subscriptions ps ON np.subscription_id = ps.id
    WHERE ps.user_id = ?
  `).bind(userId).all();
  
  return result.results || [];
}

export async function updateNotificationPreference(
  db: D1Database,
  data: {
    userId: string
    chessComUsername: string
    notifyOnline: boolean
    notifyGameStart: boolean
    notifyGameEnd: boolean
  }
): Promise<NotificationPreference> {
  // Find subscription
  const sub = await db.prepare(`
    SELECT id FROM player_subscriptions 
    WHERE user_id = ? AND chess_com_username = ?
  `).bind(data.userId, data.chessComUsername).first();
  
  if (!sub) {
    throw createApiError('Subscription not found', 404);
  }
  
  // Upsert preference
  const id = await generateSecureId();
  await db.prepare(`
    INSERT INTO player_notification_preferences 
    (id, subscription_id, notify_online, notify_game_start, notify_game_end)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(subscription_id) DO UPDATE SET
      notify_online = excluded.notify_online,
      notify_game_start = excluded.notify_game_start,
      notify_game_end = excluded.notify_game_end,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    sub.id,
    data.notifyOnline,
    data.notifyGameStart,
    data.notifyGameEnd
  ).run();
  
  return {
    id,
    subscriptionId: sub.id as string,
    notifyOnline: data.notifyOnline,
    notifyGameStart: data.notifyGameStart,
    notifyGameEnd: data.notifyGameEnd
  };
}
```

### Phase 3: Advanced Features

#### 3.1 Player Details Modal

**Frontend Implementation**:
```javascript
function showPlayerDetails(username) {
  const modal = createModal({
    title: `Player Details: ${username}`,
    content: `
      <div class="player-details-modal">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value" id="totalGames">-</div>
            <div class="stat-label">Total Games</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="winRate">-</div>
            <div class="stat-label">Win Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="avgGameTime">-</div>
            <div class="stat-label">Avg Game Time</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="peakOnline">-</div>
            <div class="stat-label">Peak Online Time</div>
          </div>
        </div>
        <div class="activity-chart" id="activityChart">
          <!-- Chart.js or similar -->
        </div>
      </div>
    `
  });
  
  loadPlayerStats(username);
}
```

#### 3.2 Bulk Operations

```javascript
async function performBulkAction(action) {
  const usernames = Array.from(selectedPlayers);
  
  switch(action) {
    case 'enableAlerts':
      await Promise.all(usernames.map(u => 
        updateNotificationPreference(u, true)
      ));
      break;
      
    case 'disableAlerts':
      await Promise.all(usernames.map(u => 
        updateNotificationPreference(u, false)
      ));
      break;
      
    case 'remove':
      if (!confirm(`Remove ${usernames.length} players?`)) return;
      await Promise.all(usernames.map(u => 
        removePlayerSubscription(u)
      ));
      break;
  }
  
  selectedPlayers.clear();
  await loadPlayers();
}
```

## 4. Testing Strategy

### Unit Tests
```typescript
// src/tests/player-table.test.ts
describe('Player Table', () => {
  test('renders empty state when no players', () => {
    const table = renderPlayersTable([]);
    expect(table).toContain('No players monitored yet');
  });
  
  test('sorts players by username', () => {
    const players = [
      { username: 'charlie' },
      { username: 'alice' },
      { username: 'bob' }
    ];
    const sorted = sortPlayers(players, 'username', 'asc');
    expect(sorted[0].username).toBe('alice');
  });
  
  test('formats last seen correctly', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    expect(formatLastSeen(fiveMinutesAgo)).toBe('5m ago');
  });
});
```

### Integration Tests
```typescript
describe('Player Actions', () => {
  test('toggles notification preference', async () => {
    const response = await request(app)
      .put('/api/v1/users/me/notification-preferences/testuser')
      .set('Authorization', 'Bearer token')
      .send({ notifyOnline: true });
      
    expect(response.status).toBe(200);
    expect(response.body.preference.notifyOnline).toBe(true);
  });
  
  test('removes player subscription', async () => {
    const response = await request(app)
      .delete('/api/v1/users/me/subscriptions/testuser')
      .set('Authorization', 'Bearer token');
      
    expect(response.status).toBe(204);
  });
});
```

### E2E Tests
```javascript
describe('Player Table E2E', () => {
  test('user can sort, select, and bulk remove players', async () => {
    await page.goto('/');
    await login();
    
    // Sort by status
    await page.click('[data-sort="status"]');
    await expect(page).toHaveSelector('.sort-asc');
    
    // Select multiple players
    await page.click('.player-checkbox:nth-child(1)');
    await page.click('.player-checkbox:nth-child(2)');
    
    // Bulk remove
    await page.click('.bulk-button.danger');
    await page.click('.confirm-button');
    
    await expect(page).toHaveText('2 players removed');
  });
});
```

## 5. Performance Considerations

### Frontend Optimizations
1. **Virtual Scrolling**: Implement for 100+ players
2. **Debounced Search**: 300ms delay on filter inputs
3. **Memoized Sorting**: Cache sorted results
4. **Lazy Loading**: Load player details on demand

### Backend Optimizations
1. **Batch Queries**: Fetch all data in minimal queries
2. **Caching**: Redis/KV for frequently accessed data
3. **Pagination**: Limit results for large datasets
4. **Indexes**: Proper database indexing

### Code Example: Virtual Scrolling
```javascript
class VirtualTable {
  constructor(container, rowHeight, totalRows) {
    this.container = container;
    this.rowHeight = rowHeight;
    this.totalRows = totalRows;
    this.visibleRows = Math.ceil(container.clientHeight / rowHeight);
    this.bufferRows = 5;
  }
  
  render(startIndex) {
    const endIndex = Math.min(
      startIndex + this.visibleRows + this.bufferRows,
      this.totalRows
    );
    
    // Only render visible rows + buffer
    const visibleData = this.data.slice(startIndex, endIndex);
    this.renderRows(visibleData, startIndex);
  }
}
```

## 6. Security Considerations

### Input Validation
```typescript
// Validate usernames
const usernameSchema = z.string()
  .min(3)
  .max(25)
  .regex(/^[a-zA-Z0-9_-]+$/);

// Validate bulk operations
const bulkActionSchema = z.object({
  action: z.enum(['enableAlerts', 'disableAlerts', 'remove']),
  usernames: z.array(usernameSchema).max(100)
});
```

### Rate Limiting
```typescript
// Bulk operation rate limits
const bulkRateLimit = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'minute',
  fireImmediately: true
});

router.use('/api/v1/*/bulk-*', (c, next) => {
  return bulkRateLimit.check(c, next);
});
```

### Authorization
```typescript
// Ensure users can only modify their own subscriptions
async function verifySubscriptionOwnership(
  db: D1Database,
  userId: string,
  username: string
): Promise<boolean> {
  const result = await db.prepare(`
    SELECT 1 FROM player_subscriptions
    WHERE user_id = ? AND chess_com_username = ?
  `).bind(userId, username).first();
  
  return !!result;
}
```

## 7. Migration Plan

### Phase 1 Rollout
1. Feature flag for table view
2. A/B test with 10% of users
3. Monitor performance metrics
4. Gradual rollout to 100%

### Backwards Compatibility
- Keep card view code for rollback
- Store view preference in localStorage
- Provide toggle between views initially

### Data Migration
```sql
-- No data migration needed for Phase 1
-- Phase 2 will auto-create preference records on first update
```

## 8. Monitoring & Analytics

### Key Metrics
```typescript
// Track user interactions
analytics.track('player_table_action', {
  action: 'sort' | 'filter' | 'alert_toggle' | 'view_details' | 'remove',
  username: player.username,
  context: {
    totalPlayers: players.length,
    viewType: 'table'
  }
});

// Performance metrics
performance.mark('table_render_start');
renderPlayersTable();
performance.mark('table_render_end');
performance.measure('table_render', 'table_render_start', 'table_render_end');
```

### Error Tracking
```typescript
window.addEventListener('error', (event) => {
  if (event.error?.stack?.includes('playerTable')) {
    errorReporter.log({
      message: event.error.message,
      stack: event.error.stack,
      context: {
        playerCount: players.length,
        selectedCount: selectedPlayers.size
      }
    });
  }
});
```

## 9. Documentation

### API Documentation
```yaml
/api/v1/users/me/notification-preferences/{username}:
  put:
    summary: Update notification preferences for a player
    parameters:
      - name: username
        in: path
        required: true
        schema:
          type: string
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              notifyOnline:
                type: boolean
              notifyGameStart:
                type: boolean
              notifyGameEnd:
                type: boolean
    responses:
      200:
        description: Preference updated successfully
```

### Component Documentation
```typescript
/**
 * Renders the player tracking table with sorting, filtering, and actions
 * @param {Player[]} players - Array of player objects
 * @param {SortConfig} sortConfig - Current sort configuration
 * @param {Set<string>} selectedPlayers - Set of selected player usernames
 * @returns {void} - Updates DOM directly
 */
function renderPlayersTable(
  players: Player[], 
  sortConfig: SortConfig, 
  selectedPlayers: Set<string>
): void {
  // Implementation
}
```

## 10. Future Considerations

### Scalability Path
1. **WebSocket Integration**: Real-time status updates
2. **GraphQL API**: More efficient data fetching
3. **Service Worker**: Offline capability
4. **IndexedDB**: Client-side data caching

### Feature Extensions
1. **Player Groups**: Organize players into categories
2. **Custom Columns**: Let users choose displayed data
3. **Export/Import**: CSV/JSON player lists
4. **Webhooks**: External integrations

### Technical Debt
1. Extract table component to separate module
2. Implement proper state management (Redux/Zustand)
3. Add comprehensive error boundaries
4. Improve accessibility with ARIA live regions

---

*End of Technical Implementation Plan*
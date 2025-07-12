# Phase 4: User Interface & Controls - Technical Implementation Plan

**Version**: 1.0  
**Date**: 2025-07-06  
**Phase Duration**: Days 10-12 (3 days)  
**Target Audience**: Claude AI Agents  
**Complexity**: Medium-High  

---

## 📋 Executive Summary

Phase 4 focuses on creating a comprehensive user interface and control system for managing email notifications within the Chess.com Helper application. This phase builds upon the foundation established in Phases 1-3, creating intuitive dashboards, preference management interfaces, and user-friendly notification controls with complete testing coverage.

### Key Deliverables
- **Dashboard Integration**: Notification preference controls within existing UI
- **API Endpoints**: Complete REST API for preference management
- **Frontend Components**: Reactive UI components for notification management
- **User Experience**: Intuitive notification control interface
- **Unsubscribe System**: One-click unsubscribe and preference management
- **Testing Framework**: Comprehensive UI and API testing

---

## 🎯 Phase Objectives

### Primary Goals
1. **Integrate Dashboard Controls** with existing Chess.com Helper UI
2. **Create Comprehensive API** for notification preference management
3. **Build Reactive Frontend Components** for user interaction
4. **Implement Unsubscribe System** with preference management
5. **Establish Testing Framework** for UI and API validation
6. **Create Notification History** interface for user transparency

### Success Metrics
- **User Adoption Rate**: 80% of users configure notification preferences
- **Interface Usability**: <3 clicks to modify any notification setting
- **API Response Time**: <200ms for all preference operations
- **Mobile Compatibility**: 100% functionality on mobile devices
- **Unsubscribe Rate**: <2% of notification recipients

---

## 🕐 Detailed Task Breakdown

### Day 10: Dashboard Integration & Core UI (8 hours)

#### Task 10.1: Notification Settings Dashboard (3 hours)
**Objective**: Integrate notification settings into existing dashboard interface

**Implementation Steps**:
1. **Create notification settings component** (90 minutes)
   - Design settings panel layout
   - Implement toggle switches for notification types
   - Add real-time preference saving
   - Create responsive mobile layout

2. **Integrate with existing dashboard** (60 minutes)
   - Add navigation menu item
   - Implement settings icon in header
   - Create smooth transitions between views
   - Maintain existing design consistency

3. **Add notification status indicators** (30 minutes)
   - Show current notification status
   - Display cooldown timers
   - Add delivery success metrics
   - Include last notification timestamps

**Files to Create/Modify**:
- `src/frontend/components/NotificationSettings.ts`
- `src/frontend/components/NotificationToggle.ts`
- `src/frontend/components/NotificationStatus.ts`
- `src/index.ts` (update HTML template)

**Success Criteria**:
- [ ] Settings dashboard integrated seamlessly
- [ ] All notification preferences easily accessible
- [ ] Mobile-responsive design works correctly
- [ ] Real-time updates without page refresh

#### Task 10.2: Player-Specific Notification Controls (2.5 hours)
**Objective**: Add per-player notification controls to player management interface

**Implementation Steps**:
1. **Enhance player table with notification controls** (90 minutes)
   - Add notification toggle column
   - Implement bulk notification actions
   - Create notification status badges
   - Add quick action buttons

2. **Create notification preference modal** (60 minutes)
   - Detailed per-player settings
   - Game type specific preferences
   - Time-based notification rules
   - Preview notification templates

**Files to Create/Modify**:
- `src/frontend/components/PlayerNotificationControls.ts`
- `src/frontend/components/NotificationPreferenceModal.ts`
- `src/frontend/components/BulkNotificationActions.ts`

**Success Criteria**:
- [ ] Per-player controls intuitive and accessible
- [ ] Bulk actions work efficiently
- [ ] Notification preview functionality
- [ ] Modal interface user-friendly

#### Task 10.3: Real-time Notification Status (1.5 hours)
**Objective**: Implement real-time notification status and feedback

**Implementation Steps**:
1. **Create status monitoring component** (60 minutes)
   - Real-time delivery status
   - Error notification display
   - Success confirmation messages
   - Retry attempt indicators

2. **Implement notification queue visibility** (30 minutes)
   - Show pending notifications
   - Display processing status
   - Queue priority indicators
   - Estimated delivery times

**Files to Create/Modify**:
- `src/frontend/components/NotificationStatusMonitor.ts`
- `src/frontend/components/NotificationQueue.ts`
- `src/frontend/services/realtimeNotificationService.ts`

**Success Criteria**:
- [ ] Real-time status updates working
- [ ] User feedback clear and immediate
- [ ] Queue visibility provides transparency
- [ ] Error states handled gracefully

#### Task 10.4: Notification History Interface (1 hour)
**Objective**: Create user-facing notification history and analytics

**Implementation Steps**:
1. **Build notification history table** (45 minutes)
   - Chronological notification list
   - Delivery status indicators
   - Player and game filtering
   - Pagination for large datasets

2. **Add notification analytics** (15 minutes)
   - Delivery success rate display
   - Notification frequency charts
   - Player activity correlations
   - Performance insights

**Files to Create/Modify**:
- `src/frontend/components/NotificationHistory.ts`
- `src/frontend/components/NotificationAnalytics.ts`

**Success Criteria**:
- [ ] History interface comprehensive and useful
- [ ] Analytics provide actionable insights
- [ ] Filtering and search functionality
- [ ] Performance optimized for large datasets

---

### Day 11: API Development & Integration (8 hours)

#### Task 11.1: Notification Preference API Endpoints (3 hours)
**Objective**: Create comprehensive API for notification preference management

**Implementation Steps**:
1. **Build core preference endpoints** (90 minutes)
   - GET /api/v1/users/me/notification-preferences
   - PUT /api/v1/users/me/notification-preferences
   - GET /api/v1/users/me/notification-preferences/:playerName
   - PUT /api/v1/users/me/notification-preferences/:playerName

2. **Implement bulk preference operations** (60 minutes)
   - POST /api/v1/users/me/notification-preferences/bulk
   - PUT /api/v1/users/me/notification-preferences/bulk-enable
   - PUT /api/v1/users/me/notification-preferences/bulk-disable

3. **Add preference validation and constraints** (30 minutes)
   - Input validation middleware
   - Business rule enforcement
   - Rate limiting protection
   - Error handling standardization

**API Specifications**:

```typescript
// GET /api/v1/users/me/notification-preferences
interface NotificationPreferencesResponse {
  preferences: {
    globalEnabled: boolean;
    emailNotifications: boolean;
    notificationFrequency: 'immediate' | 'digest' | 'disabled';
    quietHours: {
      enabled: boolean;
      startTime: string; // HH:MM format
      endTime: string;   // HH:MM format
      timezone: string;
    };
    players: Array<{
      playerName: string;
      enabled: boolean;
      gameTypes: {
        rapid: boolean;
        blitz: boolean;
        bullet: boolean;
        classical: boolean;
      };
      onlyRated: boolean;
      minimumRating?: number;
    }>;
  };
  statistics: {
    totalNotificationsSent: number;
    deliverySuccessRate: number;
    lastNotificationSent?: string;
    activePlayerCount: number;
  };
}

// PUT /api/v1/users/me/notification-preferences
interface UpdatePreferencesRequest {
  globalEnabled?: boolean;
  emailNotifications?: boolean;
  notificationFrequency?: 'immediate' | 'digest' | 'disabled';
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

// PUT /api/v1/users/me/notification-preferences/:playerName
interface UpdatePlayerPreferencesRequest {
  enabled: boolean;
  gameTypes?: {
    rapid?: boolean;
    blitz?: boolean;
    bullet?: boolean;
    classical?: boolean;
  };
  onlyRated?: boolean;
  minimumRating?: number;
}
```

**Files to Create/Modify**:
- `src/routes/userNotificationPreferences.ts`
- `src/services/userNotificationPreferenceService.ts`
- `src/middleware/notificationValidation.ts`

**Success Criteria**:
- [ ] All API endpoints functional and documented
- [ ] Input validation comprehensive
- [ ] Error handling consistent
- [ ] Performance optimized for concurrent users

#### Task 11.2: Notification History API (2 hours)
**Objective**: Create API endpoints for notification history and analytics

**Implementation Steps**:
1. **Build history endpoints** (90 minutes)
   - GET /api/v1/users/me/notifications/history
   - GET /api/v1/users/me/notifications/statistics
   - GET /api/v1/users/me/notifications/delivery-status/:notificationId

2. **Implement filtering and search** (30 minutes)
   - Date range filtering
   - Player name filtering
   - Delivery status filtering
   - Full-text search capabilities

**API Specifications**:

```typescript
// GET /api/v1/users/me/notifications/history
interface NotificationHistoryResponse {
  notifications: Array<{
    id: string;
    playerName: string;
    type: 'game_started' | 'game_ended';
    sentAt: string;
    deliveryStatus: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
    gameDetails?: {
      timeControl: string;
      gameType: string;
      rated: boolean;
      gameUrl: string;
    };
    deliveredAt?: string;
    errorMessage?: string;
  }>;
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// GET /api/v1/users/me/notifications/statistics
interface NotificationStatisticsResponse {
  overview: {
    totalSent: number;
    totalDelivered: number;
    deliveryRate: number;
    averageDeliveryTime: number; // seconds
  };
  trends: {
    daily: Array<{
      date: string;
      sent: number;
      delivered: number;
    }>;
    byPlayer: Array<{
      playerName: string;
      notificationCount: number;
      deliveryRate: number;
    }>;
  };
  errors: Array<{
    errorType: string;
    count: number;
    lastOccurred: string;
  }>;
}
```

**Files to Create/Modify**:
- `src/routes/notificationHistory.ts`
- `src/services/notificationHistoryService.ts`
- `src/services/notificationStatisticsService.ts`

**Success Criteria**:
- [ ] History API provides comprehensive data
- [ ] Statistics API offers actionable insights
- [ ] Filtering and search work efficiently
- [ ] Pagination handles large datasets

#### Task 11.3: Unsubscribe System API (2 hours)
**Objective**: Implement comprehensive unsubscribe and preference management system

**Implementation Steps**:
1. **Create unsubscribe endpoints** (90 minutes)
   - POST /api/v1/unsubscribe/token/:token
   - GET /api/v1/unsubscribe/preferences/:token
   - PUT /api/v1/unsubscribe/preferences/:token
   - POST /api/v1/unsubscribe/complete/:token

2. **Implement secure token generation** (30 minutes)
   - One-time use unsubscribe tokens
   - Token expiration (7 days)
   - Email verification integration
   - Audit trail for unsubscribe actions

**API Specifications**:

```typescript
// POST /api/v1/unsubscribe/token/:token
interface UnsubscribeResponse {
  success: boolean;
  message: string;
  preferences?: {
    email: string;
    playersToUnsubscribe: string[];
    globalUnsubscribe: boolean;
  };
}

// PUT /api/v1/unsubscribe/preferences/:token
interface UpdateUnsubscribePreferencesRequest {
  globalUnsubscribe?: boolean;
  playersToUnsubscribe?: string[];
  partialUnsubscribe?: {
    disableEmailNotifications?: boolean;
    changeToDigestMode?: boolean;
  };
}
```

**Files to Create/Modify**:
- `src/routes/unsubscribe.ts`
- `src/services/unsubscribeService.ts`
- `src/utils/unsubscribeTokenGenerator.ts`

**Success Criteria**:
- [ ] Unsubscribe system compliant with regulations
- [ ] Token security prevents abuse
- [ ] Granular unsubscribe options available
- [ ] Audit trail complete and accessible

#### Task 11.4: API Integration Testing (1 hour)
**Objective**: Create comprehensive API integration tests

**Implementation Steps**:
1. **Test all notification preference endpoints** (45 minutes)
   - CRUD operations validation
   - Error scenario testing
   - Performance benchmarking
   - Security testing

2. **Test unsubscribe system** (15 minutes)
   - Token generation and validation
   - Preference modification testing
   - Compliance verification
   - Audit trail validation

**Files to Create/Modify**:
- `tests/api/notificationPreferences.test.ts`
- `tests/api/notificationHistory.test.ts`
- `tests/api/unsubscribe.test.ts`

**Success Criteria**:
- [ ] All API tests pass consistently
- [ ] Error scenarios properly handled
- [ ] Performance benchmarks met
- [ ] Security tests validate protection

---

### Day 12: Frontend Implementation & Testing (8 hours)

#### Task 12.1: Frontend Component Development (3.5 hours)
**Objective**: Implement reactive frontend components for notification management

**Implementation Steps**:
1. **Build main notification settings component** (120 minutes)
   - Global notification toggles
   - Quiet hours configuration
   - Email preference settings
   - Real-time validation feedback

2. **Create player-specific controls** (90 minutes)
   - Per-player notification toggles
   - Game type filtering options
   - Rating threshold settings
   - Bulk action controls

**Component Specifications**:

```typescript
// NotificationSettings Component
interface NotificationSettingsProps {
  userId: string;
  initialPreferences: NotificationPreferences;
  onPreferenceChange: (preferences: Partial<NotificationPreferences>) => void;
  onError: (error: string) => void;
}

class NotificationSettings {
  private preferences: NotificationPreferences;
  private apiService: NotificationApiService;
  private uiState: {
    loading: boolean;
    error: string | null;
    unsavedChanges: boolean;
  };

  constructor(props: NotificationSettingsProps) {
    this.preferences = props.initialPreferences;
    this.apiService = new NotificationApiService();
    this.uiState = {
      loading: false,
      error: null,
      unsavedChanges: false
    };
  }

  async updateGlobalPreferences(updates: Partial<GlobalPreferences>): Promise<void> {
    this.uiState.loading = true;
    try {
      const updatedPreferences = await this.apiService.updateGlobalPreferences(updates);
      this.preferences = { ...this.preferences, ...updatedPreferences };
      this.uiState.unsavedChanges = false;
      this.render();
    } catch (error) {
      this.uiState.error = error.message;
      this.render();
    } finally {
      this.uiState.loading = false;
    }
  }

  async updatePlayerPreferences(playerName: string, updates: PlayerPreferences): Promise<void> {
    this.uiState.loading = true;
    try {
      await this.apiService.updatePlayerPreferences(playerName, updates);
      const playerIndex = this.preferences.players.findIndex(p => p.playerName === playerName);
      if (playerIndex !== -1) {
        this.preferences.players[playerIndex] = { ...this.preferences.players[playerIndex], ...updates };
      }
      this.render();
    } catch (error) {
      this.uiState.error = error.message;
      this.render();
    } finally {
      this.uiState.loading = false;
    }
  }

  render(): void {
    // Update DOM with current state
  }
}

// PlayerNotificationControls Component
interface PlayerNotificationControlsProps {
  players: Array<PlayerWithNotificationSettings>;
  onBulkAction: (action: BulkNotificationAction) => void;
  onPlayerUpdate: (playerName: string, preferences: PlayerPreferences) => void;
}

class PlayerNotificationControls {
  private selectedPlayers: Set<string>;
  private filterOptions: {
    showOnlyEnabled: boolean;
    gameTypeFilter: GameType | 'all';
    sortBy: 'name' | 'notifications' | 'activity';
  };

  async performBulkAction(action: BulkNotificationAction): Promise<void> {
    const selectedPlayerNames = Array.from(this.selectedPlayers);
    if (selectedPlayerNames.length === 0) {
      throw new Error('No players selected');
    }

    const confirmation = await this.showConfirmationDialog(action, selectedPlayerNames);
    if (!confirmation) return;

    try {
      await this.apiService.bulkUpdatePlayerPreferences(selectedPlayerNames, action);
      this.selectedPlayers.clear();
      this.render();
    } catch (error) {
      this.showErrorMessage(error.message);
    }
  }

  private showConfirmationDialog(action: BulkNotificationAction, players: string[]): Promise<boolean> {
    // Implementation for confirmation modal
  }

  private showErrorMessage(message: string): void {
    // Implementation for error display
  }
}
```

**Files to Create/Modify**:
- `src/frontend/components/NotificationSettings.ts`
- `src/frontend/components/PlayerNotificationControls.ts`
- `src/frontend/components/NotificationToggle.ts`
- `src/frontend/components/QuietHoursSettings.ts`

**Success Criteria**:
- [ ] Components responsive and intuitive
- [ ] Real-time updates without page refresh
- [ ] Error handling provides clear feedback
- [ ] Bulk operations work efficiently

#### Task 12.2: Unsubscribe Page Implementation (2 hours)
**Objective**: Create user-friendly unsubscribe management page

**Implementation Steps**:
1. **Build unsubscribe landing page** (90 minutes)
   - Token validation and user identification
   - Current subscription display
   - Granular unsubscribe options
   - Alternative preference modifications

2. **Create preference management interface** (30 minutes)
   - Reduce notification frequency option
   - Selective player unsubscribe
   - Re-subscribe functionality
   - Email address change options

**Page Specifications**:

```html
<!-- Unsubscribe Management Page Template -->
<div class="unsubscribe-page">
  <div class="header">
    <h1>Manage Your Notification Preferences</h1>
    <p class="subtitle">We're sorry to see you go! Before you unsubscribe completely, 
       would you like to adjust your notification settings instead?</p>
  </div>

  <div class="current-settings">
    <h2>Your Current Settings</h2>
    <div class="settings-summary">
      <div class="setting-item">
        <span class="label">Email Notifications:</span>
        <span class="value enabled">Enabled</span>
      </div>
      <div class="setting-item">
        <span class="label">Followed Players:</span>
        <span class="value">{{playerCount}} players</span>
      </div>
      <div class="setting-item">
        <span class="label">Notifications This Week:</span>
        <span class="value">{{weeklyCount}} emails</span>
      </div>
    </div>
  </div>

  <div class="adjustment-options">
    <h2>Quick Adjustments</h2>
    <div class="option-cards">
      <div class="option-card">
        <h3>🔕 Reduce Frequency</h3>
        <p>Get digest emails instead of individual notifications</p>
        <button class="btn btn-primary" onclick="setDigestMode()">
          Switch to Daily Digest
        </button>
      </div>
      
      <div class="option-card">
        <h3>🎯 Selective Unsubscribe</h3>
        <p>Keep notifications for some players, remove others</p>
        <button class="btn btn-secondary" onclick="showPlayerSelection()">
          Choose Players
        </button>
      </div>
      
      <div class="option-card">
        <h3>⏰ Set Quiet Hours</h3>
        <p>Pause notifications during specific times</p>
        <button class="btn btn-secondary" onclick="showQuietHours()">
          Configure Hours
        </button>
      </div>
    </div>
  </div>

  <div class="unsubscribe-section">
    <h2>Complete Unsubscribe</h2>
    <p>If you still prefer to unsubscribe completely:</p>
    <div class="unsubscribe-options">
      <label class="checkbox-label">
        <input type="checkbox" id="unsubscribe-all">
        <span>Unsubscribe from all Chess.com Helper notifications</span>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" id="delete-account">
        <span>Delete my account and all data</span>
      </label>
    </div>
    <button class="btn btn-danger" onclick="completeUnsubscribe()">
      Confirm Unsubscribe
    </button>
  </div>

  <div class="feedback-section">
    <h3>Help us improve</h3>
    <p>Could you tell us why you're unsubscribing?</p>
    <textarea id="feedback" placeholder="Your feedback helps us improve..."></textarea>
    <button class="btn btn-outline" onclick="submitFeedback()">
      Send Feedback
    </button>
  </div>
</div>
```

**Files to Create/Modify**:
- `src/frontend/pages/unsubscribe.html`
- `src/frontend/components/UnsubscribeManager.ts`
- `src/frontend/components/PlayerSelectionModal.ts`
- `src/frontend/styles/unsubscribe.css`

**Success Criteria**:
- [ ] Unsubscribe process user-friendly and compliant
- [ ] Alternative options reduce full unsubscribes
- [ ] Feedback collection helps product improvement
- [ ] Token security prevents unauthorized access

#### Task 12.3: Mobile Optimization & Responsive Design (1.5 hours)
**Objective**: Ensure all notification interfaces work perfectly on mobile devices

**Implementation Steps**:
1. **Optimize notification settings for mobile** (60 minutes)
   - Touch-friendly toggle switches
   - Collapsible sections for better navigation
   - Mobile-optimized modal dialogs
   - Gesture support for bulk actions

2. **Test cross-device compatibility** (30 minutes)
   - iOS Safari testing
   - Android Chrome testing
   - Tablet landscape/portrait modes
   - Progressive Web App considerations

**Mobile Optimization Specifications**:

```css
/* Mobile-First Responsive Design */
.notification-settings {
  padding: 16px;
  font-size: 16px; /* Prevents zoom on iOS */
}

/* Touch-friendly toggles */
.notification-toggle {
  min-height: 44px; /* iOS minimum touch target */
  min-width: 44px;
  touch-action: manipulation;
}

/* Mobile navigation */
@media (max-width: 768px) {
  .settings-navigation {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #e1e5e9;
    padding: 8px 16px;
    z-index: 1000;
  }
  
  .settings-content {
    padding-bottom: 80px; /* Space for fixed navigation */
  }
  
  .player-controls-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  
  .bulk-actions {
    position: sticky;
    top: 0;
    background: white;
    z-index: 100;
    border-bottom: 1px solid #e1e5e9;
  }
}

/* PWA optimizations */
@media (display-mode: standalone) {
  .notification-settings {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

**Files to Create/Modify**:
- `src/frontend/styles/mobile-notifications.css`
- `src/frontend/components/MobileNotificationControls.ts`
- `src/frontend/utils/mobileOptimization.ts`

**Success Criteria**:
- [ ] All interfaces work perfectly on mobile
- [ ] Touch interactions feel natural
- [ ] Loading states prevent user confusion
- [ ] Offline functionality where appropriate

#### Task 12.4: Comprehensive UI Testing (1 hour)
**Objective**: Create thorough testing suite for all UI components

**Implementation Steps**:
1. **Component unit tests** (45 minutes)
   - Test notification toggle functionality
   - Validate preference persistence
   - Test bulk action operations
   - Verify error handling

2. **Integration tests** (15 minutes)
   - End-to-end notification preference flows
   - Unsubscribe process testing
   - Mobile interface testing
   - Cross-browser compatibility

**Testing Specifications**:

```typescript
// Component Testing Framework
describe('NotificationSettings Component', () => {
  let component: NotificationSettings;
  let mockApiService: jest.Mocked<NotificationApiService>;

  beforeEach(() => {
    mockApiService = createMockApiService();
    component = new NotificationSettings({
      userId: 'test-user',
      initialPreferences: createTestPreferences(),
      onPreferenceChange: jest.fn(),
      onError: jest.fn()
    });
  });

  describe('Global Preference Updates', () => {
    it('should update global email notifications preference', async () => {
      mockApiService.updateGlobalPreferences.mockResolvedValue({
        emailNotifications: false
      });

      await component.updateGlobalPreferences({ emailNotifications: false });

      expect(component.preferences.emailNotifications).toBe(false);
      expect(mockApiService.updateGlobalPreferences).toHaveBeenCalledWith({
        emailNotifications: false
      });
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to update preferences';
      mockApiService.updateGlobalPreferences.mockRejectedValue(new Error(errorMessage));

      await component.updateGlobalPreferences({ emailNotifications: false });

      expect(component.uiState.error).toBe(errorMessage);
      expect(component.preferences.emailNotifications).toBe(true); // Should remain unchanged
    });

    it('should show loading state during updates', async () => {
      let resolvePromise: Function;
      const promise = new Promise(resolve => { resolvePromise = resolve; });
      mockApiService.updateGlobalPreferences.mockReturnValue(promise);

      const updatePromise = component.updateGlobalPreferences({ emailNotifications: false });
      
      expect(component.uiState.loading).toBe(true);
      
      resolvePromise({ emailNotifications: false });
      await updatePromise;
      
      expect(component.uiState.loading).toBe(false);
    });
  });

  describe('Player Preference Updates', () => {
    it('should update individual player preferences', async () => {
      const playerName = 'magnus';
      const updates = { enabled: false, onlyRated: true };
      
      mockApiService.updatePlayerPreferences.mockResolvedValue(undefined);

      await component.updatePlayerPreferences(playerName, updates);

      const updatedPlayer = component.preferences.players.find(p => p.playerName === playerName);
      expect(updatedPlayer?.enabled).toBe(false);
      expect(updatedPlayer?.onlyRated).toBe(true);
    });

    it('should validate player preferences before saving', async () => {
      const invalidUpdates = { minimumRating: -100 }; // Invalid rating

      await expect(component.updatePlayerPreferences('magnus', invalidUpdates))
        .rejects.toThrow('Invalid minimum rating');
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk enable operation', async () => {
      const selectedPlayers = ['magnus', 'hikaru', 'fabiano'];
      mockApiService.bulkUpdatePlayerPreferences.mockResolvedValue(undefined);

      await component.performBulkAction('enable', selectedPlayers);

      expect(mockApiService.bulkUpdatePlayerPreferences).toHaveBeenCalledWith(
        selectedPlayers,
        { enabled: true }
      );
    });

    it('should require confirmation for bulk disable', async () => {
      const selectedPlayers = ['magnus', 'hikaru'];
      const confirmSpy = jest.spyOn(component, 'showConfirmationDialog')
        .mockResolvedValue(false);

      await component.performBulkAction('disable', selectedPlayers);

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockApiService.bulkUpdatePlayerPreferences).not.toHaveBeenCalled();
    });
  });
});

// E2E Testing
describe('Notification Preferences E2E', () => {
  it('should allow user to manage notification preferences end-to-end', async () => {
    // Navigate to notification settings
    await page.goto('/dashboard#notifications');
    await page.waitForSelector('.notification-settings');

    // Disable global notifications
    await page.click('#global-notifications-toggle');
    await page.waitForSelector('.success-message');

    // Verify API call was made
    const apiCalls = await page.evaluate(() => window.testApiCalls);
    expect(apiCalls.some(call => 
      call.url.includes('notification-preferences') && 
      call.method === 'PUT'
    )).toBe(true);

    // Enable notifications for specific player
    await page.click('#player-magnus .notification-toggle');
    await page.waitForSelector('.player-preferences-updated');

    // Test bulk operations
    await page.click('#select-all-players');
    await page.click('#bulk-disable-btn');
    await page.click('#confirm-bulk-action');
    await page.waitForSelector('.bulk-action-completed');

    // Verify final state
    const finalPreferences = await page.evaluate(() => 
      window.currentNotificationPreferences
    );
    expect(finalPreferences.globalEnabled).toBe(false);
  });

  it('should handle unsubscribe flow correctly', async () => {
    const unsubscribeToken = 'test-unsubscribe-token';
    await page.goto(`/unsubscribe/${unsubscribeToken}`);

    // Should show current preferences
    await page.waitForSelector('.current-settings');
    
    // Test partial unsubscribe
    await page.click('#reduce-frequency-btn');
    await page.waitForSelector('.digest-mode-enabled');

    // Test complete unsubscribe
    await page.click('#complete-unsubscribe-btn');
    await page.click('#confirm-unsubscribe');
    await page.waitForSelector('.unsubscribe-success');

    // Verify user is unsubscribed
    const apiCalls = await page.evaluate(() => window.testApiCalls);
    expect(apiCalls.some(call => 
      call.url.includes('unsubscribe/complete') && 
      call.method === 'POST'
    )).toBe(true);
  });
});
```

**Files to Create/Modify**:
- `tests/frontend/components/NotificationSettings.test.ts`
- `tests/frontend/components/PlayerNotificationControls.test.ts`
- `tests/e2e/notificationPreferences.test.ts`
- `tests/e2e/unsubscribe.test.ts`

**Success Criteria**:
- [ ] All component tests pass consistently
- [ ] E2E tests cover complete user flows
- [ ] Performance tests validate loading times
- [ ] Accessibility tests ensure compliance

---

## 🎨 User Interface Design Specifications

### Dashboard Integration Layout

```html
<!-- Enhanced Dashboard with Notification Controls -->
<div class="dashboard-container">
  <!-- Existing Dashboard Header -->
  <div class="dashboard-header">
    <h1>Chess.com Helper Dashboard</h1>
    <div class="header-actions">
      <!-- Existing actions -->
      <button class="notification-settings-btn" onclick="openNotificationSettings()">
        <span class="icon">🔔</span>
        <span class="text">Notifications</span>
        <span class="badge" id="notification-count">3</span>
      </button>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="dashboard-nav">
    <button class="nav-tab active" data-tab="players">Players</button>
    <button class="nav-tab" data-tab="notifications">Notifications</button>
    <button class="nav-tab" data-tab="history">History</button>
  </div>

  <!-- Players Tab (Enhanced) -->
  <div class="tab-content" id="players-tab">
    <div class="players-header">
      <h2>Followed Players</h2>
      <div class="bulk-notification-controls">
        <select id="bulk-notification-action">
          <option value="">Bulk Actions</option>
          <option value="enable-all">Enable All Notifications</option>
          <option value="disable-all">Disable All Notifications</option>
          <option value="digest-mode">Switch to Digest Mode</option>
        </select>
        <button class="btn btn-secondary" onclick="performBulkNotificationAction()">
          Apply
        </button>
      </div>
    </div>

    <div class="players-table-wrapper">
      <table class="players-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all-players"></th>
            <th>Player</th>
            <th>Status</th>
            <th>Last Game</th>
            <th>Notifications</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <!-- Player rows with notification controls -->
          <tr class="player-row" data-player="magnus">
            <td><input type="checkbox" class="player-select"></td>
            <td>
              <div class="player-info">
                <img src="/avatars/magnus.png" alt="Magnus Carlsen" class="player-avatar">
                <div class="player-details">
                  <strong>Magnus Carlsen</strong>
                  <span class="player-rating">2830</span>
                </div>
              </div>
            </td>
            <td>
              <span class="status-badge online">🟢 Online</span>
            </td>
            <td>
              <span class="last-game">2 hours ago</span>
            </td>
            <td>
              <div class="notification-controls">
                <label class="notification-toggle">
                  <input type="checkbox" checked class="notification-enabled">
                  <span class="toggle-slider"></span>
                </label>
                <button class="btn btn-sm btn-outline" onclick="openPlayerNotificationSettings('magnus')">
                  ⚙️ Settings
                </button>
              </div>
            </td>
            <td>
              <div class="player-actions">
                <button class="btn btn-sm btn-primary" onclick="viewPlayerProfile('magnus')">
                  View Profile
                </button>
                <button class="btn btn-sm btn-outline" onclick="removePlayer('magnus')">
                  Remove
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Notifications Tab (New) -->
  <div class="tab-content hidden" id="notifications-tab">
    <div class="notification-settings-panel">
      <h2>Notification Settings</h2>
      
      <!-- Global Settings -->
      <div class="settings-section">
        <h3>Global Preferences</h3>
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-text">Email Notifications</span>
            <label class="toggle-switch">
              <input type="checkbox" id="global-email-notifications" checked>
              <span class="toggle-slider"></span>
            </label>
          </label>
          <p class="setting-description">
            Receive email notifications when followed players start games
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">
            <span class="label-text">Notification Frequency</span>
            <select id="notification-frequency">
              <option value="immediate">Immediate</option>
              <option value="digest">Daily Digest</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <p class="setting-description">
            Choose how often you want to receive notifications
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">
            <span class="label-text">Quiet Hours</span>
            <label class="toggle-switch">
              <input type="checkbox" id="quiet-hours-enabled">
              <span class="toggle-slider"></span>
            </label>
          </label>
          <div class="quiet-hours-config" id="quiet-hours-config" style="display: none;">
            <div class="time-range">
              <label>
                From: <input type="time" id="quiet-start" value="23:00">
              </label>
              <label>
                To: <input type="time" id="quiet-end" value="08:00">
              </label>
            </div>
            <label>
              Timezone: 
              <select id="quiet-timezone">
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">GMT</option>
                <option value="auto">Auto-detect</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <!-- Notification Types -->
      <div class="settings-section">
        <h3>Notification Types</h3>
        <div class="notification-types-grid">
          <div class="notification-type-card">
            <div class="card-header">
              <span class="type-icon">🎮</span>
              <h4>Game Started</h4>
            </div>
            <div class="card-body">
              <p>Get notified when followed players start new games</p>
              <label class="toggle-switch">
                <input type="checkbox" id="notify-game-started" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="notification-type-card">
            <div class="card-header">
              <span class="type-icon">🏁</span>
              <h4>Game Ended</h4>
            </div>
            <div class="card-body">
              <p>Get notified when followed players finish games</p>
              <label class="toggle-switch">
                <input type="checkbox" id="notify-game-ended">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="notification-type-card disabled">
            <div class="card-header">
              <span class="type-icon">🏆</span>
              <h4>Tournaments</h4>
            </div>
            <div class="card-body">
              <p>Get notified about tournament participation</p>
              <span class="coming-soon">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Actions -->
      <div class="settings-actions">
        <button class="btn btn-primary" onclick="saveNotificationSettings()">
          Save Settings
        </button>
        <button class="btn btn-outline" onclick="resetNotificationSettings()">
          Reset to Defaults
        </button>
      </div>
    </div>
  </div>

  <!-- History Tab (Enhanced) -->
  <div class="tab-content hidden" id="history-tab">
    <div class="notification-history-panel">
      <h2>Notification History</h2>
      
      <!-- History Filters -->
      <div class="history-filters">
        <div class="filter-group">
          <label>Date Range:</label>
          <input type="date" id="history-start-date">
          <span>to</span>
          <input type="date" id="history-end-date">
        </div>
        <div class="filter-group">
          <label>Player:</label>
          <select id="history-player-filter">
            <option value="">All Players</option>
            <option value="magnus">Magnus Carlsen</option>
            <option value="hikaru">Hikaru Nakamura</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Status:</label>
          <select id="history-status-filter">
            <option value="">All Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <button class="btn btn-secondary" onclick="applyHistoryFilters()">
          Apply Filters
        </button>
      </div>

      <!-- History Statistics -->
      <div class="history-stats">
        <div class="stat-card">
          <h3>98.5%</h3>
          <p>Delivery Rate</p>
        </div>
        <div class="stat-card">
          <h3>247</h3>
          <p>Total Sent</p>
        </div>
        <div class="stat-card">
          <h3>1.2s</h3>
          <p>Avg Delivery Time</p>
        </div>
      </div>

      <!-- History Table -->
      <div class="history-table-wrapper">
        <table class="history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Player</th>
              <th>Type</th>
              <th>Status</th>
              <th>Delivery Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="history-table-body">
            <!-- History rows populated by JavaScript -->
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="history-pagination">
        <button class="btn btn-outline" onclick="loadHistoryPage('prev')">
          ← Previous
        </button>
        <span class="page-info">Page 1 of 12</span>
        <button class="btn btn-outline" onclick="loadHistoryPage('next')">
          Next →
        </button>
      </div>
    </div>
  </div>
</div>
```

### CSS Styling Framework

```css
/* Notification Settings Styling */
.notification-settings-btn {
  position: relative;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.notification-settings-btn:hover {
  background: var(--bg-hover);
  border-color: var(--primary-green);
}

.notification-settings-btn .badge {
  background: var(--error-red);
  color: white;
  border-radius: 50%;
  min-width: 18px;
  height: 18px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

/* Toggle Switch Components */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

input:checked + .toggle-slider {
  background-color: var(--primary-green);
}

input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

/* Notification Type Cards */
.notification-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.notification-type-card {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  background: white;
  transition: all 0.2s ease;
}

.notification-type-card:hover {
  border-color: var(--primary-green);
  box-shadow: 0 4px 12px rgba(118, 150, 86, 0.1);
}

.notification-type-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.notification-type-card .card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.notification-type-card .type-icon {
  font-size: 24px;
}

.notification-type-card h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
}

.notification-type-card .card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-type-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  flex: 1;
}

.coming-soon {
  background: var(--warning-amber);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

/* History Statistics */
.history-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.stat-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 700;
  color: var(--primary-green);
}

.stat-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .dashboard-nav {
    display: flex;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid var(--border-color);
  }

  .nav-tab {
    flex: 0 0 auto;
    padding: 12px 20px;
    white-space: nowrap;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s ease;
  }

  .nav-tab.active {
    color: var(--primary-green);
    border-bottom-color: var(--primary-green);
  }

  .notification-types-grid {
    grid-template-columns: 1fr;
  }

  .history-stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .history-filters {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .players-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .players-table {
    min-width: 800px;
  }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
    --border-color: #404040;
  }

  .notification-type-card,
  .stat-card {
    background: var(--bg-secondary);
    border-color: var(--border-color);
  }

  .toggle-slider {
    background-color: #555;
  }

  .toggle-slider:before {
    background-color: #f1f1f1;
  }
}
```

---

## 🔧 API Implementation Details

### Complete API Endpoint Specifications

#### Notification Preferences Management

```typescript
// src/routes/userNotificationPreferences.ts
import { Router } from 'itty-router';
import { authenticateRequest } from '../middleware/auth';
import { validateNotificationPreferences } from '../middleware/validation';
import { 
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  updatePlayerNotificationPreferences,
  bulkUpdatePlayerNotificationPreferences
} from '../services/userNotificationPreferenceService';

const router = Router({ base: '/api/v1/users/me/notification-preferences' });

// GET /api/v1/users/me/notification-preferences
router.get('/', authenticateRequest, async (request: Request, env: Env) => {
  try {
    const userId = request.user.id;
    const preferences = await getUserNotificationPreferences(env.DB, userId);
    
    return new Response(JSON.stringify({
      preferences,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch notification preferences',
      success: false
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// PUT /api/v1/users/me/notification-preferences
router.put('/', authenticateRequest, validateNotificationPreferences, async (request: Request, env: Env) => {
  try {
    const userId = request.user.id;
    const updates = await request.json();
    
    const updatedPreferences = await updateUserNotificationPreferences(
      env.DB, 
      userId, 
      updates
    );
    
    return new Response(JSON.stringify({
      preferences: updatedPreferences,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update notification preferences',
      success: false
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// GET /api/v1/users/me/notification-preferences/:playerName
router.get('/:playerName', authenticateRequest, async (request: Request, env: Env) => {
  try {
    const userId = request.user.id;
    const { playerName } = request.params;
    
    const playerPreferences = await getPlayerNotificationPreferences(
      env.DB, 
      userId, 
      playerName
    );
    
    if (!playerPreferences) {
      return new Response(JSON.stringify({
        error: 'Player preferences not found',
        success: false
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404
      });
    }
    
    return new Response(JSON.stringify({
      preferences: playerPreferences,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Get player notification preferences error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch player notification preferences',
      success: false
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// PUT /api/v1/users/me/notification-preferences/:playerName
router.put('/:playerName', authenticateRequest, async (request: Request, env: Env) => {
  try {
    const userId = request.user.id;
    const { playerName } = request.params;
    const updates = await request.json();
    
    const updatedPreferences = await updatePlayerNotificationPreferences(
      env.DB,
      userId,
      playerName,
      updates
    );
    
    return new Response(JSON.stringify({
      preferences: updatedPreferences,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Update player notification preferences error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update player notification preferences',
      success: false
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// POST /api/v1/users/me/notification-preferences/bulk
router.post('/bulk', authenticateRequest, async (request: Request, env: Env) => {
  try {
    const userId = request.user.id;
    const { playerNames, action, preferences } = await request.json();
    
    if (!playerNames || !Array.isArray(playerNames) || playerNames.length === 0) {
      return new Response(JSON.stringify({
        error: 'Player names are required',
        success: false
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    const results = await bulkUpdatePlayerNotificationPreferences(
      env.DB,
      userId,
      playerNames,
      action,
      preferences
    );
    
    return new Response(JSON.stringify({
      results,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Bulk update notification preferences error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to perform bulk update',
      success: false
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

export { router as userNotificationPreferencesRoutes };
```

#### Service Implementation

```typescript
// src/services/userNotificationPreferenceService.ts
import { generateSecureId } from '../utils/crypto';
import { createApiError } from '../utils/errors';

export interface UserNotificationPreferences {
  globalEnabled: boolean;
  emailNotifications: boolean;
  notificationFrequency: 'immediate' | 'digest' | 'disabled';
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  players: PlayerNotificationPreferences[];
  statistics: {
    totalNotificationsSent: number;
    deliverySuccessRate: number;
    lastNotificationSent?: string;
    activePlayerCount: number;
  };
}

export interface PlayerNotificationPreferences {
  playerName: string;
  enabled: boolean;
  gameTypes: {
    rapid: boolean;
    blitz: boolean;
    bullet: boolean;
    classical: boolean;
  };
  onlyRated: boolean;
  minimumRating?: number;
  lastNotificationSent?: string;
  notificationCount: number;
}

export async function getUserNotificationPreferences(
  db: D1Database,
  userId: string
): Promise<UserNotificationPreferences> {
  try {
    // Get global user preferences
    const globalPrefs = await db.prepare(`
      SELECT 
        notifications_enabled as global_enabled,
        email_notifications,
        notification_frequency,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        quiet_hours_timezone
      FROM user_preferences 
      WHERE user_id = ?
    `).bind(userId).first();

    if (!globalPrefs) {
      throw createApiError('User preferences not found', 404, 'USER_PREFERENCES_NOT_FOUND');
    }

    // Get player-specific preferences
    const playerPrefs = await db.prepare(`
      SELECT 
        ps.chess_com_username as player_name,
        ps.notifications_enabled as enabled,
        COALESCE(pnp.game_type_rapid, 1) as rapid,
        COALESCE(pnp.game_type_blitz, 1) as blitz,
        COALESCE(pnp.game_type_bullet, 1) as bullet,
        COALESCE(pnp.game_type_classical, 1) as classical,
        COALESCE(pnp.only_rated, 0) as only_rated,
        pnp.minimum_rating,
        COUNT(nl.id) as notification_count,
        MAX(nl.sent_at) as last_notification_sent
      FROM player_subscriptions ps
      LEFT JOIN player_notification_preferences pnp ON ps.id = pnp.subscription_id
      LEFT JOIN notification_log nl ON ps.user_id = nl.user_id AND ps.chess_com_username = nl.chess_com_username
      WHERE ps.user_id = ?
      GROUP BY ps.id, ps.chess_com_username, ps.notifications_enabled, pnp.game_type_rapid, 
               pnp.game_type_blitz, pnp.game_type_bullet, pnp.game_type_classical, 
               pnp.only_rated, pnp.minimum_rating
      ORDER BY ps.chess_com_username
    `).bind(userId).all();

    // Get notification statistics
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        AVG(CASE WHEN email_delivered = 1 THEN 1.0 ELSE 0.0 END) * 100 as delivery_rate,
        MAX(sent_at) as last_sent
      FROM notification_log 
      WHERE user_id = ?
    `).bind(userId).first();

    const players: PlayerNotificationPreferences[] = (playerPrefs.results || []).map(row => ({
      playerName: row.player_name as string,
      enabled: Boolean(row.enabled),
      gameTypes: {
        rapid: Boolean(row.rapid),
        blitz: Boolean(row.blitz),
        bullet: Boolean(row.bullet),
        classical: Boolean(row.classical)
      },
      onlyRated: Boolean(row.only_rated),
      minimumRating: row.minimum_rating as number | undefined,
      lastNotificationSent: row.last_notification_sent as string | undefined,
      notificationCount: row.notification_count as number
    }));

    return {
      globalEnabled: Boolean(globalPrefs.global_enabled),
      emailNotifications: Boolean(globalPrefs.email_notifications),
      notificationFrequency: globalPrefs.notification_frequency as 'immediate' | 'digest' | 'disabled',
      quietHours: {
        enabled: Boolean(globalPrefs.quiet_hours_enabled),
        startTime: globalPrefs.quiet_hours_start as string || '23:00',
        endTime: globalPrefs.quiet_hours_end as string || '08:00',
        timezone: globalPrefs.quiet_hours_timezone as string || 'auto'
      },
      players,
      statistics: {
        totalNotificationsSent: stats?.total_sent as number || 0,
        deliverySuccessRate: stats?.delivery_rate as number || 0,
        lastNotificationSent: stats?.last_sent as string | undefined,
        activePlayerCount: players.filter(p => p.enabled).length
      }
    };
  } catch (error) {
    console.error('Error fetching user notification preferences:', error);
    throw createApiError('Failed to fetch notification preferences', 500, 'NOTIFICATION_PREFERENCES_ERROR', error);
  }
}

export async function updateUserNotificationPreferences(
  db: D1Database,
  userId: string,
  updates: Partial<UserNotificationPreferences>
): Promise<UserNotificationPreferences> {
  try {
    // Validate updates
    if (updates.notificationFrequency && !['immediate', 'digest', 'disabled'].includes(updates.notificationFrequency)) {
      throw createApiError('Invalid notification frequency', 400, 'INVALID_NOTIFICATION_FREQUENCY');
    }

    // Build update query
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.globalEnabled !== undefined) {
      updateFields.push('notifications_enabled = ?');
      values.push(updates.globalEnabled);
    }

    if (updates.emailNotifications !== undefined) {
      updateFields.push('email_notifications = ?');
      values.push(updates.emailNotifications);
    }

    if (updates.notificationFrequency !== undefined) {
      updateFields.push('notification_frequency = ?');
      values.push(updates.notificationFrequency);
    }

    if (updates.quietHours) {
      if (updates.quietHours.enabled !== undefined) {
        updateFields.push('quiet_hours_enabled = ?');
        values.push(updates.quietHours.enabled);
      }
      if (updates.quietHours.startTime) {
        updateFields.push('quiet_hours_start = ?');
        values.push(updates.quietHours.startTime);
      }
      if (updates.quietHours.endTime) {
        updateFields.push('quiet_hours_end = ?');
        values.push(updates.quietHours.endTime);
      }
      if (updates.quietHours.timezone) {
        updateFields.push('quiet_hours_timezone = ?');
        values.push(updates.quietHours.timezone);
      }
    }

    if (updateFields.length > 0) {
      values.push(userId);
      await db.prepare(`
        UPDATE user_preferences 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(...values).run();
    }

    // Return updated preferences
    return await getUserNotificationPreferences(db, userId);
  } catch (error) {
    console.error('Error updating user notification preferences:', error);
    throw createApiError('Failed to update notification preferences', 500, 'NOTIFICATION_PREFERENCES_UPDATE_ERROR', error);
  }
}

export async function updatePlayerNotificationPreferences(
  db: D1Database,
  userId: string,
  playerName: string,
  updates: Partial<PlayerNotificationPreferences>
): Promise<PlayerNotificationPreferences> {
  try {
    // Verify player subscription exists
    const subscription = await db.prepare(`
      SELECT id FROM player_subscriptions 
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(userId, playerName).first();

    if (!subscription) {
      throw createApiError('Player subscription not found', 404, 'PLAYER_SUBSCRIPTION_NOT_FOUND');
    }

    // Update subscription notification status
    if (updates.enabled !== undefined) {
      await db.prepare(`
        UPDATE player_subscriptions 
        SET notifications_enabled = ?
        WHERE user_id = ? AND chess_com_username = ?
      `).bind(updates.enabled, userId, playerName).run();
    }

    // Update or create player notification preferences
    if (updates.gameTypes || updates.onlyRated !== undefined || updates.minimumRating !== undefined) {
      const preferenceId = await generateSecureId();
      
      await db.prepare(`
        INSERT INTO player_notification_preferences 
        (id, subscription_id, game_type_rapid, game_type_blitz, game_type_bullet, 
         game_type_classical, only_rated, minimum_rating)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subscription_id) DO UPDATE SET
          game_type_rapid = COALESCE(excluded.game_type_rapid, game_type_rapid),
          game_type_blitz = COALESCE(excluded.game_type_blitz, game_type_blitz),
          game_type_bullet = COALESCE(excluded.game_type_bullet, game_type_bullet),
          game_type_classical = COALESCE(excluded.game_type_classical, game_type_classical),
          only_rated = COALESCE(excluded.only_rated, only_rated),
          minimum_rating = COALESCE(excluded.minimum_rating, minimum_rating),
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        preferenceId,
        subscription.id,
        updates.gameTypes?.rapid,
        updates.gameTypes?.blitz,
        updates.gameTypes?.bullet,
        updates.gameTypes?.classical,
        updates.onlyRated,
        updates.minimumRating
      ).run();
    }

    // Return updated player preferences
    const userPrefs = await getUserNotificationPreferences(db, userId);
    const playerPrefs = userPrefs.players.find(p => p.playerName === playerName);
    
    if (!playerPrefs) {
      throw createApiError('Updated player preferences not found', 500, 'PLAYER_PREFERENCES_NOT_FOUND');
    }

    return playerPrefs;
  } catch (error) {
    console.error('Error updating player notification preferences:', error);
    throw createApiError('Failed to update player notification preferences', 500, 'PLAYER_PREFERENCES_UPDATE_ERROR', error);
  }
}

export async function bulkUpdatePlayerNotificationPreferences(
  db: D1Database,
  userId: string,
  playerNames: string[],
  action: 'enable' | 'disable' | 'digest' | 'update',
  preferences?: Partial<PlayerNotificationPreferences>
): Promise<{ success: string[], failed: string[], errors: Record<string, string> }> {
  const results = {
    success: [] as string[],
    failed: [] as string[],
    errors: {} as Record<string, string>
  };

  for (const playerName of playerNames) {
    try {
      switch (action) {
        case 'enable':
          await updatePlayerNotificationPreferences(db, userId, playerName, { enabled: true });
          break;
        case 'disable':
          await updatePlayerNotificationPreferences(db, userId, playerName, { enabled: false });
          break;
        case 'update':
          if (preferences) {
            await updatePlayerNotificationPreferences(db, userId, playerName, preferences);
          }
          break;
      }
      results.success.push(playerName);
    } catch (error) {
      results.failed.push(playerName);
      results.errors[playerName] = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  return results;
}
```

---

## 🧪 Comprehensive Testing Strategy

### Frontend Component Testing

```typescript
// tests/frontend/components/NotificationSettings.test.ts
import { render, fireEvent, waitFor, screen } from '@testing-library/dom';
import { NotificationSettings } from '../../../src/frontend/components/NotificationSettings';
import { createMockApiService } from '../../utils/mockApiService';

describe('NotificationSettings Component', () => {
  let mockApiService: jest.Mocked<NotificationApiService>;
  let container: HTMLElement;

  beforeEach(() => {
    mockApiService = createMockApiService();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Global Preference Controls', () => {
    it('should render all global preference toggles', () => {
      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences()
      });

      component.render();

      expect(screen.getByLabelText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByLabelText('Quiet Hours')).toBeInTheDocument();
      expect(screen.getByDisplayValue('immediate')).toBeInTheDocument();
    });

    it('should update global email notifications when toggled', async () => {
      mockApiService.updateGlobalPreferences.mockResolvedValue({
        emailNotifications: false
      });

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences({ emailNotifications: true })
      });

      component.render();

      const emailToggle = screen.getByLabelText('Email Notifications') as HTMLInputElement;
      fireEvent.click(emailToggle);

      await waitFor(() => {
        expect(mockApiService.updateGlobalPreferences).toHaveBeenCalledWith({
          emailNotifications: false
        });
      });

      expect(emailToggle.checked).toBe(false);
    });

    it('should configure quiet hours correctly', async () => {
      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences()
      });

      component.render();

      const quietHoursToggle = screen.getByLabelText('Quiet Hours') as HTMLInputElement;
      fireEvent.click(quietHoursToggle);

      await waitFor(() => {
        expect(screen.getByLabelText('From:')).toBeVisible();
        expect(screen.getByLabelText('To:')).toBeVisible();
      });

      const startTimeInput = screen.getByLabelText('From:') as HTMLInputElement;
      const endTimeInput = screen.getByLabelText('To:') as HTMLInputElement;

      fireEvent.change(startTimeInput, { target: { value: '22:00' } });
      fireEvent.change(endTimeInput, { target: { value: '09:00' } });

      await waitFor(() => {
        expect(mockApiService.updateGlobalPreferences).toHaveBeenCalledWith({
          quietHours: {
            enabled: true,
            startTime: '22:00',
            endTime: '09:00',
            timezone: 'auto'
          }
        });
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiService.updateGlobalPreferences.mockRejectedValue(
        new Error('Network error')
      );

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences()
      });

      component.render();

      const emailToggle = screen.getByLabelText('Email Notifications') as HTMLInputElement;
      fireEvent.click(emailToggle);

      await waitFor(() => {
        expect(screen.getByText('Failed to update preferences: Network error')).toBeInTheDocument();
      });

      // Should revert the toggle state
      expect(emailToggle.checked).toBe(true);
    });
  });

  describe('Player-Specific Controls', () => {
    it('should render player notification controls', () => {
      const preferences = createTestPreferences({
        players: [
          {
            playerName: 'magnus',
            enabled: true,
            gameTypes: { rapid: true, blitz: true, bullet: false, classical: true },
            onlyRated: false,
            notificationCount: 5
          },
          {
            playerName: 'hikaru',
            enabled: false,
            gameTypes: { rapid: true, blitz: true, bullet: true, classical: false },
            onlyRated: true,
            notificationCount: 2
          }
        ]
      });

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: preferences
      });

      component.render();

      expect(screen.getByText('magnus')).toBeInTheDocument();
      expect(screen.getByText('hikaru')).toBeInTheDocument();
      
      const magnusToggle = screen.getByTestId('player-toggle-magnus') as HTMLInputElement;
      const hikaruToggle = screen.getByTestId('player-toggle-hikaru') as HTMLInputElement;
      
      expect(magnusToggle.checked).toBe(true);
      expect(hikaruToggle.checked).toBe(false);
    });

    it('should update individual player preferences', async () => {
      mockApiService.updatePlayerPreferences.mockResolvedValue({
        playerName: 'magnus',
        enabled: false,
        gameTypes: { rapid: true, blitz: true, bullet: false, classical: true },
        onlyRated: false,
        notificationCount: 5
      });

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences({
          players: [{
            playerName: 'magnus',
            enabled: true,
            gameTypes: { rapid: true, blitz: true, bullet: false, classical: true },
            onlyRated: false,
            notificationCount: 5
          }]
        })
      });

      component.render();

      const magnusToggle = screen.getByTestId('player-toggle-magnus') as HTMLInputElement;
      fireEvent.click(magnusToggle);

      await waitFor(() => {
        expect(mockApiService.updatePlayerPreferences).toHaveBeenCalledWith('magnus', {
          enabled: false
        });
      });

      expect(magnusToggle.checked).toBe(false);
    });

    it('should open player settings modal', async () => {
      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences({
          players: [{
            playerName: 'magnus',
            enabled: true,
            gameTypes: { rapid: true, blitz: true, bullet: false, classical: true },
            onlyRated: false,
            notificationCount: 5
          }]
        })
      });

      component.render();

      const settingsButton = screen.getByTestId('player-settings-magnus');
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText('Notification Settings for magnus')).toBeInTheDocument();
        expect(screen.getByLabelText('Rapid')).toBeInTheDocument();
        expect(screen.getByLabelText('Blitz')).toBeInTheDocument();
        expect(screen.getByLabelText('Bullet')).toBeInTheDocument();
        expect(screen.getByLabelText('Classical')).toBeInTheDocument();
      });
    });

    it('should perform bulk operations', async () => {
      mockApiService.bulkUpdatePlayerPreferences.mockResolvedValue({
        success: ['magnus', 'hikaru'],
        failed: [],
        errors: {}
      });

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences({
          players: [
            { playerName: 'magnus', enabled: true, gameTypes: {}, onlyRated: false, notificationCount: 0 },
            { playerName: 'hikaru', enabled: true, gameTypes: {}, onlyRated: false, notificationCount: 0 }
          ]
        })
      });

      component.render();

      // Select players
      const selectAll = screen.getByTestId('select-all-players') as HTMLInputElement;
      fireEvent.click(selectAll);

      // Perform bulk disable
      const bulkActions = screen.getByTestId('bulk-actions-dropdown');
      fireEvent.change(bulkActions, { target: { value: 'disable' } });

      const applyButton = screen.getByTestId('apply-bulk-action');
      fireEvent.click(applyButton);

      // Confirm action
      const confirmButton = screen.getByTestId('confirm-bulk-action');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockApiService.bulkUpdatePlayerPreferences).toHaveBeenCalledWith(
          ['magnus', 'hikaru'],
          'disable',
          undefined
        );
      });

      expect(screen.getByText('Successfully updated 2 players')).toBeInTheDocument();
    });
  });

  describe('Notification History', () => {
    it('should display notification history', async () => {
      const mockHistory = [
        {
          id: '1',
          playerName: 'magnus',
          type: 'game_started',
          sentAt: '2025-01-01T10:00:00Z',
          deliveryStatus: 'delivered',
          gameDetails: {
            timeControl: '10+0',
            gameType: 'Rapid',
            rated: true,
            gameUrl: 'https://chess.com/game/123'
          }
        },
        {
          id: '2',
          playerName: 'hikaru',
          type: 'game_started',
          sentAt: '2025-01-01T09:30:00Z',
          deliveryStatus: 'pending'
        }
      ];

      mockApiService.getNotificationHistory.mockResolvedValue({
        notifications: mockHistory,
        pagination: { offset: 0, limit: 50, total: 2, hasMore: false }
      });

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences()
      });

      component.render();

      // Switch to history tab
      const historyTab = screen.getByTestId('history-tab');
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('magnus')).toBeInTheDocument();
        expect(screen.getByText('hikaru')).toBeInTheDocument();
        expect(screen.getByText('Delivered')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('should filter notification history', async () => {
      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences()
      });

      component.render();

      const historyTab = screen.getByTestId('history-tab');
      fireEvent.click(historyTab);

      const playerFilter = screen.getByTestId('history-player-filter');
      const statusFilter = screen.getByTestId('history-status-filter');
      const applyFilters = screen.getByTestId('apply-history-filters');

      fireEvent.change(playerFilter, { target: { value: 'magnus' } });
      fireEvent.change(statusFilter, { target: { value: 'delivered' } });
      fireEvent.click(applyFilters);

      await waitFor(() => {
        expect(mockApiService.getNotificationHistory).toHaveBeenCalledWith({
          limit: 50,
          offset: 0,
          playerName: 'magnus',
          deliveryStatus: 'delivered'
        });
      });
    });
  });

  describe('Loading States and Error Handling', () => {
    it('should show loading spinner during API calls', async () => {
      let resolvePromise: Function;
      const promise = new Promise(resolve => { resolvePromise = resolve; });
      mockApiService.updateGlobalPreferences.mockReturnValue(promise);

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences()
      });

      component.render();

      const emailToggle = screen.getByLabelText('Email Notifications');
      fireEvent.click(emailToggle);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(emailToggle).toBeDisabled();

      resolvePromise({ emailNotifications: false });
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
        expect(emailToggle).toBeEnabled();
      });
    });

    it('should handle network errors with retry option', async () => {
      mockApiService.updateGlobalPreferences
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ emailNotifications: false });

      const component = new NotificationSettings({
        container,
        userId: 'test-user',
        apiService: mockApiService,
        initialPreferences: createTestPreferences()
      });

      component.render();

      const emailToggle = screen.getByLabelText('Email Notifications');
      fireEvent.click(emailToggle);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByText(/Network error/)).not.toBeInTheDocument();
        expect(emailToggle.checked).toBe(false);
      });
    });
  });
});

// Helper functions for testing
function createTestPreferences(overrides: Partial<UserNotificationPreferences> = {}): UserNotificationPreferences {
  return {
    globalEnabled: true,
    emailNotifications: true,
    notificationFrequency: 'immediate',
    quietHours: {
      enabled: false,
      startTime: '23:00',
      endTime: '08:00',
      timezone: 'auto'
    },
    players: [],
    statistics: {
      totalNotificationsSent: 0,
      deliverySuccessRate: 0,
      activePlayerCount: 0
    },
    ...overrides
  };
}

function createMockApiService(): jest.Mocked<NotificationApiService> {
  return {
    updateGlobalPreferences: jest.fn(),
    updatePlayerPreferences: jest.fn(),
    bulkUpdatePlayerPreferences: jest.fn(),
    getNotificationHistory: jest.fn(),
    getNotificationStatistics: jest.fn()
  };
}
```

### API Integration Testing

```typescript
// tests/api/notificationPreferences.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../utils/testApp';
import { createTestUser, createTestPlayerSubscription } from '../utils/testData';

describe('Notification Preferences API Integration', () => {
  let app: TestApp;
  let testUser: TestUser;
  let authToken: string;

  beforeEach(async () => {
    app = await createTestApp();
    testUser = await createTestUser(app.db);
    authToken = await app.generateAuthToken(testUser.id);
  });

  afterEach(async () => {
    await app.cleanup();
  });

  describe('GET /api/v1/users/me/notification-preferences', () => {
    it('should return default notification preferences for new user', async () => {
      const response = await app.request('/api/v1/users/me/notification-preferences', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.preferences).toMatchObject({
        globalEnabled: true,
        emailNotifications: true,
        notificationFrequency: 'immediate',
        quietHours: {
          enabled: false,
          startTime: '23:00',
          endTime: '08:00',
          timezone: 'auto'
        },
        players: [],
        statistics: {
          totalNotificationsSent: 0,
          deliverySuccessRate: 0,
          activePlayerCount: 0
        }
      });
    });

    it('should return preferences with player subscriptions', async () => {
      // Create player subscriptions
      await createTestPlayerSubscription(app.db, testUser.id, 'magnus');
      await createTestPlayerSubscription(app.db, testUser.id, 'hikaru');

      const response = await app.request('/api/v1/users/me/notification-preferences', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.preferences.players).toHaveLength(2);
      expect(data.preferences.players).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ playerName: 'magnus', enabled: true }),
          expect.objectContaining({ playerName: 'hikaru', enabled: true })
        ])
      );
    });

    it('should require authentication', async () => {
      const response = await app.request('/api/v1/users/me/notification-preferences');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/users/me/notification-preferences', () => {
    it('should update global notification preferences', async () => {
      const updates = {
        emailNotifications: false,
        notificationFrequency: 'digest',
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '09:00',
          timezone: 'America/New_York'
        }
      };

      const response = await app.request('/api/v1/users/me/notification-preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.preferences).toMatchObject({
        emailNotifications: false,
        notificationFrequency: 'digest',
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '09:00',
          timezone: 'America/New_York'
        }
      });
    });

    it('should validate notification frequency values', async () => {
      const response = await app.request('/api/v1/users/me/notification-preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationFrequency: 'invalid'
        })
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid notification frequency');
    });

    it('should handle partial updates correctly', async () => {
      // First, set initial preferences
      await app.request('/api/v1/users/me/notification-preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailNotifications: false,
          notificationFrequency: 'digest'
        })
      });

      // Then update only one field
      const response = await app.request('/api/v1/users/me/notification-preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailNotifications: true
        })
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.preferences.emailNotifications).toBe(true);
      expect(data.preferences.notificationFrequency).toBe('digest'); // Should remain unchanged
    });
  });

  describe('PUT /api/v1/users/me/notification-preferences/:playerName', () => {
    it('should update player-specific preferences', async () => {
      await createTestPlayerSubscription(app.db, testUser.id, 'magnus');

      const updates = {
        enabled: false,
        gameTypes: {
          rapid: true,
          blitz: false,
          bullet: false,
          classical: true
        },
        onlyRated: true,
        minimumRating: 2500
      };

      const response = await app.request('/api/v1/users/me/notification-preferences/magnus', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.preferences).toMatchObject({
        playerName: 'magnus',
        enabled: false,
        gameTypes: {
          rapid: true,
          blitz: false,
          bullet: false,
          classical: true
        },
        onlyRated: true,
        minimumRating: 2500
      });
    });

    it('should return 404 for non-existent player subscription', async () => {
      const response = await app.request('/api/v1/users/me/notification-preferences/nonexistent', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: false })
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/users/me/notification-preferences/bulk', () => {
    it('should perform bulk enable operation', async () => {
      await createTestPlayerSubscription(app.db, testUser.id, 'magnus');
      await createTestPlayerSubscription(app.db, testUser.id, 'hikaru');
      await createTestPlayerSubscription(app.db, testUser.id, 'fabiano');

      const response = await app.request('/api/v1/users/me/notification-preferences/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerNames: ['magnus', 'hikaru'],
          action: 'enable'
        })
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.results.success).toEqual(['magnus', 'hikaru']);
      expect(data.results.failed).toEqual([]);
    });

    it('should handle partial failures in bulk operations', async () => {
      await createTestPlayerSubscription(app.db, testUser.id, 'magnus');
      // Don't create subscription for 'nonexistent'

      const response = await app.request('/api/v1/users/me/notification-preferences/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerNames: ['magnus', 'nonexistent'],
          action: 'disable'
        })
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.results.success).toEqual(['magnus']);
      expect(data.results.failed).toEqual(['nonexistent']);
      expect(data.results.errors.nonexistent).toContain('not found');
    });

    it('should validate required fields', async () => {
      const response = await app.request('/api/v1/users/me/notification-preferences/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'enable' // Missing playerNames
        })
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Player names are required');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on preference updates', async () => {
      const requests = Array.from({ length: 11 }, () => 
        app.request('/api/v1/users/me/notification-preferences', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emailNotifications: false })
        })
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);

      expect(statusCodes.filter(code => code === 429)).toHaveLength(1); // At least one rate limited
      expect(statusCodes.filter(code => code === 200)).toBeGreaterThan(5); // Some succeed
    });
  });

  describe('Data Persistence', () => {
    it('should persist preferences across sessions', async () => {
      // Update preferences
      await app.request('/api/v1/users/me/notification-preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailNotifications: false,
          notificationFrequency: 'digest'
        })
      });

      // Create new auth token (simulating new session)
      const newAuthToken = await app.generateAuthToken(testUser.id);

      // Fetch preferences with new token
      const response = await app.request('/api/v1/users/me/notification-preferences', {
        headers: { Authorization: `Bearer ${newAuthToken}` }
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.preferences.emailNotifications).toBe(false);
      expect(data.preferences.notificationFrequency).toBe('digest');
    });
  });
});
```

---

## 📊 Success Criteria & Acceptance Testing

### Technical Acceptance Criteria

#### Dashboard Integration
- [ ] **Seamless Integration**: Notification settings integrate smoothly with existing dashboard
- [ ] **Responsive Design**: All controls work perfectly on mobile, tablet, and desktop
- [ ] **Real-time Updates**: Preference changes reflect immediately without page refresh
- [ ] **Loading States**: Clear feedback during API operations with appropriate loading indicators
- [ ] **Error Handling**: Graceful error handling with user-friendly error messages and retry options

#### API Functionality
- [ ] **Complete CRUD Operations**: Full create, read, update, delete operations for all preferences
- [ ] **Input Validation**: Comprehensive validation prevents invalid data submission
- [ ] **Rate Limiting**: API endpoints protected against abuse with appropriate rate limits
- [ ] **Authentication**: All endpoints properly secured with user authentication
- [ ] **Performance**: API response times consistently under 200ms for preference operations

#### User Experience
- [ ] **Intuitive Interface**: Users can modify any notification setting in under 3 clicks
- [ ] **Bulk Operations**: Efficient bulk actions for managing multiple players simultaneously
- [ ] **Preference Persistence**: All preferences saved immediately and persist across sessions
- [ ] **Mobile Optimization**: Touch-friendly interface with appropriate gesture support
- [ ] **Accessibility**: Full keyboard navigation and screen reader support

#### Unsubscribe System
- [ ] **Regulatory Compliance**: Unsubscribe system meets CAN-SPAM and GDPR requirements
- [ ] **One-click Unsubscribe**: Simple one-click unsubscribe from email notifications
- [ ] **Granular Options**: Users can selectively unsubscribe from specific players or notification types
- [ ] **Token Security**: Unsubscribe tokens are secure, time-limited, and single-use
- [ ] **Audit Trail**: Complete audit trail of all unsubscribe actions

### Performance Benchmarks

#### Frontend Performance
- [ ] **Initial Load Time**: Dashboard loads completely in under 2 seconds
- [ ] **Component Rendering**: Individual components render in under 500ms
- [ ] **API Response Handling**: UI updates within 100ms of API response
- [ ] **Memory Usage**: JavaScript memory usage remains under 50MB
- [ ] **Mobile Performance**: 60fps animations and smooth scrolling on mobile devices

#### API Performance
- [ ] **Response Times**: 95th percentile response time under 200ms
- [ ] **Throughput**: API handles 1000+ concurrent requests
- [ ] **Database Queries**: All queries execute in under 50ms
- [ ] **Bulk Operations**: Bulk updates complete in under 1 second for 100 players
- [ ] **Error Recovery**: Failed operations retry automatically with exponential backoff

### User Acceptance Testing

#### User Journey Tests
- [ ] **New User Setup**: First-time users can configure notification preferences intuitively
- [ ] **Preference Modification**: Existing users can easily modify notification settings
- [ ] **Player Management**: Users can add/remove players and configure per-player preferences
- [ ] **Bulk Management**: Power users can efficiently manage large numbers of followed players
- [ ] **Mobile Usage**: Mobile users can access and modify all preferences comfortably

#### Accessibility Testing
- [ ] **Screen Reader Support**: All interfaces work correctly with NVDA, JAWS, and VoiceOver
- [ ] **Keyboard Navigation**: Complete functionality available via keyboard only
- [ ] **Color Contrast**: All text meets WCAG 2.1 AA color contrast requirements
- [ ] **Focus Indicators**: Clear focus indicators for all interactive elements
- [ ] **Alternative Text**: All images and icons have appropriate alt text

#### Cross-Platform Testing
- [ ] **Browser Compatibility**: Full functionality in Chrome, Firefox, Safari, Edge (latest 2 versions)
- [ ] **Mobile Browsers**: Complete functionality on iOS Safari and Android Chrome
- [ ] **Progressive Web App**: Offline functionality where appropriate
- [ ] **Email Client Testing**: Unsubscribe links work in all major email clients
- [ ] **Device Testing**: Responsive design tested on various screen sizes

### Quality Assurance Metrics

#### Code Quality
- [ ] **Test Coverage**: Minimum 90% code coverage for all notification-related code
- [ ] **Static Analysis**: All code passes linting with zero warnings or errors
- [ ] **Type Safety**: Full TypeScript type safety with no `any` types
- [ ] **Documentation**: All public APIs fully documented with examples
- [ ] **Code Review**: All code changes reviewed and approved by senior developers

#### Security Testing
- [ ] **Authentication Security**: All endpoints require valid authentication
- [ ] **Authorization Testing**: Users can only access their own preferences
- [ ] **Input Sanitization**: All user inputs properly sanitized and validated
- [ ] **XSS Prevention**: Frontend protected against cross-site scripting attacks
- [ ] **CSRF Protection**: API endpoints protected against cross-site request forgery

#### Reliability Testing
- [ ] **Load Testing**: System handles 10,000 concurrent users without degradation
- [ ] **Stress Testing**: Graceful degradation under extreme load conditions
- [ ] **Failure Recovery**: System recovers gracefully from database failures
- [ ] **Data Consistency**: Preferences remain consistent across all system components
- [ ] **Uptime Testing**: 99.9% uptime maintained during testing period

---

## 🚀 Deployment & Go-Live Strategy

### Pre-Deployment Checklist

#### Development Environment
- [ ] **Feature Complete**: All Phase 4 features implemented and tested
- [ ] **Code Review**: All code changes reviewed and approved
- [ ] **Documentation**: API documentation updated and published
- [ ] **Testing Complete**: All unit, integration, and e2e tests passing
- [ ] **Performance Validated**: Performance benchmarks met in testing environment

#### Staging Environment
- [ ] **Database Migrations**: All schema changes applied successfully
- [ ] **Configuration**: Environment variables and settings configured
- [ ] **API Testing**: All API endpoints tested with realistic data
- [ ] **Frontend Testing**: UI components tested across browsers and devices
- [ ] **Integration Testing**: End-to-end workflows validated

#### Production Readiness
- [ ] **Security Review**: Security assessment completed and approved
- [ ] **Performance Monitoring**: Monitoring and alerting configured
- [ ] **Backup Strategy**: Database backup and recovery procedures verified
- [ ] **Rollback Plan**: Rollback procedures documented and tested
- [ ] **Support Documentation**: User guides and troubleshooting docs prepared

### Deployment Timeline

#### Week 1: Gradual Rollout
**Day 1-2: Limited Beta (5% of users)**
- Deploy to beta user group
- Monitor system performance and user feedback
- Collect metrics on usage patterns
- Validate API performance under real load
- Test notification preference adoption rates

**Day 3-4: Expanded Beta (25% of users)**
- Increase user base to larger beta group
- Monitor for edge cases and unusual usage patterns
- Validate mobile experience with real users
- Test bulk operations with power users
- Collect feedback on user interface design

**Day 5-7: Full Rollout (100% of users)**
- Deploy to all users
- Monitor system performance at scale
- Track user adoption and engagement metrics
- Validate notification delivery improvements
- Complete post-deployment validation

#### Week 2: Optimization & Support
**Day 8-10: Performance Optimization**
- Analyze performance metrics from full deployment
- Optimize database queries based on real usage patterns
- Fine-tune API response times
- Improve frontend loading performance
- Address any scalability issues discovered

**Day 11-14: User Support & Documentation**
- Provide user support for new notification features
- Create user education materials and tutorials
- Monitor support tickets for common issues
- Update documentation based on user feedback
- Plan future enhancements based on usage data

### Monitoring & Validation

#### Key Performance Indicators (KPIs)
**User Adoption Metrics**:
- Percentage of users who configure notification preferences
- Average number of notification settings modified per user
- User retention rate after notification system updates
- Mobile vs desktop usage patterns
- Feature discovery and adoption rates

**System Performance Metrics**:
- API response times (95th percentile)
- Database query performance
- Frontend loading times
- Error rates and failure modes
- System uptime and availability

**Business Impact Metrics**:
- Email notification delivery rates
- User engagement with notifications
- Unsubscribe rates and feedback
- Support ticket volume related to notifications
- Overall user satisfaction scores

#### Real-time Monitoring Setup
```typescript
// Monitoring Configuration
const monitoringConfig = {
  metrics: {
    apiResponseTime: {
      threshold: 200, // milliseconds
      alerting: true
    },
    databaseQueryTime: {
      threshold: 50, // milliseconds
      alerting: true
    },
    errorRate: {
      threshold: 1, // percentage
      alerting: true
    },
    userAdoptionRate: {
      threshold: 80, // percentage
      alerting: false
    }
  },
  dashboards: [
    'notification-preferences-performance',
    'user-adoption-metrics',
    'api-health-dashboard',
    'mobile-experience-metrics'
  ],
  alerts: {
    slack: '#engineering-alerts',
    email: ['team@chesshelper.app'],
    severity: ['critical', 'warning', 'info']
  }
};
```

### Post-Deployment Success Validation

#### 24-Hour Validation
- [ ] **Zero Critical Issues**: No critical bugs or system failures
- [ ] **Performance Targets Met**: All performance benchmarks achieved
- [ ] **User Adoption Started**: Initial user adoption of new features
- [ ] **Monitoring Active**: All monitoring and alerting systems operational
- [ ] **Support Ready**: User support team prepared for new feature questions

#### One-Week Validation
- [ ] **Stable Performance**: Consistent system performance over time
- [ ] **User Feedback Positive**: Overall positive user feedback on new features
- [ ] **Adoption Growing**: Increasing user adoption of notification preferences
- [ ] **No Regression Issues**: No negative impact on existing functionality
- [ ] **Business Metrics Improved**: Positive impact on key business metrics

#### One-Month Validation
- [ ] **Target Adoption Achieved**: 80%+ of users have configured preferences
- [ ] **Performance Optimized**: All performance targets consistently met
- [ ] **User Satisfaction High**: High user satisfaction scores for notification system
- [ ] **Support Load Manageable**: Support ticket volume within acceptable range
- [ ] **Business Goals Met**: Notification system achieving intended business outcomes

---

This comprehensive Phase 4 implementation plan provides detailed specifications for creating a world-class user interface and control system for email notifications. The plan includes complete API designs, frontend components, testing strategies, and deployment procedures to ensure a successful implementation that meets all user needs and business objectives.
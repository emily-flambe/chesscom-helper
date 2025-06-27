# 🌐 Cloudflare Deployment Guide for Chess.com Helper

This document provides a comprehensive technical implementation plan for deploying the Chess.com Helper application to Cloudflare's edge infrastructure.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Phase 1: Infrastructure Setup & Frontend Deployment](#phase-1-infrastructure-setup--frontend-deployment)
- [Phase 2: Backend API Conversion & Deployment](#phase-2-backend-api-conversion--deployment)
- [Phase 3: Background Jobs & Email Setup](#phase-3-background-jobs--email-setup)
- [Phase 4: Domain & SSL Configuration](#phase-4-domain--ssl-configuration)
- [Phase 5: Environment Variables & Secrets](#phase-5-environment-variables--secrets)
- [Phase 6: Testing & Validation](#phase-6-testing--validation)
- [Performance & Cost Benefits](#performance--cost-benefits)
- [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

### Current State
- **Frontend**: React/Vite serving on port 5173
- **Backend**: Django REST API on port 8000
- **Database**: PostgreSQL
- **Background Jobs**: Django management commands via cron
- **Email**: SMTP (Gmail/SendGrid/etc.)
- **Hosting**: Traditional VPS with Caddy reverse proxy

### Target State (Cloudflare + Railway Hybrid)
- **Frontend**: Cloudflare Pages (React/Vite build)
- **Backend API**: Cloudflare Workers (Django → JavaScript/TypeScript conversion)
- **Database**: Railway PostgreSQL (managed, keep existing Django models)
- **Background Jobs**: Cloudflare Workers Cron Triggers
- **Email**: Cloudflare Email Routing + Workers or external service
- **Static Assets**: Cloudflare CDN
- **Domain**: Cloudflare DNS + SSL

### Alternative: Full Cloudflare-native
- **Database**: Cloudflare D1 (SQLite) - requires significant refactoring
- **Cost**: Lower (~$5/month vs ~$10-15/month)
- **Complexity**: Higher (complete ORM rewrite needed)

### Why Railway + Cloudflare is Recommended
- ✅ **Keep existing Django models** - no code refactoring required
- ✅ **Familiar PostgreSQL** - use existing migrations and tools
- ✅ **Still get major cost savings** - 45-75% reduction vs traditional hosting
- ✅ **Global performance** - Cloudflare edge network for frontend/API
- ✅ **Easy migration** - minimal changes to current codebase
- ✅ **Development workflow** - continue using local PostgreSQL for development

## 📚 Prerequisites

### Required Tools
```bash
# Install Cloudflare CLI tools
npm install -g wrangler
npm install -g @cloudflare/next-on-pages

# Install Railway CLI for database management
npm install -g @railway/cli

# Verify installations
wrangler --version
railway --version
node --version  # Should be 18+
npm --version
```

### Account Setup
**Cloudflare:**
1. Create a Cloudflare account at https://cloudflare.com
2. Add your domain to Cloudflare (if not already added)
3. Update nameservers to Cloudflare's
4. Authenticate CLI: `wrangler login`

**Railway:**
1. Create a Railway account at https://railway.app
2. Connect your GitHub account for easy deployments
3. Authenticate CLI: `railway login`

## 🚀 Phase 1: Infrastructure Setup & Frontend Deployment

### Step 1.1: Prepare Frontend for Cloudflare Pages

Navigate to the frontend directory and update configuration:

```bash
cd chesscom_helper/frontend
```

#### Update `vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    manifest: true,
    outDir: "dist",
    // Ensure proper asset paths for Cloudflare Pages
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  plugins: [react()],
  // Configure for production deployment
  base: '/',
  define: {
    // Environment variables for production
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['chesscomhelper.emilyflam.be'],
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

#### Update API Configuration in Frontend
Create or update environment configuration files:

**Create `.env.production`:**
```bash
VITE_API_BASE_URL=https://api.your-domain.com
VITE_APP_TITLE=Chess.com Helper
VITE_ENVIRONMENT=production
```

**Update API calls to use environment variables**
In your React components, ensure API calls use the environment variable:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
```

### Step 1.2: Build and Test Frontend

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test the build locally
npm run preview

# Verify dist directory is created with proper assets
ls -la dist/
```

### Step 1.3: Deploy Frontend to Cloudflare Pages

```bash
# Create new Pages project
wrangler pages create chesscom-helper-frontend

# Deploy the frontend
wrangler pages deploy dist --project-name chesscom-helper-frontend

# The deployment will provide a URL like:
# https://chesscom-helper-frontend.pages.dev
```

## 🔧 Phase 2: Backend API Conversion & Deployment

### Step 2.1: Analyze Current Django API

The current Django API has these endpoints that need conversion:
- `GET /api/chesscom-app/users/` - List all tracked users
- `GET /api/chesscom-app/user/{username}/` - Get specific user details
- `POST /api/chesscom-app/add-user/` - Add user to tracking
- `DELETE /api/chesscom-app/remove-user/{username}/` - Remove user
- `POST /api/chesscom-app/subscribe/` - Subscribe to email notifications
- `POST /api/chesscom-app/unsubscribe/` - Unsubscribe from notifications
- `GET /api/chesscom-app/user/{username}/subscriptions/` - Get user subscriptions

### Step 2.2: Set Up Railway PostgreSQL Database

**Create Railway Project and Database:**
```bash
# Create new Railway project
railway new chesscom-helper

# Add PostgreSQL service to the project
railway add postgresql

# Get database connection details
railway vars
# This will show DATABASE_URL and individual connection parameters
```

**Alternative: Use Railway Dashboard**
1. Go to https://railway.app
2. Click "New Project" 
3. Select "Deploy from GitHub repo" (connect your repo)
4. Add PostgreSQL service from the service catalog
5. Railway will automatically detect your Django app

**Export Current Database (if migrating from existing):**
```bash
# On your current server/local machine
pg_dump chesscom_helper > database_backup.sql

# Import to Railway (get connection details from `railway vars`)
psql $DATABASE_URL < database_backup.sql
```

**For New Setup - Use Django Migrations:**
```bash
# Set Railway database URL in your environment
export DATABASE_URL=$(railway vars get DATABASE_URL)

# Run Django migrations (your existing migrations will work!)
cd chesscom_helper
python manage.py migrate

# Create superuser if needed
python manage.py createsuperuser
```

**Verify Database Setup:**
```bash
# Connect to Railway database
railway connect postgresql

# Or check via Django shell
railway run python manage.py shell
# >>> from chesscom_app.models import User
# >>> User.objects.all()
```

### Step 2.3: Create Cloudflare Workers API

Create the API Worker project structure:

```bash
# Create new directory for API Worker
mkdir chesscom-helper-api
cd chesscom-helper-api

# Initialize Worker
wrangler init chesscom-helper-api --type=javascript

# Install dependencies
npm install itty-router postgres drizzle-orm
```

**Configure `wrangler.toml`:**
```toml
name = "chesscom-helper-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Environment variables (set via wrangler secret)
[vars]
CHESS_COM_API_BASE = "https://api.chess.com/pub"
CORS_ORIGIN = "https://your-domain.com"

# Database connection will be set as secret:
# DATABASE_URL = "postgresql://user:pass@railway-host:5432/dbname"
```

**Create project structure:**
```bash
mkdir -p src/routes src/services src/utils
```

**Main Worker Entry Point (`src/index.js`):**
```javascript
import { Router } from 'itty-router';
import { corsHeaders, handleCors } from './utils/cors';
import { userRoutes } from './routes/users';
import { subscriptionRoutes } from './routes/subscriptions';

const router = Router();

// Handle CORS preflight requests
router.options('*', handleCors);

// Apply CORS to all routes
router.all('*', (request, env, ctx) => {
  // Add CORS headers to all responses
  ctx.corsHeaders = corsHeaders(request);
});

// API routes
router.all('/api/users/*', userRoutes);
router.all('/api/subscriptions/*', subscriptionRoutes);

// Health check
router.get('/health', (request, env, ctx) => {
  return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    headers: {
      'Content-Type': 'application/json',
      ...ctx.corsHeaders
    }
  });
});

// 404 handler
router.all('*', (request, env, ctx) => {
  return new Response('Not Found', { 
    status: 404,
    headers: ctx.corsHeaders
  });
});

export default {
  async fetch(request, env, ctx) {
    try {
      return await router.handle(request, env, ctx);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders(request)
      });
    }
  }
};
```

**CORS Utility (`src/utils/cors.js`):**
```javascript
export function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'http://localhost:5173',
    'https://your-domain.com',
    'https://chesscom-helper-frontend.pages.dev'
  ];
  
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[1];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handleCors(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request)
  });
}
```

**Database Service (`src/services/database.js`):**
```javascript
import postgres from 'postgres';

// Initialize PostgreSQL connection
function getDB(env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return postgres(env.DATABASE_URL);
}

// User management functions
export async function getAllUsers(env) {
  const sql = getDB(env);
  
  try {
    const users = await sql`
      SELECT 
        player_id,
        url,
        name,
        username,
        followers,
        country,
        location,
        last_online,
        joined,
        status,
        is_streamer,
        verified,
        league,
        streaming_platforms,
        is_playing
      FROM chesscom_app_user 
      ORDER BY username ASC
    `;
    
    await sql.end();
    return users;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export async function getUserByUsername(env, username) {
  const sql = getDB(env);
  
  try {
    const users = await sql`
      SELECT * FROM chesscom_app_user WHERE username = ${username}
    `;
    await sql.end();
    return users[0] || null;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export async function addUser(env, username, profileData) {
  const sql = getDB(env);
  
  try {
    const existingUser = await getUserByUsername(env, username);
    if (existingUser) {
      throw new Error('User already exists');
    }
    
    const [newUser] = await sql`
      INSERT INTO chesscom_app_user (
        player_id, url, name, username, followers, country, location,
        last_online, joined, status, is_streamer, verified, league,
        streaming_platforms, is_playing
      ) VALUES (
        ${profileData.player_id}, ${profileData.url}, ${profileData.name},
        ${username}, ${profileData.followers || 0}, ${profileData.country},
        ${profileData.location}, ${profileData.last_online}, ${profileData.joined},
        ${profileData.status}, ${profileData.is_streamer || false},
        ${profileData.verified || false}, ${profileData.league},
        ${JSON.stringify(profileData.streaming_platforms || [])}, false
      ) RETURNING *
    `;
    
    await sql.end();
    return newUser;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export async function removeUser(env, username) {
  const sql = getDB(env);
  
  try {
    // First remove all subscriptions for this user
    await sql`
      DELETE FROM chesscom_app_emailsubscription 
      WHERE player_id = (SELECT player_id FROM chesscom_app_user WHERE username = ${username})
    `;
    
    // Then remove the user
    const result = await sql`
      DELETE FROM chesscom_app_user WHERE username = ${username}
    `;
    
    await sql.end();
    return result.count > 0;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export async function updateUserPlayingStatus(env, username, isPlaying) {
  const sql = getDB(env);
  
  try {
    const result = await sql`
      UPDATE chesscom_app_user 
      SET is_playing = ${isPlaying}, last_online = ${Date.now()}
      WHERE username = ${username}
    `;
    
    await sql.end();
    return result;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

// Subscription management functions
export async function addSubscription(env, email, username) {
  const sql = getDB(env);
  
  try {
    const user = await getUserByUsername(env, username);
    if (!user) {
      throw new Error('User not found');
    }
    
    await sql`
      INSERT INTO chesscom_app_emailsubscription (email, player_id, is_active)
      VALUES (${email}, ${user.player_id}, true)
    `;
    
    await sql.end();
    return true;
  } catch (error) {
    await sql.end();
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
      throw new Error('Subscription already exists');
    }
    throw error;
  }
}

export async function removeSubscription(env, email, username) {
  const sql = getDB(env);
  
  try {
    const result = await sql`
      DELETE FROM chesscom_app_emailsubscription 
      WHERE email = ${email} AND player_id = (
        SELECT player_id FROM chesscom_app_user WHERE username = ${username}
      )
    `;
    
    await sql.end();
    return result.count > 0;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export async function getUserSubscriptions(env, username) {
  const sql = getDB(env);
  
  try {
    const subscriptions = await sql`
      SELECT es.* FROM chesscom_app_emailsubscription es
      JOIN chesscom_app_user u ON es.player_id = u.player_id
      WHERE u.username = ${username}
      ORDER BY es.created_at DESC
    `;
    
    await sql.end();
    return subscriptions;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export async function logNotification(env, email, username, status, errorMessage = null) {
  const sql = getDB(env);
  
  try {
    const user = await getUserByUsername(env, username);
    if (!user) return;
    
    const subscription = await sql`
      SELECT id FROM chesscom_app_emailsubscription 
      WHERE email = ${email} AND player_id = ${user.player_id}
    `;
    
    if (subscription[0]) {
      await sql`
        INSERT INTO chesscom_app_notificationlog (
          subscription_id, notification_type, success, error_message
        ) VALUES (
          ${subscription[0].id}, 'live_match', ${status === 'sent'}, ${errorMessage}
        )
      `;
    }
    
    await sql.end();
  } catch (error) {
    await sql.end();
    throw error;
  }
}
```

**Chess.com API Service (`src/services/chesscom-api.js`):**
```javascript
export async function fetchChesscomProfile(username) {
  try {
    const response = await fetch(`https://api.chess.com/pub/player/${username}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // User not found
      }
      throw new Error(`Chess.com API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching Chess.com profile:', error);
    return null;
  }
}

export async function checkUserLiveGames(username) {
  try {
    const response = await fetch(`https://api.chess.com/pub/player/${username}/games/to-move`);
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.games && data.games.length > 0;
  } catch (error) {
    console.error('Error checking live games:', error);
    return false;
  }
}
```

**User Routes (`src/routes/users.js`):**
```javascript
import { Router } from 'itty-router';
import { 
  getAllUsers, 
  getUserByUsername, 
  addUser, 
  removeUser 
} from '../services/database';
import { fetchChesscomProfile } from '../services/chesscom-api';

const router = Router();

// GET /api/users
router.get('/api/users', async (request, env, ctx) => {
  try {
    const users = await getAllUsers(env);
    
    return new Response(JSON.stringify(users), {
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  }
});

// GET /api/users/:username
router.get('/api/users/:username', async (request, env, ctx) => {
  try {
    const { username } = request.params;
    const user = await getUserByUsername(env, username);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    return new Response(JSON.stringify(user), {
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch user' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  }
});

// POST /api/users
router.post('/api/users', async (request, env, ctx) => {
  try {
    const { username } = await request.json();
    
    if (!username || typeof username !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid username is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    // Validate username with Chess.com API
    const profileData = await fetchChesscomProfile(username);
    if (!profileData) {
      return new Response(JSON.stringify({ error: 'Invalid Chess.com username' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    const user = await addUser(env, username, profileData);
    
    return new Response(JSON.stringify(user), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  } catch (error) {
    console.error('Error adding user:', error);
    
    const status = error.message === 'User already exists' ? 409 : 500;
    const message = error.message === 'User already exists' ? 'User already exists' : 'Failed to add user';
    
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  }
});

// DELETE /api/users/:username
router.delete('/api/users/:username', async (request, env, ctx) => {
  try {
    const { username } = request.params;
    const removed = await removeUser(env, username);
    
    if (!removed) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    return new Response('', {
      status: 204,
      headers: ctx.corsHeaders
    });
  } catch (error) {
    console.error('Error removing user:', error);
    return new Response(JSON.stringify({ error: 'Failed to remove user' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  }
});

export { router as userRoutes };
```

**Subscription Routes (`src/routes/subscriptions.js`):**
```javascript
import { Router } from 'itty-router';
import { 
  addSubscription, 
  removeSubscription, 
  getUserSubscriptions 
} from '../services/database';

const router = Router();

// POST /api/subscriptions
router.post('/api/subscriptions', async (request, env, ctx) => {
  try {
    const { email, username } = await request.json();
    
    if (!email || !username) {
      return new Response(JSON.stringify({ error: 'Email and username are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    await addSubscription(env, email, username);
    
    return new Response(JSON.stringify({ 
      message: 'Subscription created successfully',
      email,
      username
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    
    const status = error.message === 'Subscription already exists' ? 409 : 500;
    const message = error.message === 'Subscription already exists' ? 'Subscription already exists' : 'Failed to create subscription';
    
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  }
});

// DELETE /api/subscriptions
router.delete('/api/subscriptions', async (request, env, ctx) => {
  try {
    const { email, username } = await request.json();
    
    if (!email || !username) {
      return new Response(JSON.stringify({ error: 'Email and username are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    const removed = await removeSubscription(env, email, username);
    
    if (!removed) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...ctx.corsHeaders
        }
      });
    }
    
    return new Response('', {
      status: 204,
      headers: ctx.corsHeaders
    });
  } catch (error) {
    console.error('Error removing subscription:', error);
    return new Response(JSON.stringify({ error: 'Failed to remove subscription' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  }
});

// GET /api/subscriptions/:username
router.get('/api/subscriptions/:username', async (request, env, ctx) => {
  try {
    const { username } = request.params;
    const subscriptions = await getUserSubscriptions(env, username);
    
    return new Response(JSON.stringify(subscriptions), {
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...ctx.corsHeaders
      }
    });
  }
});

export { router as subscriptionRoutes };
```

### Step 2.4: Deploy API Worker

```bash
# Deploy the API Worker
wrangler deploy

# Set up environment variables
wrangler secret put EMAIL_API_KEY
wrangler secret put EMAIL_FROM_ADDRESS

# Test the deployment
curl https://chesscom-helper-api.your-subdomain.workers.dev/health
```

## ⏰ Phase 3: Background Jobs & Email Setup

### Step 3.1: Create Cron Worker for Live Match Checking

```bash
# Create separate Worker for background jobs
mkdir chesscom-helper-cron
cd chesscom-helper-cron

wrangler init chesscom-helper-cron --type=javascript
npm install
```

**Configure `wrangler.toml`:**
```toml
name = "chesscom-helper-cron"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Run every 5 minutes
[triggers]
crons = ["*/5 * * * *"]

# Bind D1 database
[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db"
database_id = "your-database-id-here"

[vars]
CHESS_COM_API_BASE = "https://api.chess.com/pub"
```

**Cron Worker Implementation (`src/index.js`):**
```javascript
import { 
  getAllUsers, 
  updateUserPlayingStatus, 
  getUserSubscriptions,
  logNotification
} from './services/database';
import { checkUserLiveGames } from './services/chesscom-api';
import { sendNotificationEmail } from './services/email';

export default {
  async scheduled(event, env, ctx) {
    console.log('Starting live match check at:', new Date().toISOString());
    
    try {
      // Get all users from database
      const users = await getAllUsers(env);
      console.log(`Checking ${users.length} users for live matches`);
      
      const notifications = [];
      
      // Check each user for live matches
      for (const user of users) {
        try {
          const isPlaying = await checkUserLiveGames(user.username);
          console.log(`${user.username}: currently playing = ${isPlaying}, was playing = ${user.is_playing}`);
          
          // If user just started playing (transition from not playing to playing)
          if (isPlaying && !user.is_playing) {
            console.log(`${user.username} started playing - getting subscriptions`);
            
            // Get subscriptions for this user
            const subscriptions = await getUserSubscriptions(env, user.username);
            
            // Add to notifications queue
            notifications.push(...subscriptions.map(sub => ({
              email: sub.email,
              username: user.username
            })));
          }
          
          // Update user status in database
          await updateUserPlayingStatus(env, user.username, isPlaying);
          
        } catch (error) {
          console.error(`Error checking user ${user.username}:`, error);
        }
      }
      
      console.log(`Sending ${notifications.length} notifications`);
      
      // Send all notifications
      for (const notification of notifications) {
        try {
          await sendNotificationEmail(env, notification);
          await logNotification(env, notification.email, notification.username, 'sent');
          console.log(`Sent notification to ${notification.email} for ${notification.username}`);
        } catch (error) {
          console.error(`Failed to send notification to ${notification.email}:`, error);
          await logNotification(env, notification.email, notification.username, 'failed', error.message);
        }
      }
      
      console.log('Live match check completed successfully');
      
    } catch (error) {
      console.error('Error in scheduled function:', error);
      throw error;
    }
  },
  
  // Optional: Allow manual triggering via HTTP request
  async fetch(request, env, ctx) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/trigger') {
      // Manually trigger the cron job
      await this.scheduled(null, env, ctx);
      return new Response('Cron job triggered manually', { status: 200 });
    }
    
    return new Response('Cron Worker - use POST /trigger to manually run', { status: 200 });
  }
};
```

**Copy service files from API worker:**
```bash
# Copy shared services (adapt paths as needed)
cp -r ../chesscom-helper-api/src/services ./src/
```

### Step 3.2: Email Service Implementation

**Email Service (`src/services/email.js`):**
```javascript
export async function sendNotificationEmail(env, { email, username }) {
  const emailData = {
    personalizations: [{
      to: [{ email: email }],
      subject: `🔴 ${username} is now playing live on Chess.com!`
    }],
    from: { email: env.EMAIL_FROM_ADDRESS, name: 'Chess.com Helper' },
    content: [{
      type: 'text/html',
      value: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">🔴 Live Match Alert</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            <strong style="color: #e74c3c;">${username}</strong> has started a live match on Chess.com!
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://chess.com/member/${username}" 
               style="background-color: #27ae60; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              Watch the Game →
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
          <p style="font-size: 12px; color: #7f8c8d;">
            You're receiving this because you subscribed to notifications for ${username} on Chess.com Helper.
          </p>
        </div>
      `
    }]
  };
  
  // Use SendGrid API (you can adapt this for other email services)
  const response = await fetch('https://api.sendgrid.v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailData)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email API error (${response.status}): ${errorText}`);
  }
  
  return true;
}
```

### Step 3.3: Deploy Cron Worker

```bash
# Deploy the cron worker
wrangler deploy

# Set up email API key
wrangler secret put EMAIL_API_KEY
wrangler secret put EMAIL_FROM_ADDRESS

# Test manual trigger (optional)
curl -X POST https://chesscom-helper-cron.your-subdomain.workers.dev/trigger
```

## 🌐 Phase 4: Domain & SSL Configuration

### Step 4.1: DNS & Domain Setup

In the Cloudflare Dashboard:

1. **Add your domain** (if not already added)
   - Go to Cloudflare Dashboard
   - Click "Add Site"
   - Enter your domain name
   - Follow the nameserver setup instructions

2. **Configure DNS records:**
   - A record: `@` → (will be automatically managed by Pages)
   - CNAME record: `api` → (will be configured for Workers)
   - CNAME record: `www` → `your-domain.com`

### Step 4.2: Set up Custom Domains

```bash
# Set up custom domain for frontend (Pages)
wrangler pages domain add chesscom-helper-frontend your-domain.com

# Set up custom domain for API (Workers)
wrangler route add "api.your-domain.com/*" chesscom-helper-api

# Optional: Set up www subdomain
wrangler pages domain add chesscom-helper-frontend www.your-domain.com
```

### Step 4.3: SSL & Security Configuration

In Cloudflare Dashboard → SSL/TLS:

1. **Set SSL/TLS encryption mode** to "Full (strict)"
2. **Enable "Always Use HTTPS"**
3. **Configure HSTS** (HTTP Strict Transport Security)
4. **Set up Edge Certificates** (automatic)

Additional security settings:
- **Security Level**: Medium or High
- **Bot Fight Mode**: Enabled
- **WAF**: Configure custom rules if needed

## 🔐 Phase 5: Environment Variables & Secrets

### Step 5.1: Configure Production Secrets

**For API Worker:**
```bash
# Navigate to API worker directory
cd chesscom-helper-api

# Set production secrets
wrangler secret put EMAIL_API_KEY --env production
wrangler secret put EMAIL_FROM_ADDRESS --env production

# Optional: if using external database
wrangler secret put DATABASE_URL --env production
```

**For Cron Worker:**
```bash
# Navigate to cron worker directory
cd chesscom-helper-cron

# Set production secrets (same as API worker)
wrangler secret put EMAIL_API_KEY --env production
wrangler secret put EMAIL_FROM_ADDRESS --env production
```

**For Pages (Frontend):**
```bash
# Set environment variables for Pages
wrangler pages secret put VITE_API_BASE_URL --project-name chesscom-helper-frontend
# Enter: https://api.your-domain.com

wrangler pages secret put VITE_APP_TITLE --project-name chesscom-helper-frontend
# Enter: Chess.com Helper
```

### Step 5.2: Update Frontend Environment Configuration

**Update frontend `.env.production`:**
```bash
VITE_API_BASE_URL=https://api.your-domain.com
VITE_APP_TITLE=Chess.com Helper
VITE_ENVIRONMENT=production
```

**Rebuild and redeploy frontend:**
```bash
cd chesscom_helper/frontend
npm run build
wrangler pages deploy dist --project-name chesscom-helper-frontend
```

## ✅ Phase 6: Testing & Validation

### Step 6.1: End-to-End Testing

**Test API endpoints:**
```bash
# Health check
curl https://api.your-domain.com/health

# Test CORS
curl -H "Origin: https://your-domain.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.your-domain.com/api/users

# Test user operations
curl -X POST https://api.your-domain.com/api/users \
     -H "Content-Type: application/json" \
     -d '{"username": "magnuscarlsen"}'

curl https://api.your-domain.com/api/users

# Test subscriptions
curl -X POST https://api.your-domain.com/api/subscriptions \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "username": "magnuscarlsen"}'
```

**Test frontend:**
```bash
# Open browser and test
open https://your-domain.com

# Test all functionality:
# - User registration/login
# - Adding/removing Chess.com users
# - Email subscriptions
# - User interface responsiveness
```

**Test cron job manually:**
```bash
# Trigger cron job manually
curl -X POST https://chesscom-helper-cron.your-subdomain.workers.dev/trigger

# Check Wrangler logs
wrangler tail chesscom-helper-cron
```

### Step 6.2: Performance & Monitoring Setup

**Configure Analytics:**
1. **Cloudflare Analytics**: Automatically enabled for your domain
2. **Worker Analytics**: Available in Cloudflare Dashboard → Workers & Pages
3. **Pages Analytics**: Available in Cloudflare Dashboard → Pages

**Set up Monitoring:**
```bash
# Monitor Worker logs
wrangler tail chesscom-helper-api

# Monitor Cron Worker logs
wrangler tail chesscom-helper-cron

# Monitor Pages deployment logs
wrangler pages deployment tail --project-name chesscom-helper-frontend
```

## 📊 Performance & Cost Benefits

### Performance Improvements
- **Global CDN**: Frontend served from 275+ Cloudflare locations worldwide
- **Edge Computing**: API responses typically <50ms globally
- **Auto-scaling**: Automatic handling of traffic spikes without configuration
- **Zero cold starts**: Workers stay warm automatically for active applications
- **HTTP/3 & QUIC**: Latest protocol support for faster connections

### Cost Benefits Comparison

**Traditional VPS Hosting (Current):**
- VPS: $20-50/month
- Database: $15-30/month  
- CDN: $10-20/month
- Email service: $10-15/month
- **Total: $55-115/month**

**Cloudflare + Railway Deployment (Recommended):**
- Pages (Frontend): Free tier (up to 100GB bandwidth)
- Workers (API): $5/month (10M requests)
- Railway PostgreSQL: $5-25/month (depending on usage)
- Cron Triggers: Included with Workers
- Email routing: $0.02/1000 emails
- **Total: $10-30/month**

**Cloudflare + D1 (Alternative):**
- Pages (Frontend): Free tier
- Workers (API): $5/month
- D1 Database: Free tier (up to 5GB storage)
- **Total: $5-15/month**

**Estimated savings: 
- Railway option: 45-75% cost reduction
- D1 option: 80-90% cost reduction**

### Scalability Benefits
- **Automatic scaling**: No server management required
- **Global distribution**: Better performance for international users
- **DDoS protection**: Built-in enterprise-grade protection
- **Zero downtime deployments**: Automatic deployments with rollback capability

## 🔧 Troubleshooting

### Common Issues & Solutions

**1. CORS Errors**
```javascript
// Ensure corsHeaders function includes your domain
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-domain.com',
  'https://chesscom-helper-frontend.pages.dev'
];
```

**2. Database Connection Issues**
```bash
# Verify Railway database connection
railway vars get DATABASE_URL

# Test connection from Worker
# Check that DATABASE_URL is set as Wrangler secret
wrangler secret list

# Connect to Railway database for debugging
railway connect postgresql
```

**3. Environment Variables Not Working**
```bash
# List all secrets
wrangler secret list

# Verify deployment environment
wrangler deployments list
```

**4. Cron Job Not Running**
```bash
# Check cron trigger configuration
wrangler cron trigger --cron="*/5 * * * *" chesscom-helper-cron

# Monitor logs
wrangler tail chesscom-helper-cron
```

**5. Email Notifications Failing**
```bash
# Test email API key
curl -X POST https://api.sendgrid.v3/mail/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"from@example.com"},"subject":"Test","content":[{"type":"text/plain","value":"Test"}]}'
```

**6. Frontend Build Issues**
```bash
# Clear build cache
rm -rf chesscom_helper/frontend/dist
rm -rf chesscom_helper/frontend/node_modules/.vite

# Rebuild
npm install
npm run build
```

**7. Worker Deployment Errors**
```bash
# Check for syntax errors
wrangler validate

# Deploy with verbose logging
wrangler deploy --verbose
```

## 🚀 Quick Command Reference

### Initial Setup Commands
```bash
# 1. Install tools
npm install -g wrangler @railway/cli

# 2. Authenticate
wrangler login
railway login

# 3. Create Railway project and database
railway new chesscom-helper
railway add postgresql

# 4. Deploy frontend
cd chesscom_helper/frontend
npm run build
wrangler pages create chesscom-helper-frontend
wrangler pages deploy dist --project-name chesscom-helper-frontend

# 5. Deploy API worker
cd ../../chesscom-helper-api
wrangler deploy

# 6. Deploy cron worker
cd ../chesscom-helper-cron
wrangler deploy

# 7. Set up domains
wrangler pages domain add chesscom-helper-frontend your-domain.com
wrangler route add "api.your-domain.com/*" chesscom-helper-api
```

### Monitoring & Maintenance Commands
```bash
# View logs
wrangler tail chesscom-helper-api
wrangler tail chesscom-helper-cron

# Check deployments
wrangler deployments list

# Update secrets
wrangler secret put SECRET_NAME

# Manual cron trigger
curl -X POST https://chesscom-helper-cron.your-subdomain.workers.dev/trigger
```

This comprehensive deployment guide provides everything needed to migrate your Chess.com Helper application from traditional hosting to Cloudflare's edge infrastructure, with significant improvements in performance, scalability, and cost-effectiveness.
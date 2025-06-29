#!/bin/bash
# deploy.sh - Deployment script for D1 architecture

set -e

echo "🚀 Starting deployment to Cloudflare Workers + D1..."

# Get to the project root
cd "$(dirname "$0")/../.."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if we're in a git repository and get branch info
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current)
    COMMIT=$(git rev-parse --short HEAD)
    echo "📋 Deploying branch: $BRANCH (commit: $COMMIT)"
else
    echo "⚠️  Not in a git repository"
fi

# Build frontend
echo "🔨 Building React frontend..."
cd chesscom_helper/frontend
npm ci
npm run build

# Deploy main worker
echo "🚀 Deploying main worker (frontend + API)..."
cd ../../worker-src/main-worker
npm ci
wrangler deploy

# Deploy cron worker
echo "⏰ Deploying cron worker (background jobs)..."
cd ../cron-worker
npm ci
wrangler deploy

# Verify D1 database connection
echo "🗄️ Verifying D1 database connection..."
cd ../../
wrangler d1 execute chesscom-helper-db --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your app should be available at:"
echo "   https://chesscom-helper.emily-flambe.workers.dev"
echo ""
echo "📊 To monitor your deployment:"
echo "   wrangler tail chesscom-helper"
echo "   wrangler tail chesscom-helper-cron"
echo ""
echo "🗄️ To manage your D1 database:"
echo "   wrangler d1 execute chesscom-helper-db --command='SELECT * FROM chesscom_app_user LIMIT 5'"
echo ""
echo "💡 For troubleshooting, see docs/MONITORING.md"

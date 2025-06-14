#!/bin/bash

# Frontend startup script with error handling and retry logic

set -e  # Exit on any error

MAX_RETRIES=3
RETRY_COUNT=0
FRONTEND_DIR="chesscom_helper/frontend"

echo "🚀 Starting Chess.com Helper Frontend..."

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Error: Frontend directory '$FRONTEND_DIR' not found!"
    exit 1
fi

cd "$FRONTEND_DIR"

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Function to start the dev server with retry logic
start_server() {
    local attempt=$1
    echo "🔄 Starting frontend server (attempt $attempt/$MAX_RETRIES)..."
    
    if npm run dev; then
        echo "✅ Frontend server started successfully!"
        return 0
    else
        echo "❌ Failed to start frontend server (attempt $attempt)"
        return 1
    fi
}

# Main retry loop
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if start_server $RETRY_COUNT; then
        exit 0
    fi
    
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "⏳ Waiting 3 seconds before retry..."
        sleep 3
        
        # Try to clean up any stuck processes
        echo "🧹 Cleaning up any stuck processes..."
        pkill -f "npm.*dev" 2>/dev/null || true
        pkill -f "node.*vite" 2>/dev/null || true
        sleep 2
    fi
done

echo "❌ Failed to start frontend server after $MAX_RETRIES attempts"
echo "💡 Try running 'npm install' manually in $FRONTEND_DIR"
exit 1
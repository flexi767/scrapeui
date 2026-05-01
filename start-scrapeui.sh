#!/bin/zsh
set -euo pipefail

# Kill any existing Next.js dev server on port 3000
echo "Stopping existing instances on port 3000..."
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true

cd /Users/v/dev/scrapeui
npm run dev

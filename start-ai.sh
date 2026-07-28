#!/bin/bash
# Start AI services: OpenCode serve + AI Bridge
# Run this after PC restart: bash ~/Desktop/ecopro/start-ai.sh

echo "Starting AI services..."

# Kill any stale processes
lsof -ti:4096 2>/dev/null | xargs -r kill 2>/dev/null
lsof -ti:3456 2>/dev/null | xargs -r kill 2>/dev/null
sleep 1

# Start cloudflared tunnel
pgrep -x cloudflared > /dev/null || nohup cloudflared tunnel run ecopro-ai-bridge > /tmp/cloudflared.log 2>&1 &
echo "  cloudflared: started"

# Start OpenCode serve
nohup opencode serve --port 4096 > /tmp/opencode-serve.log 2>&1 &
echo "  OpenCode serve: starting on port 4096..."

sleep 3

# Start AI Bridge
cd ~/Desktop/ecopro/ai-bridge
nohup node server.js > /tmp/ai-bridge.log 2>&1 &
echo "  AI Bridge: starting on port 3456..."

sleep 2

# Verify
echo ""
echo "=== Status ==="
lsof -i:4096 -i:3456 2>/dev/null | grep LISTEN
pgrep -x cloudflared > /dev/null && echo "cloudflared: running" || echo "cloudflared: NOT running"
echo ""
echo "Done. Persistent URL: ai-bridge.sahla4eco.com"

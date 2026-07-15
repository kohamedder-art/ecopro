#!/usr/bin/env bash
# Start AI servers in visible foreground terminal windows (live logs)
# These run persistently so you can see what's happening

BASE="$HOME/Desktop/ecopro"
BRIDGE_DIR="$BASE/ai-bridge"

# Ensure cloudflared tunnel is running (systemd, runs in background)
systemctl --user start ai-bridge-tunnel.service 2>/dev/null

# Terminal 1: opencode serve (headless AI server)
gnome-terminal --title="OpenCode Serve" -- bash -c "
  export OPENCODE_SERVER_PASSWORD=sahla4eco-bridge
  echo '🔵 Starting OpenCode serve on port 4096...'
  $HOME/.opencode/bin/opencode serve --port 4096
  exec bash
"

sleep 3

# Terminal 2: AI Bridge (middleware between app and opencode)
gnome-terminal --title="AI Bridge Server" -- bash -c "
  export BRIDGE_PORT=3456
  export BRIDGE_API_KEY=sk-bridge-dev
  export OPENCODE_HOST=127.0.0.1
  export OPENCODE_PORT=4096
  export OPENCODE_USER=opencode
  export OPENCODE_PASS=sahla4eco-bridge
  export PRODUCTION_URL=http://localhost:8080
  cd '$BRIDGE_DIR'
  echo '🟢 Starting AI Bridge on port 3456...'
  node server.js
  exec bash
"

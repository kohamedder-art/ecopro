#!/bin/bash
# Starts a Cloudflare tunnel and automatically updates BASE_URL in .env.local (once only)

ENV_FILE="$(dirname "$0")/.env.local"
UPDATED=0

echo "Starting Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:5000 2>&1 | while IFS= read -r line; do
  echo "$line"
  # Only update once — skip if already done
  if [[ $UPDATED -eq 0 ]] && [[ "$line" =~ (https://[a-zA-Z0-9\-]+\.trycloudflare\.com) ]]; then
    NEW_URL="${BASH_REMATCH[1]}"
    UPDATED=1

    echo ""
    echo "✅ Tunnel URL detected: $NEW_URL"
    echo "   Updating BASE_URL in .env.local..."

    # Update BASE_URL
    if grep -q "^BASE_URL=" "$ENV_FILE"; then
      sed -i "s|^BASE_URL=.*|BASE_URL=$NEW_URL|" "$ENV_FILE"
    else
      echo "BASE_URL=$NEW_URL" >> "$ENV_FILE"
    fi

    # Update GOOGLE_REDIRECT_URI if it exists
    if grep -q "^GOOGLE_REDIRECT_URI=" "$ENV_FILE"; then
      sed -i "s|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=$NEW_URL/api/oauth/google/callback|" "$ENV_FILE"
    fi

    echo "   ✅ .env.local updated. Restart the dev server (pnpm dev) to apply."
    echo ""
  fi
done

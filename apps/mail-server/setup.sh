#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTAINER_NAME="magick-cookie-mail"

USER="${1:-me@localhost}"
PASS="${2:-changeme}"

echo "=== magick-cookie mail server setup ==="
echo ""

# 1. Start the container
echo "[1/4] Demarrage du container..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

# 2. Wait for the container to be healthy
echo "[2/4] Attente du demarrage (~15s)..."
sleep 15

# 3. Create mailbox
echo "[3/4] Creation de la boite mail: $USER"
docker exec "$CONTAINER_NAME" setup email add "$USER" "$PASS"

# 4. Generate DKIM keys
echo "[4/4] Generation des cles DKIM..."
docker exec "$CONTAINER_NAME" setup config dkim keysize 2048 || true

echo ""
echo "=== Configuration terminee ==="
echo ""
echo "  Compte : $USER"
echo "  IMAP   : localhost:1993 (SSL self-signed)"
echo "  SMTP   : localhost:1587 (STARTTLS)"
echo ""
echo "  Dans magick-cookie, utilisez le preset 'Self-hosted'"
echo "  et cochez 'Certificat auto-signe'."

#!/bin/bash
# Setup script for Magick Cookie LLM stack
# Pulls recommended models after Ollama is running

set -e

echo "Starting Ollama + Open WebUI..."
docker compose up -d

echo "Waiting for Ollama to be ready..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done

echo "Pulling recommended models..."

# Small & fast — good for summaries, triage, brief
docker exec magick-cookie-ollama ollama pull llama3.2:3b

# Medium — good balance for chat, classification
docker exec magick-cookie-ollama ollama pull mistral:7b

echo ""
echo "Done! LLM stack is ready."
echo ""
echo "  Ollama API:    http://localhost:11434"
echo "  Open WebUI:    http://localhost:3100"
echo ""
echo "Configure in Magick Cookie:"
echo "  Provider: ollama"
echo "  URL:      http://localhost:11434"
echo "  Model:    llama3.2:3b (fast) or mistral:7b (quality)"
echo ""
echo "To pull more models: docker exec magick-cookie-ollama ollama pull <model>"

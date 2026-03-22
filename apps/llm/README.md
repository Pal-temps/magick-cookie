# Magick Cookie — LLM Stack

Stack Docker Ollama pour le LLM local. Voir [docs/infrastructure/llm-stack.md](../../docs/infrastructure/llm-stack.md) pour la documentation complete.

## Demarrage rapide

```bash
docker compose up -d                                          # GPU NVIDIA
docker exec magick-cookie-ollama ollama pull llama3.2:3b      # Pull modele
```

## Configuration dans l'app

Parametres > Intelligence artificielle > Provider: `ollama`, URL: `http://localhost:11434`, Modele: `llama3.2:3b`

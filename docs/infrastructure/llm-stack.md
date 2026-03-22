# LLM Stack (Ollama)

Stack Docker pour le LLM local utilise par Magick Cookie.

## Service

| Service | Port | Description |
|---------|------|-------------|
| Ollama | `11434` | Serveur d'inference LLM local (GPU NVIDIA RTX 4060) |

## Demarrage

```bash
# Avec GPU (NVIDIA) — mode par defaut
cd apps/llm && docker compose up -d

# Setup complet (pull les modeles recommandes)
chmod +x setup.sh && ./setup.sh
```

## Modeles recommandes

| Modele | Taille | Usage | Commande |
|--------|--------|-------|----------|
| `llama3.2:3b` | ~2 GB | Rapide — briefs, resumes, triage | `docker exec magick-cookie-ollama ollama pull llama3.2:3b` |
| `mistral:7b` | ~4 GB | Equilibre — chat, classification | `docker exec magick-cookie-ollama ollama pull mistral:7b` |
| `llama3.1:8b` | ~5 GB | Qualite — raisonnement, analyse | `docker exec magick-cookie-ollama ollama pull llama3.1:8b` |
| `phi3:mini` | ~2 GB | Leger — Microsoft, bon en code | `docker exec magick-cookie-ollama ollama pull phi3:mini` |

## Configuration dans Magick Cookie

Dans **Parametres > Intelligence artificielle** :
- **Provider** : `ollama`
- **URL** : `http://localhost:11434`
- **Modele** : `llama3.2:3b` (ou au choix)

Ou via auto-setup : `POST /api/llm/auto-setup` detecte le container et choisit le meilleur modele.

## Commandes utiles

```bash
docker exec magick-cookie-ollama ollama list              # Modeles installes
docker exec magick-cookie-ollama ollama run llama3.2:3b "Bonjour"  # Tester
docker compose logs -f ollama                              # Logs
docker compose down                                        # Arreter
docker compose down -v                                     # Arreter + supprimer donnees
```

## Ressources

- **GPU NVIDIA** : le docker-compose monte le GPU. Necessite [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- **RAM** : 4 GB minimum pour 3b, 8 GB pour 7b
- **Volume** : `ollama-data` — modeles telecharges (~2-10 GB)

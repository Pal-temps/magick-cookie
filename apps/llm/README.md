# LLM Stack — Magick Cookie

Stack Docker pour le LLM local utilise par Magick Cookie (brief, chat, auto-triage, resume email).

## Services

| Service | Port | Description |
|---------|------|-------------|
| Ollama | `11434` | Serveur d'inference LLM local |
| Open WebUI | `3100` | Interface web pour tester/gerer les modeles |

## Demarrage rapide

### Avec GPU (NVIDIA)

```bash
docker compose up -d
```

### Sans GPU (CPU only)

```bash
docker compose -f docker-compose.cpu.yml up -d
```

### Setup complet (pull les modeles recommandes)

```bash
chmod +x setup.sh
./setup.sh
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
- **Modele** : `llama3.2:3b` (ou le modele de votre choix)

## Commandes utiles

```bash
# Voir les modeles installes
docker exec magick-cookie-ollama ollama list

# Tester un modele
docker exec magick-cookie-ollama ollama run llama3.2:3b "Bonjour"

# Voir les logs
docker compose logs -f ollama

# Arreter
docker compose down

# Arreter et supprimer les donnees
docker compose down -v
```

## Volumes

- `ollama-data` : modeles telecharges (~2-10 GB selon les modeles)
- `webui-data` : configuration Open WebUI + historique conversations

## Ressources

- GPU NVIDIA : le docker-compose par defaut monte le GPU. Necessite [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).
- CPU : utiliser `docker-compose.cpu.yml`. Plus lent mais fonctionnel pour les petits modeles (3b).
- RAM : prevoir au minimum 4 GB libres pour les modeles 3b, 8 GB pour les 7b.

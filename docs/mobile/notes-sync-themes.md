# Notes, Sync & Themes — Mobile Spec

## Notes Vault

### Vue explorateur
- Sidebar avec arborescence dossiers/fichiers
- Recherche par nom ou chemin (filtrage instantane)
- Support fichiers `.md` (edition texte) et `.excalidraw` (schemas)
- Context menu (long press) : nouvelle note, nouveau schema, nouveau dossier, renommer, supprimer
- Renommage inline : l'input remplace le nom sur la ligne de l'item
- Suppression dossier : supprime recursivement avec dialog de confirmation theme

### Editeur
- Markdown : edition texte brut + mode apercu
- Excalidraw : canvas dessin vectoriel (dark/light selon theme)
- Sauvegarde : Ctrl+S ou bouton, indicateur dirty (*)
- Drag-and-drop : accepte taches et contacts depuis la sidebar (MIME `application/x-magick-cookie`)

### Responsive (container queries)

| Largeur | Sidebar | Editeur |
|---------|---------|---------|
| < 500px | Overlay coulissant + bouton toggle | Padding 12px, font 12px |
| 500-899px | 200px fixe | Padding 14px 16px |
| 900-1399px | 260px (defaut) | Padding 16px 20px |
| 1400-1999px | 300px | Padding 24px 32px, max-width 1000px |
| 2000px+ | 340px | Padding 32px 48px, max-width 1200px, font 14px |

### Configuration
- Chemin du dossier vault (compatible Obsidian)
- Remote Git optionnel
- Cle SSH dediee (generation + affichage pubkey)

---

## Git Sync

### Bouton unique "Sync"
Remplace les anciens boutons Pull/Push. Sequence :
1. Sauvegarde le fichier en cours si dirty
2. `git pull` (recupere les changements distants)
3. Recharge les fichiers et le contenu actif
4. `git add . && git commit && git push` (via backend)
5. Rafraichit le statut git

### Statut git
- Badge vert "Clean" / orange "X changes" dans la toolbar
- Indicateur de syncing (bouton disabled + "Sync...")

### Backend Tauri
- `notes_git_pull` — pull avec SSH dediee
- `notes_git_push` — add all + commit + push avec SSH dediee
- `notes_git_status` — statut porcelain

---

## Themes

### 3 themes disponibles
Switcher dropdown dans la TitleBar (icone du theme actif).

#### Dark (defaut)
- Fond : `#0d0d11` → `#2a2a44`
- Accent : `#7c6bf5` (violet)
- Texte : `#e6e6f0`

#### Light
- Fond : `#f8f7f4` → `#e8e7e0`
- Accent : `#5b4cd4` (violet sature)
- Texte : `#1a1a2e`

#### Cookie
- Fond : `#2c1e14` (chocolat) → `#5e4535`
- Accent : `#e8a54b` (cookie dore)
- Texte : `#f5e6d3` (creme vanille)

### Persistance
- `localStorage` cle `magick-cookie-theme`
- Respecte `prefers-color-scheme` si aucun choix utilisateur
- `data-theme` attribut sur `<html>`
- `<meta name="theme-color">` mis a jour dynamiquement

### Implementation technique
- CSS variables dans `variables.css` avec `:root` / `[data-theme="..."]`
- Transition douce 200ms sur background/color/border
- Excalidraw adapte au theme (dark pour dark+cookie, light pour light)

---

## API Endpoints (Notes)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| — | `notes_get_config` | Lire la config vault |
| — | `notes_set_config` | Sauvegarder chemin + remote |
| — | `notes_list` | Lister les fichiers .md |
| — | `notes_list_drawings` | Lister les fichiers .excalidraw |
| — | `notes_list_folders` | Lister les dossiers |
| — | `notes_create_folder` | Creer un dossier |
| — | `notes_read` | Lire le contenu d'un fichier |
| — | `notes_save` | Sauvegarder le contenu d'un fichier |
| — | `notes_rename` | Renommer un fichier ou dossier |
| — | `notes_delete` | Supprimer un fichier |
| — | `notes_delete_folder` | Supprimer un dossier recursivement |
| — | `notes_git_status` | Statut git du vault |
| — | `notes_git_pull` | Git pull |
| — | `notes_git_push` | Git add + commit + push |
| — | `notes_ssh_status` | Verifier si cle SSH existe |
| — | `notes_ssh_generate` | Generer une cle SSH dediee |

> Note : ces endpoints sont des commandes Tauri (IPC), pas des endpoints HTTP.
> Pour la version mobile, il faudra les exposer via l'API REST ou reimplementer en local.

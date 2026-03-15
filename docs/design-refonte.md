# Magick Cookie - Design Refonte

## 1. Renommage

Renommer toutes les occurrences UI-facing de "do-it-now" en **Magick Cookie**.

| Fichier | Changement |
|---------|-----------|
| `apps/desktop/src/ui/components/common/TitleBar.tsx` | Titre affiché dans la barre |
| `apps/desktop/src-tauri/tauri.conf.json` | `title` de la fenetre |
| `apps/desktop/index.html` | `<title>` |
| `apps/desktop/src/ui/views/NotesView.tsx` | MIME type `application/x-do-it-now` → `application/x-magick-cookie`, suffixe temp files |
| `apps/desktop/src/ui/views/ContactManager.tsx` | MIME type drag-and-drop |
| `apps/desktop/src/ui/components/calendar/UnscheduledTasks.tsx` | MIME type drag-and-drop |

> Le nom du package npm, du repo git et du container Docker restent inchanges pour l'instant.

---

## 2. Palettes de couleurs

### 2.1 Dark Theme (defaut)

Theme sombre actuel, raffine avec des tons plus profonds et un accent violet/indigo.

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--bg-base` | `#0d0d11` | Fond principal |
| `--bg-surface` | `#161620` | Cartes, sidebar |
| `--bg-elevated` | `#1f1f33` | Modals, popovers |
| `--bg-overlay` | `#2a2a44` | Overlays, dropdowns |
| `--accent-primary` | `#7c6bf5` | Boutons, liens, focus |
| `--accent-primary-hover` | `#9584ff` | Hover accent |
| `--accent-secondary` | `#f5a623` | Badges, notifications |
| `--text-primary` | `#e6e6f0` | Texte principal |
| `--text-secondary` | `#8585a5` | Texte secondaire |
| `--text-muted` | `#505068` | Placeholder, desactive |
| `--border-color` | `#262640` | Bordures par defaut |
| `--border-hover` | `#38385a` | Bordures au hover |
| `--success` | `#2ecc71` | Validation, done |
| `--warning` | `#f5a623` | Avertissements |
| `--danger` | `#e74c3c` | Erreurs, suppression |

### 2.2 Light Theme

Theme clair avec une base creme/warm white pour un rendu doux, pas agressif.

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--bg-base` | `#f8f7f4` | Fond principal |
| `--bg-surface` | `#ffffff` | Cartes, sidebar |
| `--bg-elevated` | `#f0efe8` | Modals, popovers |
| `--bg-overlay` | `#e8e7e0` | Overlays, dropdowns |
| `--accent-primary` | `#5b4cd4` | Boutons, liens, focus |
| `--accent-primary-hover` | `#4a3cb8` | Hover accent |
| `--accent-secondary` | `#e6930e` | Badges, notifications |
| `--text-primary` | `#1a1a2e` | Texte principal |
| `--text-secondary` | `#5c5c7a` | Texte secondaire |
| `--text-muted` | `#9090a8` | Placeholder, desactive |
| `--border-color` | `#d8d8e0` | Bordures par defaut |
| `--border-hover` | `#c0c0d0` | Bordures au hover |
| `--success` | `#1ea85a` | Validation, done |
| `--warning` | `#d4880c` | Avertissements |
| `--danger` | `#c0392b` | Erreurs, suppression |

### 2.3 Cookie Theme

Theme gourmand et chaleureux inspire des cookies, chocolat et caramel. L'identite visuelle signature de Magick Cookie.

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--bg-base` | `#2c1e14` | Fond chocolat noir |
| `--bg-surface` | `#3d2b1e` | Cartes — chocolat au lait |
| `--bg-elevated` | `#4e3828` | Modals — biscuit fonce |
| `--bg-overlay` | `#5e4535` | Overlays — cacao |
| `--accent-primary` | `#e8a54b` | Cookie dore — action principale |
| `--accent-primary-hover` | `#f0b85e` | Cookie dore clair — hover |
| `--accent-secondary` | `#c46a2c` | Caramel — accent secondaire |
| `--text-primary` | `#f5e6d3` | Creme vanille — texte principal |
| `--text-secondary` | `#c4a882` | Noisette — texte secondaire |
| `--text-muted` | `#8c7560` | Cannelle — placeholder |
| `--border-color` | `#5a3f2a` | Cacao border |
| `--border-hover` | `#7a5a3e` | Noisette border hover |
| `--success` | `#7cb342` | Pistache |
| `--warning` | `#f0a030` | Caramel chaud |
| `--danger` | `#d44a2a` | Piment |

### Calendar event colors par theme

| Evenement | Dark | Light | Cookie |
|-----------|------|-------|--------|
| `--cal-blue` | `#0984e3` | `#2e86de` | `#5dade2` |
| `--cal-green` | `#00b894` | `#1ea85a` | `#7cb342` |
| `--cal-orange` | `#fdcb6e` | `#e67e22` | `#f0a030` |
| `--cal-pink` | `#fd79a8` | `#e84393` | `#e07888` |
| `--cal-red` | `#d63031` | `#c0392b` | `#d44a2a` |
| `--cal-purple` | `#6c5ce7` | `#5b4cd4` | `#a876d4` |

---

## 3. Implementation technique

### 3.1 Mecanisme de theming

Approche : attribut `data-theme` sur `<html>`, les variables CSS sont redefinies dans chaque scope.

```css
/* variables.css */
:root,
[data-theme="dark"] {
  --bg-base: #0d0d11;
  /* ... */
}

[data-theme="light"] {
  --bg-base: #f8f7f4;
  /* ... */
}

[data-theme="cookie"] {
  --bg-base: #2c1e14;
  /* ... */
}
```

### 3.2 Theme store (SolidJS)

Creer un store `createThemeStore` dans `apps/desktop/src/ui/stores/` :
- Lit le theme depuis `localStorage`
- Applique `data-theme` sur `document.documentElement`
- Expose `theme()` et `setTheme()`
- Respecte `prefers-color-scheme` si aucun choix utilisateur

### 3.3 Theme switcher UI

Ajouter un composant `ThemeSwitcher` dans la barre de titre ou les settings :
- 3 boutons/icones : soleil (light), lune (dark), cookie (cookie)
- Transition douce entre themes (`transition: background 200ms ease, color 200ms ease`)

### 3.4 Meta theme-color

Mettre a jour dynamiquement `<meta name="theme-color">` selon le theme actif pour que la barre de titre OS s'adapte.

---

## 4. Etapes de travail

| # | Tache | Fichiers |
|---|-------|----------|
| 1 | Renommer UI "do-it-now" → "Magick Cookie" | TitleBar, tauri.conf, index.html, MIME types |
| 2 | Ajouter les variables semantiques manquantes | `variables.css` (success, warning, danger, accent-secondary) |
| 3 | Restructurer `variables.css` avec les 3 themes | `variables.css` |
| 4 | Creer le theme store SolidJS | `stores/themeStore.ts` |
| 5 | Ajouter le ThemeSwitcher dans la TitleBar | `ThemeSwitcher.tsx`, `TitleBar.tsx` |
| 6 | Adapter Excalidraw au theme actif | `DrawingsView.tsx` |
| 7 | Mettre a jour meta theme-color dynamiquement | `index.html`, theme store |
| 8 | Tester les 3 themes sur tous les composants | Manuel |
| 9 | Ajuster les contrastes (accessibilite WCAG AA) | `variables.css` |

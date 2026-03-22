# Themes & Palettes

3 themes disponibles. Mecanisme : attribut `data-theme` sur `<html>`, variables CSS redefinies par scope.

## Dark Theme (defaut)

Sombre avec accent violet/indigo.

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
| `--border-color` | `#262640` | Bordures |
| `--border-hover` | `#38385a` | Bordures hover |
| `--success` | `#2ecc71` | Validation |
| `--warning` | `#f5a623` | Avertissements |
| `--danger` | `#e74c3c` | Erreurs, suppression |

## Light Theme

Base creme/warm white, rendu doux.

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
| `--border-color` | `#d8d8e0` | Bordures |
| `--border-hover` | `#c0c0d0` | Bordures hover |
| `--success` | `#1ea85a` | Validation |
| `--warning` | `#d4880c` | Avertissements |
| `--danger` | `#c0392b` | Erreurs, suppression |

## Cookie Theme

Chocolat, caramel, noisette. L'identite visuelle signature.

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--bg-base` | `#2c1e14` | Chocolat noir |
| `--bg-surface` | `#3d2b1e` | Chocolat au lait |
| `--bg-elevated` | `#4e3828` | Biscuit fonce |
| `--bg-overlay` | `#5e4535` | Cacao |
| `--accent-primary` | `#e8a54b` | Cookie dore |
| `--accent-primary-hover` | `#f0b85e` | Cookie dore clair |
| `--accent-secondary` | `#c46a2c` | Caramel |
| `--text-primary` | `#f5e6d3` | Creme vanille |
| `--text-secondary` | `#c4a882` | Noisette |
| `--text-muted` | `#8c7560` | Cannelle |
| `--border-color` | `#5a3f2a` | Cacao border |
| `--border-hover` | `#7a5a3e` | Noisette border |
| `--success` | `#7cb342` | Pistache |
| `--warning` | `#f0a030` | Caramel chaud |
| `--danger` | `#d44a2a` | Piment |

## Couleurs calendrier par theme

| Event | Dark | Light | Cookie |
|-------|------|-------|--------|
| `--cal-blue` | `#0984e3` | `#2e86de` | `#5dade2` |
| `--cal-green` | `#00b894` | `#1ea85a` | `#7cb342` |
| `--cal-orange` | `#fdcb6e` | `#e67e22` | `#f0a030` |
| `--cal-pink` | `#fd79a8` | `#e84393` | `#e07888` |
| `--cal-red` | `#d63031` | `#c0392b` | `#d44a2a` |
| `--cal-purple` | `#6c5ce7` | `#5b4cd4` | `#a876d4` |

## Implementation

```css
:root, [data-theme="dark"] { --bg-base: #0d0d11; /* ... */ }
[data-theme="light"] { --bg-base: #f8f7f4; /* ... */ }
[data-theme="cookie"] { --bg-base: #2c1e14; /* ... */ }
```

- Store SolidJS `createThemeStore` : lit localStorage, applique `data-theme`, expose `theme()` / `setTheme()`
- Mode auto : `prefers-color-scheme` media query ou horaire configurable
- Transition douce : `transition: background 200ms ease, color 200ms ease`
- Meta `theme-color` dynamique pour la barre OS

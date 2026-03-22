# UI / UX

> Statut : **Done** — 3 themes, command palette, raccourcis globaux, mode offline, sidebar, branding.

Ensemble des features transverses d'interface et d'experience utilisateur.

## Theming

- 3 themes : **Dark** (defaut), **Light**, **Cookie** (chocolat/caramel)
- Mecanisme : attribut `data-theme` sur `<html>`, variables CSS redefinies par scope
- Modes : manuel, auto systeme (`prefers-color-scheme`), auto horaire (configurable)
- `ThemeSwitcher.tsx` dans la barre de titre
- Meta `theme-color` dynamique pour la barre OS
- Voir [../design/themes.md](../design/themes.md) pour les palettes completes

## Command Palette (Ctrl+K)

- Prefixes : `go:` (bookmarks), `snip:` (snippets), `n:` (notes)
- Historique des 10 dernieres commandes (localStorage)
- Scoring de pertinence
- `commandStore.ts` + `CommandPalette.tsx`

## Raccourcis globaux Windows

| Raccourci | Action |
|-----------|--------|
| `Win+Shift+N` | Quick Capture (popup flottant, tache ou note) |
| `Win+Shift+T` | Start/stop timer |
| `Win+Shift+B` | Brief du jour |
| `Win+Shift+D` | Toggle mode bureau |

- `tauri-plugin-global-shortcut`
- Enregistrement dans `lib.rs`, events vers le frontend
- Raccourcis personnalisables par l'utilisateur (`ShortcutSettings.tsx`)

## Quick Capture

- `Win+Shift+N` → popup 300x150px au centre, toujours au premier plan
- `Enter` → sauvegarde comme tache inbox
- `Shift+Enter` → sauvegarde comme note
- `Escape` → ferme sans sauvegarder
- Fenetre Tauri separee "capture"

## Mode Offline

- Queue offline en IndexedDB
- Detection auto de la perte de connexion
- Replay automatique au retour de la connexion
- `OfflineIndicator.tsx` dans la barre de titre
- `offlineQueue.ts` + wrapper `apiClient.ts`

## Sidebar

- Sections reordonnables par drag & drop
- Persistance en localStorage
- Nav adaptative + `CalendarSubBar`

## Branding

- Icone cookie (chocolate chip) sur toutes les tailles
- PNG (32, 128, 256, 512), ICO, Store logos
- Window icon set via Rust `set_icon()` pour taskbar/processus
- Containers Docker renommes `magick-cookie-*`

## Splash Screen

- Theme-aware avec radial glow et titre app
- Gestion gracieuse quand API inaccessible

## Calendrier

- Vues mois/semaine/jour
- CalDAV sync bidirectionnel (Google Calendar, Outlook) via `tsdav`
- Clic sur cellule vide → formulaire creation
- Clic droit → context menu (nouvel event / nouvelle alarme)
- Alarmes comme pseudo-events avec badge "A" orange
- Generation events par IA (`POST /api/llm/generate-events`)
- `AiEventGenerator` modal avec preview + bulk creation

### DB
- `caldav_accounts` (label, url, credentials, sync state)
- `events` (title, start, end, calendar, recurrence...)
- `alarms` (time, label, enabled, sound)

## Horloge

- Date + heure centree dans la barre de titre

## Clipboard History

- `clipboardStore.ts` + command palette `clip:` prefix

## Settings centralises

- `settingsStore` unifie
- API `user-preferences` sync
- UI settings par onglet

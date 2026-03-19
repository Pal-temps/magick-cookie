# Preferences utilisateur & Sync — Mobile Spec

## Objectif

Synchroniser les preferences d'interface entre le desktop et le mobile via l'API backend. Les preferences sont stockees en local (SharedPreferences cote Android) et peuvent etre sauvegardees/restaurees depuis le serveur a la demande de l'utilisateur.

**Securite :** Aucune donnee sensible (API keys, tokens, mots de passe) n'est jamais incluse dans le blob de preferences.

## Architecture

```
Mobile App ←→ API Backend ←→ DB (table user_preferences, singleton)
     ↕
SharedPreferences (local)
```

- Les preferences sont stockees localement pour le fonctionnement offline
- La sync est manuelle (boutons "Sauvegarder" / "Restaurer"), pas automatique
- Le serveur stocke un seul blob JSON versionne

---

## Schema UserPreferences

```typescript
interface UserPreferences {
  version: 1;
  theme: {
    theme: "dark" | "light" | "cookie";
    mode: "manual" | "auto-system" | "auto-schedule";
    schedule: { darkStart: number; darkEnd: number }; // heures 0-23
  };
  focus: { enabled: boolean };
  dashboard: {
    widgetOrder: string[];     // ex: ["timer", "water", "wellness"]
    hiddenWidgets: string[];   // widgets masques
  };
  shortcuts: {
    custom: [string, string][]; // [actionId, shortcut][]
  };
  brief: {
    customTemplates: { id: string; name: string; prompt: string }[];
    activeTemplateId: string;
  };
  env: {
    customChecks: { name: string; url: string }[];
  };
  vps: { notificationsEnabled: boolean };
  sidebar: { sectionOrder: string[] };
}
```

### Valeurs par defaut

| Section | Defaut |
|---------|--------|
| theme.theme | `"dark"` |
| theme.mode | `"manual"` |
| theme.schedule | `{ darkStart: 20, darkEnd: 7 }` |
| focus.enabled | `true` |
| dashboard.widgetOrder | `["timer", "daily-stats", "water", "fruits", "dog-walk", "today-events", "wellness", "alarms", "streak", "github-prs", "vps", "analytics"]` |
| dashboard.hiddenWidgets | `[]` |
| shortcuts.custom | `[]` |
| brief.customTemplates | `[]` |
| brief.activeTemplateId | `"standup-fr"` |
| env.customChecks | `[]` |
| vps.notificationsEnabled | `true` |
| sidebar.sectionOrder | `["favoris", "filtres", "contacts", "taches"]` |

---

## API Endpoints

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/user-preferences` | Recuperer les preferences (ou `null`) |
| PUT | `/api/user-preferences` | Sauvegarder les preferences (upsert) |

### GET /api/user-preferences

Retourne les preferences stockees sur le serveur.

**Reponse :**
```json
{
  "data": { /* UserPreferences */ }
}
```

Retourne `{ "data": null }` si aucune preference n'a ete sauvegardee.

### PUT /api/user-preferences

Sauvegarde (upsert) le blob de preferences. Le body est valide par un schema Zod strict — seuls les champs du schema `UserPreferences` sont acceptes. Les champs inconnus sont ignores (whitelist).

**Body :** `UserPreferences` (schema complet, version: 1 obligatoire)

**Reponse :**
```json
{
  "data": { /* UserPreferences sauvegardees */ }
}
```

**Erreurs :**
- `400` — Body invalide (validation Zod echouee)

---

## Validation Zod (backend)

Le schema Zod applique les regles suivantes :

| Champ | Contrainte |
|-------|------------|
| `version` | Literal `1` |
| `theme.theme` | Enum `"dark" | "light" | "cookie"` |
| `theme.mode` | Enum `"manual" | "auto-system" | "auto-schedule"` |
| `theme.schedule.darkStart` | int 0-23 |
| `theme.schedule.darkEnd` | int 0-23 |
| `focus.enabled` | boolean |
| `dashboard.widgetOrder` | string[] (max 50 chars par item) |
| `dashboard.hiddenWidgets` | string[] (max 50 chars par item) |
| `shortcuts.custom` | [string, string][] (max 100 chars par element) |
| `brief.customTemplates[].id` | string max 100 |
| `brief.customTemplates[].name` | string max 255 |
| `brief.customTemplates[].prompt` | string max 5000 |
| `brief.activeTemplateId` | string max 100 |
| `env.customChecks[].name` | string max 255 |
| `env.customChecks[].url` | string max 1000 |
| `vps.notificationsEnabled` | boolean |
| `sidebar.sectionOrder` | string[] (max 50 chars par item) |

---

## Implementation mobile (Kotlin)

### Data class

```kotlin
@Serializable
data class UserPreferences(
    val version: Int = 1,
    val theme: ThemePrefs = ThemePrefs(),
    val focus: FocusPrefs = FocusPrefs(),
    val dashboard: DashboardPrefs = DashboardPrefs(),
    val shortcuts: ShortcutPrefs = ShortcutPrefs(),
    val brief: BriefPrefs = BriefPrefs(),
    val env: EnvPrefs = EnvPrefs(),
    val vps: VpsPrefs = VpsPrefs(),
    val sidebar: SidebarPrefs = SidebarPrefs()
)

@Serializable
data class ThemePrefs(
    val theme: String = "dark",
    val mode: String = "manual",
    val schedule: ThemeSchedule = ThemeSchedule()
)

@Serializable
data class ThemeSchedule(val darkStart: Int = 20, val darkEnd: Int = 7)

@Serializable
data class FocusPrefs(val enabled: Boolean = true)

@Serializable
data class DashboardPrefs(
    val widgetOrder: List<String> = emptyList(),
    val hiddenWidgets: List<String> = emptyList()
)

@Serializable
data class ShortcutPrefs(val custom: List<List<String>> = emptyList())

@Serializable
data class BriefPrefs(
    val customTemplates: List<BriefTemplate> = emptyList(),
    val activeTemplateId: String = "standup-fr"
)

@Serializable
data class BriefTemplate(val id: String, val name: String, val prompt: String)

@Serializable
data class EnvPrefs(val customChecks: List<EnvCheck> = emptyList())

@Serializable
data class EnvCheck(val name: String, val url: String)

@Serializable
data class VpsPrefs(val notificationsEnabled: Boolean = true)

@Serializable
data class SidebarPrefs(val sectionOrder: List<String> = emptyList())
```

### Retrofit service

```kotlin
interface UserPreferencesApi {
    @GET("api/user-preferences")
    suspend fun get(): ApiResponse<UserPreferences?>

    @PUT("api/user-preferences")
    suspend fun save(@Body prefs: UserPreferences): ApiResponse<UserPreferences>
}
```

### Stockage local

```kotlin
class PreferencesRepository(
    private val sharedPrefs: SharedPreferences,
    private val api: UserPreferencesApi
) {
    private val key = "magick-cookie-preferences"
    private val json = Json { ignoreUnknownKeys = true }

    fun getLocal(): UserPreferences {
        val raw = sharedPrefs.getString(key, null) ?: return UserPreferences()
        return try { json.decodeFromString(raw) } catch (_: Exception) { UserPreferences() }
    }

    fun saveLocal(prefs: UserPreferences) {
        sharedPrefs.edit().putString(key, json.encodeToString(prefs)).apply()
    }

    suspend fun syncToServer(prefs: UserPreferences): Result<UserPreferences> = runCatching {
        api.save(prefs).data!!
    }

    suspend fun restoreFromServer(): Result<UserPreferences?> = runCatching {
        api.get().data
    }
}
```

---

## UX mobile

### Ecran Settings > Donnees

- Titre : "Synchronisation des preferences"
- Message : "Seules les preferences d'interface sont synchronisees. Les cles API, mots de passe et tokens ne sont jamais inclus."
- Bouton **"Sauvegarder sur le serveur"** → appel PUT, feedback toast succes/erreur
- Bouton **"Restaurer depuis le serveur"** → appel GET, ecrase les prefs locales, feedback toast
- Texte "Derniere sync : ..." (timestamp stocke en SharedPreferences `magick-cookie-last-sync`)

### Sections de preferences utilisables cote mobile

| Section | Usage mobile | Notes |
|---------|-------------|-------|
| `theme` | Oui | Appliquer le theme + mode auto |
| `focus` | Oui | Focus mode pendant les timers |
| `dashboard` | Oui | Ordre et visibilite des widgets dashboard |
| `shortcuts` | Non | Raccourcis clavier = desktop only |
| `brief` | Oui | Templates custom pour les briefs |
| `env` | Partiel | Les checks sont surtout utiles en desktop, mais les custom checks pourraient etre utilises |
| `vps` | Oui | Toggle notifications VPS |
| `sidebar` | Non | La sidebar mobile a son propre layout |

---

## DB Schema

Table `user_preferences` (singleton — une seule ligne) :

| Colonne | Type | Defaut |
|---------|------|--------|
| `id` | uuid | `gen_random_uuid()` |
| `data` | text (JSON) | — |
| `created_at` | timestamptz | `now()` |
| `updated_at` | timestamptz | `now()` |

Migration : `drizzle/0026_user_preferences.sql`

---

## Points d'attention

1. **Versioning** : le champ `version: 1` permet de gerer les migrations futures du schema de preferences
2. **Merge vs overwrite** : actuellement la sync ecrase completement (pas de merge). Si l'app mobile et desktop modifient des sections differentes, la derniere sauvegarde gagne. Un merge par section pourrait etre ajoute plus tard
3. **Offline** : les preferences locales fonctionnent toujours, la sync est un bonus quand le serveur est accessible
4. **Securite** : le schema Zod backend rejette tout champ non declare — impossible d'injecter des donnees sensibles

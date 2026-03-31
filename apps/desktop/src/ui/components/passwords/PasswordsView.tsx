import { createSignal, Show, For, onMount } from "solid-js";
import { useSecretsStore, type SecretEntry, type SecretGroup } from "../../../application/stores/secretsStore";
import { PasswordGenerator } from "./PasswordGenerator";
import { SshKeyManager } from "./SshKeyManager";
import "../../styles/passwords.css";

// Default groups managed by the app — cannot be renamed or deleted
// Only exact matches are protected, not their children
const PROTECTED_GROUPS = ["Root", "Root/App Secrets", "Root/Passwords"];

function isProtected(groupPath: string): boolean {
  return PROTECTED_GROUPS.includes(groupPath);
}

// Flatten group tree into a list of paths for the dropdown
function flattenGroups(group: SecretGroup, result: string[] = []): string[] {
  result.push(group.path);
  for (const child of group.children) flattenGroups(child, result);
  return result;
}

export function PasswordsView() {
  const secrets = useSecretsStore();
  const [showPassword, setShowPassword] = createSignal<Record<string, boolean>>({});
  const [revealedPassword, setRevealedPassword] = createSignal<Record<string, string>>({});
  const [editMode, setEditMode] = createSignal(false);
  const [showGenerator, setShowGenerator] = createSignal(false);
  const [showSshKeys, setShowSshKeys] = createSignal(false);
  const [newEntry, setNewEntry] = createSignal<Partial<SecretEntry>>({});
  const [selectedEntry, setSelectedEntry] = createSignal<SecretEntry | null>(null);
  const [searchInput, setSearchInput] = createSignal("");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  // Group management
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; group: SecretGroup } | null>(null);
  const [newGroupName, setNewGroupName] = createSignal("");
  const [showNewGroup, setShowNewGroup] = createSignal(false);
  const [renameGroup, setRenameGroup] = createSignal<{ group: SecretGroup; name: string } | null>(null);

  onMount(async () => {
    if (!secrets.isUnlocked()) return;
    try {
      await secrets.fetchGroups();
      await secrets.fetchEntries();
    } catch (e) {
      console.error("PasswordsView mount error:", e);
    }
  });

  // ─── Search ───
  async function handleSearch(q: string) {
    setSearchInput(q);
    await secrets.search(q);
  }

  // ─── Password actions ───
  async function togglePassword(id: string) {
    if (showPassword()[id]) {
      setShowPassword((prev) => ({ ...prev, [id]: false }));
      return;
    }
    const pwd = await secrets.getPassword(id);
    setRevealedPassword((prev) => ({ ...prev, [id]: pwd }));
    setShowPassword((prev) => ({ ...prev, [id]: true }));
  }

  async function copyPassword(id: string) {
    const pwd = await secrets.getPassword(id);
    await navigator.clipboard.writeText(pwd);
    setCopiedId(id);
    setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === pwd) await navigator.clipboard.writeText("");
      } catch {}
      setCopiedId(null);
    }, 30000);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ─── Entry CRUD ───
  function startCreate() {
    const group = secrets.activeGroup() ?? "Root/Passwords";
    setNewEntry({ group, title: "", username: "", password: "", url: "", notes: "", tags: [] });
    setEditMode(true);
    setSelectedEntry(null);
  }

  function startEdit(entry: SecretEntry) {
    setNewEntry({ ...entry });
    setEditMode(true);
    setSelectedEntry(entry);
  }

  async function saveEntry() {
    const e = newEntry();
    if (!e.title) return;
    await secrets.saveEntry({
      id: selectedEntry()?.id ?? "",
      group: e.group ?? "Passwords",
      title: e.title ?? "",
      username: e.username ?? "",
      password: e.password ?? undefined,
      url: e.url ?? "",
      notes: e.notes ?? "",
      tags: e.tags ?? [],
    });
    setEditMode(false);
    setNewEntry({});
    setSelectedEntry(null);
  }

  async function deleteEntry(id: string) {
    if (!confirm("Supprimer cette entree ?")) return;
    await secrets.deleteEntry(id);
    setSelectedEntry(null);
  }

  // ─── Group selection ───
  function selectGroup(path: string | null) {
    secrets.setActiveGroup(path);
    secrets.fetchEntries(path ?? undefined);
  }

  // ─── Group context menu ───
  function handleGroupContextMenu(e: MouseEvent, group: SecretGroup) {
    if (isProtected(group.path)) return; // No context menu for protected groups
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, group });
    requestAnimationFrame(() => {
      const close = () => { setContextMenu(null); document.removeEventListener("mousedown", close); };
      document.addEventListener("mousedown", close);
    });
  }

  // ─── Group CRUD ───
  async function handleCreateGroup() {
    const name = newGroupName().trim();
    if (!name) return;
    const parentPath = secrets.activeGroup() ?? "Root/Passwords";
    // Create a dummy entry in the new group to force group creation
    await secrets.saveEntry({
      id: "", group: `${parentPath}/${name}`, title: "__group_init__",
      username: "", url: "", notes: "Group placeholder", tags: [],
    });
    // Delete the placeholder
    await secrets.fetchEntries(`${parentPath}/${name}`);
    const placeholder = secrets.entries().find((e) => e.title === "__group_init__");
    if (placeholder) await secrets.deleteEntry(placeholder.id);
    await secrets.fetchGroups();
    setShowNewGroup(false);
    setNewGroupName("");
  }

  function startRenameGroup(group: SecretGroup) {
    setContextMenu(null);
    setRenameGroup({ group, name: group.name });
  }

  async function confirmRenameGroup() {
    // Note: KeePass doesn't natively support renaming groups via the keepass-rs crate's public API.
    // We'd need to move all entries. For now, show info.
    setRenameGroup(null);
    alert("Renommage de groupe : fonctionnalite a venir (necessite de deplacer toutes les entrees).");
  }

  async function handleDeleteGroup(group: SecretGroup) {
    setContextMenu(null);
    if (isProtected(group.path)) return;
    if (!confirm(`Supprimer le groupe "${group.name}" et toutes ses entrees ?`)) return;
    // Delete all entries in the group
    await secrets.fetchEntries(group.path);
    for (const entry of secrets.entries()) {
      await secrets.deleteEntry(entry.id);
    }
    await secrets.fetchGroups();
    await secrets.fetchEntries();
    selectGroup(null);
  }

  // ─── Available groups for dropdown ───
  function groupOptions(): string[] {
    const root = secrets.groups();
    if (!root) return ["Passwords"];
    return flattenGroups(root).filter((p) => p !== "Root"); // Exclude root itself
  }

  // ─── Group tree render ───
  function renderGroup(group: SecretGroup, depth = 0) {
    const isActive = secrets.activeGroup() === group.path;
    const locked = isProtected(group.path);
    return (
      <div>
        <button
          class={`pwd-group ${isActive ? "pwd-group--active" : ""}`}
          style={{ "padding-left": `${12 + depth * 12}px` }}
          onClick={() => selectGroup(group.path)}
          onContextMenu={(e) => handleGroupContextMenu(e, group)}
        >
          <span class="pwd-group__name">{group.name}</span>
          <Show when={locked}>
            <span class="pwd-group__lock">&#x1F512;</span>
          </Show>
          <Show when={group.entry_count > 0}>
            <span class="pwd-group__count">{group.entry_count}</span>
          </Show>
        </button>
        <For each={group.children}>
          {(child) => renderGroup(child, depth + 1)}
        </For>
      </div>
    );
  }

  // ─── Guard ───
  if (!secrets.isUnlocked()) {
    return (
      <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "100%", "flex-direction": "column", gap: "12px", color: "var(--text-muted)" }}>
        <div style={{ "font-size": "32px", opacity: "0.4" }}>&#x1F512;</div>
        <div style={{ "font-size": "15px", "font-weight": "600", color: "var(--text-primary)" }}>Coffre-fort verrouille</div>
        <div style={{ "font-size": "13px", "max-width": "300px", "text-align": "center" }}>
          Configurez un vault notes et deverrouillez le coffre-fort pour acceder au gestionnaire de mots de passe.
        </div>
      </div>
    );
  }

  return (
    <div class="pwd-layout">
      {/* ─── Sidebar: groups ─── */}
      <div class="pwd-sidebar">
        <div class="pwd-sidebar__header">
          <span>Groupes</span>
        </div>

        <div class="pwd-sidebar__list">
          <button
            class={`pwd-group ${secrets.activeGroup() === null ? "pwd-group--active" : ""}`}
            onClick={() => selectGroup(null)}
          >
            <span class="pwd-group__name">Tous</span>
          </button>
          <Show when={secrets.groups()}>
            <For each={secrets.groups()!.children}>
              {(group) => renderGroup(group)}
            </For>
          </Show>
        </div>

        {/* Bottom actions */}
        <div class="pwd-sidebar__footer">
          <Show when={!showNewGroup()}>
            <button class="pwd-btn pwd-btn--sm" style={{ width: "100%" }} onClick={() => setShowNewGroup(true)}>
              + Nouveau groupe
            </button>
          </Show>
          <Show when={showNewGroup()}>
            <div class="pwd-sidebar__new-group">
              <input
                autofocus
                class="pwd-sidebar__new-group-input"
                value={newGroupName()}
                onInput={(e) => setNewGroupName(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); if (e.key === "Escape") setShowNewGroup(false); }}
                placeholder="Nom du groupe"
              />
              <div style={{ display: "flex", gap: "4px" }}>
                <button class="pwd-btn pwd-btn--sm pwd-btn--primary" onClick={handleCreateGroup}>OK</button>
                <button class="pwd-btn pwd-btn--sm" onClick={() => setShowNewGroup(false)}>x</button>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* ─── Main ─── */}
      <div class="pwd-main">
        {/* Toolbar */}
        <div class="pwd-toolbar">
          <div class="pwd-search">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchInput()}
              onInput={(e) => handleSearch(e.currentTarget.value)}
              class="pwd-search__input"
            />
          </div>
          <button class="pwd-btn pwd-btn--primary" onClick={startCreate}>+ Nouveau</button>
          <button class="pwd-btn" onClick={() => setShowGenerator((v) => !v)}>Generateur</button>
          <button class={`pwd-btn ${showSshKeys() ? "pwd-btn--primary" : ""}`} onClick={() => setShowSshKeys((v) => !v)}>Cles SSH</button>
          <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "6px", "font-size": "11px", color: "var(--text-secondary)" }}>
            <span>Auto-lock:</span>
            <select
              value={secrets.autoLockMinutes()}
              onChange={(e) => secrets.setAutoLockMinutes(parseInt(e.currentTarget.value, 10))}
              style={{ padding: "2px 4px", "font-size": "11px", background: "var(--bg-base)", border: "1px solid var(--border-color)", "border-radius": "var(--radius-sm)", color: "var(--text-primary)" }}
            >
              <option value="0">Jamais</option>
              <option value="5">5 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 heure</option>
            </select>
            <button class="pwd-btn pwd-btn--sm" onClick={() => secrets.lock()} title="Verrouiller maintenant">&#x1F512;</button>
          </div>
        </div>

        <Show when={showGenerator()}>
          <PasswordGenerator onInsert={(pwd) => {
            if (editMode()) setNewEntry((prev) => ({ ...prev, password: pwd }));
            setShowGenerator(false);
          }} />
        </Show>

        <Show when={showSshKeys()}>
          <SshKeyManager />
        </Show>

        {/* ─── Edit form ─── */}
        <Show when={editMode()}>
          <div class="pwd-edit-form">
            <div class="pwd-edit-form__header">
              {selectedEntry() ? "Modifier" : "Nouvelle entree"}
              <button class="pwd-edit-form__close" onClick={() => setEditMode(false)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="pwd-edit-form__body">
              {/* Group dropdown */}
              <label class="pwd-field">
                <span>Groupe</span>
                <select
                  class="pwd-field__select"
                  value={newEntry().group ?? ""}
                  onChange={(e) => setNewEntry((p) => ({ ...p, group: e.currentTarget.value }))}
                >
                  <For each={groupOptions()}>
                    {(path) => {
                      const label = path.replace("Root/", "").replace(/\//g, " / ");
                      return <option value={path}>{label}</option>;
                    }}
                  </For>
                </select>
              </label>
              <label class="pwd-field">
                <span>Titre</span>
                <input value={newEntry().title ?? ""} onInput={(e) => setNewEntry((p) => ({ ...p, title: e.currentTarget.value }))} placeholder="github.com" />
              </label>
              <label class="pwd-field">
                <span>Utilisateur</span>
                <input value={newEntry().username ?? ""} onInput={(e) => setNewEntry((p) => ({ ...p, username: e.currentTarget.value }))} placeholder="user@example.com" />
              </label>
              <label class="pwd-field">
                <span>Mot de passe</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <input type="password" value={newEntry().password ?? ""} onInput={(e) => setNewEntry((p) => ({ ...p, password: e.currentTarget.value }))} style={{ flex: "1" }} />
                  <button class="pwd-btn" onClick={() => setShowGenerator(true)}>Gen</button>
                </div>
              </label>
              <label class="pwd-field">
                <span>URL</span>
                <input value={newEntry().url ?? ""} onInput={(e) => setNewEntry((p) => ({ ...p, url: e.currentTarget.value }))} placeholder="https://..." />
              </label>
              <label class="pwd-field">
                <span>Notes</span>
                <textarea value={newEntry().notes ?? ""} onInput={(e) => setNewEntry((p) => ({ ...p, notes: e.currentTarget.value }))} rows={3} />
              </label>
              <div class="pwd-edit-form__actions">
                <button class="pwd-btn" onClick={() => setEditMode(false)}>Annuler</button>
                <button class="pwd-btn pwd-btn--primary" onClick={saveEntry}>Enregistrer</button>
              </div>
            </div>
          </div>
        </Show>

        {/* ─── Entry list ─── */}
        <Show when={!editMode()}>
          <div class="pwd-list">
            <For each={secrets.entries()} fallback={
              <div class="pwd-empty">Aucune entree. Cliquez sur "+ Nouveau" pour commencer.</div>
            }>
              {(entry) => (
                <div class="pwd-entry">
                  <div class="pwd-entry__main" onClick={() => startEdit(entry)}>
                    <div class="pwd-entry__title">{entry.title}</div>
                    <div class="pwd-entry__user">{entry.username}</div>
                    <Show when={entry.url}>
                      <div class="pwd-entry__url">{entry.url}</div>
                    </Show>
                  </div>
                  <div class="pwd-entry__actions">
                    <button
                      class={`pwd-btn pwd-btn--sm ${copiedId() === entry.id ? "pwd-btn--success" : ""}`}
                      onClick={() => copyPassword(entry.id)}
                    >{copiedId() === entry.id ? "Copie!" : "Copier"}</button>
                    <button class="pwd-btn pwd-btn--sm" onClick={() => togglePassword(entry.id)}>
                      {showPassword()[entry.id] ? "Masquer" : "Voir"}
                    </button>
                    <button class="pwd-btn pwd-btn--sm pwd-btn--danger" onClick={() => deleteEntry(entry.id)}>
                      &times;
                    </button>
                  </div>
                  <Show when={showPassword()[entry.id]}>
                    <div class="pwd-entry__password">{revealedPassword()[entry.id]}</div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* ─── Group context menu ─── */}
      <Show when={contextMenu()}>
        <div
          class="ide-context-menu"
          style={{ left: `${contextMenu()!.x}px`, top: `${contextMenu()!.y}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div class="ide-context-item" onClick={() => startRenameGroup(contextMenu()!.group)}>
            Renommer
          </div>
          <div class="ide-context-sep" />
          <div class="ide-context-item ide-context-item--danger" onClick={() => handleDeleteGroup(contextMenu()!.group)}>
            Supprimer le groupe
          </div>
        </div>
      </Show>

      {/* ─── Rename dialog ─── */}
      <Show when={renameGroup()}>
        <div class="cc-config-overlay" onClick={() => setRenameGroup(null)}>
          <div class="cc-config-dialog" onClick={(e) => e.stopPropagation()} style={{ width: "320px" }}>
            <div class="cc-config-dialog__header">
              Renommer "{renameGroup()!.group.name}"
              <button class="cc-config-dialog__close" onClick={() => setRenameGroup(null)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="cc-config-dialog__body">
              <label class="cc-config-field">
                <span class="cc-config-field__label">Nouveau nom</span>
                <input
                  autofocus
                  class="cc-config-field__input"
                  value={renameGroup()!.name}
                  onInput={(e) => setRenameGroup((prev) => prev ? { ...prev, name: e.currentTarget.value } : null)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmRenameGroup(); }}
                />
              </label>
            </div>
            <div class="cc-config-dialog__footer">
              <button class="cc-config-dialog__btn cc-config-dialog__btn--cancel" onClick={() => setRenameGroup(null)}>Annuler</button>
              <button class="cc-config-dialog__btn cc-config-dialog__btn--confirm" onClick={confirmRenameGroup}>Renommer</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

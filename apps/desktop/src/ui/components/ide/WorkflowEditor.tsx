import { createSignal, Show, For, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { vaultService } from "../../../application/services/vaultService";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { useBookmarkStore } from "../../../application/stores/bookmarkStore";
import { useRssStore } from "../../../application/stores/rssStore";
import { useWorkflowStore, type WorkflowTemplate } from "../../../application/stores/workflowStore";
import { useT } from "../../../i18n/context";

interface WorkflowEditorProps {
  workflowId: string;
}

/** An item in a workflow section — either a shell command or a vault/project file reference */
interface WfItem {
  type: "cmd" | "file";
  value: string; // command string or file path
  label?: string; // display name for files
}

/** A vault/project file entry for the picker */
interface PickerEntry {
  name: string;
  path: string;
  section: string;
}

function parseItems(raw: string[]): WfItem[] {
  return raw.map((v) => {
    if (v.startsWith("file:")) {
      const path = v.slice(5);
      const label = path.split("/").pop() ?? path;
      return { type: "file" as const, value: path, label };
    }
    return { type: "cmd" as const, value: v };
  });
}

function serializeItems(items: WfItem[]): string[] {
  return items.map((i) => i.type === "file" ? `file:${i.value}` : i.value);
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  const { t } = useT();
  const ide = useIdeStore();
  const wf = useWorkflowStore();
  const { snippets, fetchSnippets } = useSnippetStore();
  const bookmarkStore = useBookmarkStore();
  const rssStore = useRssStore();

  const [template, setTemplate] = createSignal<WorkflowTemplate | null>(null);
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [expandedCard, setExpandedCard] = createSignal<string | null>("instructions");

  // Editable fields
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [model, setModel] = createSignal("");
  const [permissionMode, setPermissionMode] = createSignal("default");
  const [preCommit, setPreCommit] = createSignal<WfItem[]>([]);
  const [postCommit, setPostCommit] = createSignal<WfItem[]>([]);
  const [instructions, setInstructions] = createSignal("");
  const [contextFiles, setContextFiles] = createSignal<string[]>([]);

  // Picker state
  const [activePicker, setActivePicker] = createSignal<string | null>(null);
  const [pickerEntries, setPickerEntries] = createSignal<PickerEntry[]>([]);
  const [pickerSearch, setPickerSearch] = createSignal("");

  onMount(() => loadTemplate());

  function loadTemplate() {
    const t = wf.workflows().find((w) => w.id === props.workflowId);
    if (!t) return;
    setTemplate(t);
    setName(t.name);
    setDescription(t.description);
    setModel(t.model);
    setPermissionMode(t.permissionMode);
    setPreCommit(parseItems(t.preCommit));
    setPostCommit(parseItems(t.postCommit));
    // Extract context file refs from instructions
    const fileRefs: string[] = [];
    const cleaned = t.instructions.replace(/\[Contexte: ([^\]]+)\]\n?/g, (_, path) => {
      fileRefs.push(path);
      return "";
    });
    setContextFiles(fileRefs);
    setInstructions(cleaned);
    setDirty(false);
  }

  function markDirty() { setDirty(true); }

  // ─── Save ───

  async function save() {
    const t = template();
    if (!t) return;
    setSaving(true);

    let fullInstructions = instructions();
    if (contextFiles().length > 0) {
      fullInstructions = contextFiles().map((f) => `[Contexte: ${f}]`).join("\n") + "\n\n" + fullInstructions;
    }

    const updated: WorkflowTemplate = {
      ...t,
      name: name(), description: description(), model: model(),
      permissionMode: permissionMode(),
      preCommit: serializeItems(preCommit()),
      postCommit: serializeItems(postCommit()),
      instructions: fullInstructions,
    };

    const lines: string[] = ["---"];
    lines.push(`name: ${updated.name}`);
    lines.push(`description: ${updated.description}`);
    if (updated.model) lines.push(`model: ${updated.model}`);
    if (updated.permissionMode) lines.push(`permissionMode: ${updated.permissionMode}`);
    if (updated.preCommit.length > 0) {
      lines.push("preCommit:");
      for (const cmd of updated.preCommit) lines.push(`  - ${cmd}`);
    }
    if (updated.postCommit.length > 0) {
      lines.push("postCommit:");
      for (const cmd of updated.postCommit) lines.push(`  - ${cmd}`);
    }
    lines.push("---", "", updated.instructions);

    try {
      await vaultService.writeJson(t.path, lines.join("\n"));
      await wf.fetchWorkflows();
      setDirty(false);
    } catch (e) { console.error("Save workflow failed:", e); }
    setSaving(false);
  }

  // ─── Item management ───

  function addCmd(target: "pre" | "post", cmd: string) {
    if (!cmd.trim()) return;
    const setter = target === "pre" ? setPreCommit : setPostCommit;
    setter((prev) => [...prev, { type: "cmd", value: cmd.trim() }]);
    markDirty();
  }

  function addFile(target: "pre" | "post" | "context", path: string, label: string) {
    if (target === "context") {
      if (!contextFiles().includes(path)) {
        setContextFiles((prev) => [...prev, path]);
        markDirty();
      }
    } else {
      const setter = target === "pre" ? setPreCommit : setPostCommit;
      setter((prev) => {
        if (prev.find((i) => i.type === "file" && i.value === path)) return prev;
        return [...prev, { type: "file", value: path, label }];
      });
      markDirty();
    }
    closePicker();
  }

  function removeItem(target: "pre" | "post", idx: number) {
    const setter = target === "pre" ? setPreCommit : setPostCommit;
    setter((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  }

  function removeContextFile(path: string) {
    setContextFiles((prev) => prev.filter((f) => f !== path));
    markDirty();
  }

  // ─── Picker ───

  async function openPicker(target: string) {
    setActivePicker(target);
    setPickerSearch("");
    await loadPickerEntries();
  }

  function closePicker() {
    setActivePicker(null);
    setPickerSearch("");
    setPickerEntries([]);
  }

  async function loadPickerEntries() {
    const target = activePicker();
    const entries: PickerEntry[] = [];

    // Workbench files (Skills, Hooks, Prompts) — always shown
    for (const [section, label] of [
      ["_ide/skills", "Skills"],
      ["_ide/hooks", "Hooks"],
      ["_ide/prompts", "Prompts"],
    ] as const) {
      try {
        const files = await ide.listVaultSection(section);
        for (const f of files) {
          entries.push({ name: f.name.replace(/\.md$/, ""), path: `${section}/${f.path}`, section: label });
        }
      } catch { /* skip */ }
    }

    // Notes — always shown
    try {
      const notes = await invoke<{ name: string; path: string }[]>("notes_list");
      for (const n of notes) {
        entries.push({ name: n.name, path: `notes::${n.path}`, section: "Notes" });
      }
    } catch { /* skip */ }

    // Workflows — show other workflows for composition
    try {
      const wfFiles = await ide.listVaultSection("_workflows");
      for (const f of wfFiles) {
        entries.push({ name: f.name.replace(/\.md$/, ""), path: `_workflows/${f.path}`, section: "Workflows" });
      }
    } catch { /* skip */ }

    // Snippets
    try {
      await fetchSnippets();
      for (const s of snippets()) {
        entries.push({ name: `${s.title} (${s.language})`, path: `snippet::${s.id}`, section: "Snippets" });
      }
    } catch { /* skip */ }

    // Bookmarks (sites to scan/reference)
    try {
      await bookmarkStore.fetchBookmarks();
      for (const b of bookmarkStore.bookmarks()) {
        entries.push({ name: `${b.emoji || "🔗"} ${b.name}`, path: `bookmark::${b.url}`, section: "Crookies" });
      }
    } catch { /* skip */ }

    // RSS articles (starred only)
    try {
      await rssStore.fetchArticles({ starred: true, limit: 50 });
      for (const a of rssStore.articles().filter((a) => a.isStarred)) {
        if (a.link) {
          const label = a.title || a.link;
          entries.push({ name: label, path: `rss::${a.link}`, section: "RSS Favoris" });
        }
      }
    } catch { /* skip */ }

    // Project files — only for "context" section (not pre/post-commit)
    if (target === "context") {
      function collect(node: { files: { name: string; path: string }[]; folders: any[] }) {
        for (const f of node.files) entries.push({ name: f.name, path: f.path, section: "Projet" });
        for (const folder of node.folders) collect(folder);
      }
      collect(ide.fileTree());
    }

    setPickerEntries(entries);
  }

  /** Group entries by section, filtered by search */
  function groupedPickerEntries(): Map<string, PickerEntry[]> {
    const q = pickerSearch().toLowerCase();
    const all = pickerEntries();
    const filtered = q ? all.filter((e) => e.name.toLowerCase().includes(q) || e.path.toLowerCase().includes(q)) : all;
    const groups = new Map<string, PickerEntry[]>();
    for (const e of filtered) {
      if (!groups.has(e.section)) groups.set(e.section, []);
      groups.get(e.section)!.push(e);
    }
    return groups;
  }

  // ─── Helpers ───

  function toggleCard(id: string) { setExpandedCard((prev) => prev === id ? null : id); }
  const isActive = () => wf.activeWorkflowId() === props.workflowId;

  const MODELS = ["", "claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"];
  const PERM_MODES = ["default", "plan", "bypassPermissions"];

  // Shared new-cmd inputs
  const [newPreCmd, setNewPreCmd] = createSignal("");
  const [newPostCmd, setNewPostCmd] = createSignal("");

  // ─── Drag & drop (custom mouse-based, Tauri webview compatible) ───
  const [dragState, setDragState] = createSignal<{
    target: string; fromIdx: number; toIdx: number;
    startY: number; ghostEl: HTMLElement | null;
  } | null>(null);

  function startDrag(target: string, idx: number, e: MouseEvent) {
    e.preventDefault();
    const el = (e.currentTarget as HTMLElement).closest(".wf-hook") as HTMLElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.classList.add("wf-hook--ghost");
    ghost.style.position = "fixed";
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    document.body.appendChild(ghost);

    el.classList.add("wf-hook--dragging");

    const state = { target, fromIdx: idx, toIdx: idx, startY: e.clientY, ghostEl: ghost };
    setDragState(state);

    function onMove(ev: MouseEvent) {
      const s = dragState();
      if (!s || !s.ghostEl) return;
      const dy = ev.clientY - s.startY;
      s.ghostEl.style.transform = `translateY(${dy}px)`;

      // Find which item we're hovering over
      const items = el.parentElement?.querySelectorAll(".wf-hook");
      if (!items) return;
      let newIdx = s.fromIdx;
      items.forEach((item, i) => {
        const r = item.getBoundingClientRect();
        if (ev.clientY > r.top && ev.clientY < r.bottom) newIdx = i;
      });
      if (newIdx !== s.toIdx) {
        setDragState({ ...s, toIdx: newIdx });
      }
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      const s = dragState();
      if (s) {
        s.ghostEl?.remove();
        el.classList.remove("wf-hook--dragging");

        if (s.fromIdx !== s.toIdx) {
          const setter = s.target === "pre" ? setPreCommit : setPostCommit;
          setter((prev) => {
            const next = [...prev];
            const [moved] = next.splice(s.fromIdx, 1);
            next.splice(s.toIdx, 0, moved);
            return next;
          });
          markDirty();
        }
      }
      setDragState(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ─── Item list renderer ───

  function ItemList(listProps: { items: WfItem[]; target: "pre" | "post"; newCmd: () => string; setNewCmd: (v: string) => void; onAddCmd: () => void }) {
    const isDropTarget = (idx: number) => {
      const s = dragState();
      return s && s.target === listProps.target && s.toIdx === idx && s.fromIdx !== idx;
    };

    return (
      <div class="wf-card__body">
        <For each={listProps.items}>
          {(item, idx) => (
            <div
              class={`wf-hook ${item.type === "file" ? "wf-hook--file" : ""} ${isDropTarget(idx()) ? "wf-hook--drop-target" : ""}`}
            >
              <span
                class="wf-hook__grip"
                title={t("ide.dragToReorder")}
                onMouseDown={(e) => startDrag(listProps.target, idx(), e)}
              >⠿</span>
              <Show when={item.type === "file"} fallback={
                <code class="wf-hook__cmd">{item.value}</code>
              }>
                <span class="wf-hook__file-icon">📄</span>
                <span class="wf-hook__file-name">{item.label || item.value.split("/").pop()}</span>
                <span class="wf-hook__file-path">{item.value}</span>
              </Show>
              <button class="wf-hook__remove" onClick={() => removeItem(listProps.target, idx())}>&times;</button>
            </div>
          )}
        </For>
        <div class="wf-hook__add">
          <input
            class="wf-hook__input"
            value={listProps.newCmd()}
            onInput={(e) => listProps.setNewCmd(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && listProps.onAddCmd()}
            placeholder={t("ide.shellCommand")}
          />
          <button class="wf-hook__btn" onClick={listProps.onAddCmd}>+</button>
          <button class="wf-hook__btn wf-hook__btn--file" onClick={() => openPicker(listProps.target)} title={t("ide.addFile")}>
            📎
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ───

  return (
    <div class="wf-editor">
      {/* Header */}
      <div class="wf-editor__header">
        <div class="wf-editor__title-row">
          <input class="wf-editor__title" value={name()} onInput={(e) => { setName(e.currentTarget.value); markDirty(); }} placeholder={t("ide.workflowName")} />
          <button class={`wf-editor__activate ${isActive() ? "wf-editor__activate--active" : ""}`} onClick={() => wf.selectWorkflow(isActive() ? null : props.workflowId)}>
            {isActive() ? `● ${t("ide.active")}` : `○ ${t("ide.activate")}`}
          </button>
        </div>
        <input class="wf-editor__desc" value={description()} onInput={(e) => { setDescription(e.currentTarget.value); markDirty(); }} placeholder={t("ide.workflowDesc")} />
        <Show when={dirty()}>
          <button class="wf-editor__save" onClick={save} disabled={saving()}>{saving() ? "..." : t("common.save")}</button>
        </Show>
      </div>

      {/* Pipeline */}
      <div class="wf-pipeline">

        {/* Config */}
        <div class={`wf-card ${expandedCard() === "config" ? "wf-card--expanded" : ""}`}>
          <button class="wf-card__header wf-card__header--config" onClick={() => toggleCard("config")}>
            <span class="wf-card__icon">⚙</span>
            <span class="wf-card__title">{t("ide.configuration")}</span>
            <span class="wf-card__badge">{model() || "auto"}</span>
            <span class="wf-card__chevron">{expandedCard() === "config" ? "▾" : "▸"}</span>
          </button>
          <Show when={expandedCard() === "config"}>
            <div class="wf-card__body">
              <label class="wf-field">
                <span class="wf-field__label">{t("ide.model")}</span>
                <select class="wf-field__select" value={model()} onChange={(e) => { setModel(e.currentTarget.value); markDirty(); }}>
                  <For each={MODELS}>{(m) => <option value={m}>{m || t("ide.autoDefault")}</option>}</For>
                </select>
              </label>
              <label class="wf-field">
                <span class="wf-field__label">{t("ide.permissions")}</span>
                <select class="wf-field__select" value={permissionMode()} onChange={(e) => { setPermissionMode(e.currentTarget.value); markDirty(); }}>
                  <For each={PERM_MODES}>{(m) => <option value={m}>{m}</option>}</For>
                </select>
              </label>
            </div>
          </Show>
        </div>

        <div class="wf-pipeline__connector" />

        {/* Pre-commit */}
        <div class={`wf-card ${expandedCard() === "pre" ? "wf-card--expanded" : ""}`}>
          <button class="wf-card__header wf-card__header--pre" onClick={() => toggleCard("pre")}>
            <span class="wf-card__icon">▶</span>
            <span class="wf-card__title">{t("ide.preCommit")}</span>
            <span class="wf-card__badge">{preCommit().length}</span>
            <span class="wf-card__chevron">{expandedCard() === "pre" ? "▾" : "▸"}</span>
          </button>
          <Show when={expandedCard() === "pre"}>
            <ItemList items={preCommit()} target="pre" newCmd={newPreCmd} setNewCmd={setNewPreCmd} onAddCmd={() => { addCmd("pre", newPreCmd()); setNewPreCmd(""); }} />
          </Show>
        </div>

        <div class="wf-pipeline__connector" />

        {/* Instructions */}
        <div class={`wf-card ${expandedCard() === "instructions" ? "wf-card--expanded" : ""}`}>
          <button class="wf-card__header wf-card__header--main" onClick={() => toggleCard("instructions")}>
            <span class="wf-card__icon">📝</span>
            <span class="wf-card__title">{t("ide.instructions")}</span>
            <span class="wf-card__chevron">{expandedCard() === "instructions" ? "▾" : "▸"}</span>
          </button>
          <Show when={expandedCard() === "instructions"}>
            <div class="wf-card__body">
              <textarea class="wf-instructions" value={instructions()} onInput={(e) => { setInstructions(e.currentTarget.value); markDirty(); }} placeholder="Instructions markdown pour Claude..." rows={12} />
            </div>
          </Show>
        </div>

        <div class="wf-pipeline__connector" />

        {/* Context files */}
        <div class={`wf-card ${expandedCard() === "context" ? "wf-card--expanded" : ""}`}>
          <button class="wf-card__header wf-card__header--context" onClick={() => toggleCard("context")}>
            <span class="wf-card__icon">📎</span>
            <span class="wf-card__title">{t("ide.contextFiles")}</span>
            <span class="wf-card__badge">{contextFiles().length}</span>
            <span class="wf-card__chevron">{expandedCard() === "context" ? "▾" : "▸"}</span>
          </button>
          <Show when={expandedCard() === "context"}>
            <div class="wf-card__body">
              <For each={contextFiles()}>
                {(path) => (
                  <div class="wf-context-file">
                    <span class="wf-context-file__path">{path}</span>
                    <button class="wf-context-file__remove" onClick={() => removeContextFile(path)}>&times;</button>
                  </div>
                )}
              </For>
              <button class="wf-hook__btn wf-hook__btn--file" style={{ width: "100%" }} onClick={() => openPicker("context")}>
                📎 {t("ide.addFile")}
              </button>
            </div>
          </Show>
        </div>

        <div class="wf-pipeline__connector" />

        {/* Post-commit */}
        <div class={`wf-card ${expandedCard() === "post" ? "wf-card--expanded" : ""}`}>
          <button class="wf-card__header wf-card__header--post" onClick={() => toggleCard("post")}>
            <span class="wf-card__icon">✔</span>
            <span class="wf-card__title">{t("ide.postCommit")}</span>
            <span class="wf-card__badge">{postCommit().length}</span>
            <span class="wf-card__chevron">{expandedCard() === "post" ? "▾" : "▸"}</span>
          </button>
          <Show when={expandedCard() === "post"}>
            <ItemList items={postCommit()} target="post" newCmd={newPostCmd} setNewCmd={setNewPostCmd} onAddCmd={() => { addCmd("post", newPostCmd()); setNewPostCmd(""); }} />
          </Show>
        </div>
      </div>

      {/* ─── File Picker Drawer ─── */}
      <Show when={activePicker()}>
        <div class="wf-picker-backdrop" onClick={closePicker} />
        <div class="wf-picker-drawer">
          <div class="wf-picker-drawer__header">
            <span class="wf-picker-drawer__title">
              {t("ide.addFile")} — {activePicker() === "pre" ? t("ide.preCommit") : activePicker() === "post" ? t("ide.postCommit") : t("ide.context")}
            </span>
            <button class="wf-picker-drawer__close" onClick={closePicker}>&times;</button>
          </div>
          <div class="wf-picker-drawer__search-wrap">
            <input
              class="wf-picker-drawer__search"
              value={pickerSearch()}
              onInput={(e) => setPickerSearch(e.currentTarget.value)}
              placeholder={t("ide.searchFilePlaceholder")}
              ref={(el) => requestAnimationFrame(() => el.focus())}
            />
          </div>
          <div class="wf-picker-drawer__body">
            <For each={Array.from(groupedPickerEntries().entries())}>
              {([section, entries]) => {
                const [open, setOpen] = createSignal(!!pickerSearch());
                const icon = section === "Skills" ? "⚡" : section === "Hooks" ? "🪝" : section === "Prompts" ? "💬" : section === "Notes" ? "📝" : section === "Snippets" ? "✂" : section === "Crookies" ? "🔗" : section === "RSS Favoris" ? "📰" : section === "Workflows" ? "🔄" : "📄";
                return (
                  <div class="wf-picker-section">
                    <button class="wf-picker-section__header" onClick={() => setOpen(!open())}>
                      <span class="wf-picker-section__chevron">{open() ? "▾" : "▸"}</span>
                      <span class="wf-picker-section__icon">{icon}</span>
                      <span class="wf-picker-section__label">{section}</span>
                      <span class="wf-picker-section__count">{entries.length}</span>
                    </button>
                    <Show when={open()}>
                      <div class="wf-picker-section__list">
                        <For each={entries}>
                          {(entry) => (
                            <button
                              class="wf-picker-entry"
                              onClick={() => addFile(activePicker()! as "pre" | "post" | "context", entry.path, entry.name)}
                            >
                              <span class="wf-picker-entry__name">{entry.name}</span>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
            <Show when={groupedPickerEntries().size === 0}>
              <div class="wf-picker-drawer__empty">
                {t("ide.noFileFound")} "{pickerSearch()}"
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

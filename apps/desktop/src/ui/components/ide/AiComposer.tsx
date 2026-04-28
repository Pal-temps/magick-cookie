import { createSignal, createEffect, Show, For, onCleanup } from "solid-js";
import { filterCommands, isSlashTrigger, type SlashCommand } from "./slashCommands";
import { invoke } from "@tauri-apps/api/core";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useBrowserTabStore } from "../../../application/stores/browserTabStore";
import { useT } from "../../../i18n/context";
import type { AdapterCapabilities } from "../../../application/stores/aiSessionStore";

interface AiComposerProps {
  onSend: (content: string, images?: { media_type: string; data: string }[]) => void;
  disabled?: boolean;
  activeFileName?: string | null;
  activeSelection?: string | null;
  capabilities?: AdapterCapabilities | null;
  initialText?: string;
}

interface QuickAction {
  label: string;
  icon: string;
  prompt: (ctx: { fileName?: string; selection?: string }) => string;
  needsContext: boolean;
}

// Context attachment types
interface ContextAttachment {
  id: string;
  type: "file" | "vault" | "task";
  name: string;
  /** Path for files, relPath for vault, id for tasks */
  ref: string;
}

// Mention picker result
interface MentionOption {
  type: "file" | "vault" | "task";
  name: string;
  ref: string;
  section?: string;
}

function getActions(t: (key: string) => string): QuickAction[] {
  return [
    { label: t("ide.explain"), icon: "?", prompt: (ctx) => ctx.selection ? `Explique ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Explique le fichier ${ctx.fileName ?? "actif"}`, needsContext: false },
    { label: t("ide.refactor"), icon: "R", prompt: (ctx) => ctx.selection ? `Refactorise ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Refactorise le fichier ${ctx.fileName ?? "actif"}`, needsContext: true },
    { label: t("ide.fix"), icon: "!", prompt: (ctx) => ctx.selection ? `Corrige ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Corrige les bugs dans ${ctx.fileName ?? "le fichier actif"}`, needsContext: true },
    { label: t("ide.tests"), icon: "T", prompt: (ctx) => ctx.selection ? `Ecris des tests pour:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Ecris des tests pour ${ctx.fileName ?? "le fichier actif"}`, needsContext: true },
  ];
}

export function AiComposer(props: AiComposerProps) {
  const { t } = useT();
  const ide = useIdeStore();
  const [text, setText] = createSignal("");

  // Pre-fill composer when a context is pushed from another view ("Ask Cookia" button)
  createEffect(() => {
    if (props.initialText) setText(props.initialText);
  });

  const [pendingScreenshot, setPendingScreenshot] = createSignal<{ media_type: string; data: string } | null>(null);
  const [isCapturing, setIsCapturing] = createSignal(false);
  const [attachments, setAttachments] = createSignal<ContextAttachment[]>([]);

  // Mention picker state
  const [showMentions, setShowMentions] = createSignal(false);
  const [mentionQuery, setMentionQuery] = createSignal("");
  const [mentionResults, setMentionResults] = createSignal<MentionOption[]>([]);
  const [mentionIndex, setMentionIndex] = createSignal(0);

  // Slash command picker state
  const [showSlashPicker, setShowSlashPicker] = createSignal(false);
  const [slashResults, setSlashResults] = createSignal<SlashCommand[]>([]);
  const [slashIndex, setSlashIndex] = createSignal(0);

  let textareaRef: HTMLTextAreaElement | undefined;
  let mentionAnchor = 0; // cursor position where @ was typed

  const supportsImages = () => props.capabilities?.supports_images ?? false;

  const browserStore = useBrowserTabStore();

  async function handleCapture() {
    if (isCapturing()) return;
    setIsCapturing(true);
    try {
      // If a browser tab is active, capture it; otherwise capture the app
      const activeBrowser = browserStore.browserTabs()[0]; // first browser tab
      const img = activeBrowser
        ? await invoke<{ media_type: string; data: string }>("capture_browser_screenshot", { id: activeBrowser.id })
        : await invoke<{ media_type: string; data: string }>("capture_app_screenshot");
      setPendingScreenshot(img);
    } catch (err) {
      console.error("Screenshot failed:", err);
      // Fallback to app screenshot
      try {
        const img = await invoke<{ media_type: string; data: string }>("capture_app_screenshot");
        setPendingScreenshot(img);
      } catch { /* ignore */ }
    } finally {
      setIsCapturing(false);
    }
  }

  // ─── Mention search ───

  async function searchMentions(query: string) {
    const q = query.toLowerCase();
    const results: MentionOption[] = [];

    // Search project files
    const files = ide.fileTree();
    function collectFiles(node: { files: { name: string; path: string }[]; folders: { name: string; path: string; files: { name: string; path: string }[]; folders: any[] }[] }) {
      for (const f of node.files) {
        if (f.name.toLowerCase().includes(q)) {
          results.push({ type: "file", name: f.name, ref: f.path });
        }
      }
      for (const folder of node.folders) {
        collectFiles(folder);
      }
    }
    collectFiles(files);

    // Search vault notes (IDE vault)
    try {
      for (const section of ["_ide/notes", "_ide/prompts", "_ide/skills"]) {
        const entries = await ide.listVaultSection(section);
        for (const entry of entries) {
          if (entry.name.toLowerCase().includes(q)) {
            const sectionLabel = section.split("/").pop() ?? section;
            results.push({ type: "vault", name: entry.name, ref: entry.path, section: sectionLabel });
          }
        }
      }
    } catch { /* vault not configured */ }

    // Search git-synced notes (including bookmarks)
    try {
      const notes = await invoke<{ name: string; path: string }[]>("notes_list");
      for (const note of notes) {
        if (note.name.toLowerCase().includes(q)) {
          results.push({ type: "vault", name: note.name, ref: `notes::${note.path}`, section: "notes" });
        }
      }
    } catch { /* notes not configured */ }

    // Limit results
    setMentionResults(results.slice(0, 12));
    setMentionIndex(0);
  }

  function openMentionPicker() {
    setShowMentions(true);
    setMentionQuery("");
    searchMentions("");
  }

  function closeMentionPicker() {
    setShowMentions(false);
    setMentionQuery("");
    setMentionResults([]);
  }

  function selectMention(option: MentionOption) {
    const attachment: ContextAttachment = {
      id: `${option.type}::${option.ref}`,
      type: option.type,
      name: option.name,
      ref: option.ref,
    };

    // Don't add duplicates
    if (!attachments().find((a) => a.id === attachment.id)) {
      setAttachments((prev) => [...prev, attachment]);
    }

    // Remove the @query text from the input
    const currentText = text();
    const before = currentText.slice(0, mentionAnchor);
    const after = currentText.slice(textareaRef?.selectionStart ?? currentText.length);
    setText(before + after);

    closeMentionPicker();
    textareaRef?.focus();
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // ─── Build message with context ───

  async function buildContextPrefix(): Promise<string> {
    const parts: string[] = [];

    for (const att of attachments()) {
      try {
        if (att.type === "file") {
          const absPath = `${ide.projectPath()}/${att.ref}`;
          const content = await invoke<string>("fs_read_file", { path: absPath });
          parts.push(`[Fichier: ${att.name}]\n\`\`\`\n${content}\n\`\`\``);
        } else if (att.type === "vault" && att.ref.startsWith("notes::")) {
          // Git-synced notes (including bookmarks)
          const notePath = att.ref.slice(7); // remove "notes::" prefix
          const content = await invoke<string>("notes_read", { path: notePath });
          parts.push(`[Note: ${att.name}]\n${content}`);
        } else if (att.type === "vault") {
          // IDE vault files
          const content = await invoke<string>("vault_read_json", { relPath: att.ref });
          parts.push(`[Note: ${att.name}]\n${content}`);
        }
      } catch {
        parts.push(`[${att.name}: fichier introuvable]`);
      }
    }

    return parts.length > 0 ? parts.join("\n\n") + "\n\n---\n\n" : "";
  }

  // ─── Send ───

  async function handleSend() {
    const txt = text().trim();
    const screenshot = pendingScreenshot();
    if ((!txt && !screenshot) || props.disabled) return;

    const contextPrefix = await buildContextPrefix();
    const fullMessage = contextPrefix + (txt || t("ide.screenshotFallback"));
    const images = screenshot ? [screenshot] : undefined;

    props.onSend(fullMessage, images);
    setText("");
    setPendingScreenshot(null);
    setAttachments([]);
    if (textareaRef) {
      textareaRef.style.height = "auto";
    }
  }

  function handleQuickAction(action: QuickAction) {
    if (props.disabled) return;
    const prompt = action.prompt({
      fileName: props.activeFileName ?? undefined,
      selection: props.activeSelection ?? undefined,
    });
    props.onSend(prompt);
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Mention picker navigation
    if (showMentions()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, mentionResults().length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const results = mentionResults();
        if (results.length > 0) {
          selectMention(results[mentionIndex()]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMentionPicker();
        return;
      }
    }

    // Slash command picker navigation
    if (showSlashPicker()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, slashResults().length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const results = slashResults();
        if (results.length > 0) {
          selectSlashCommand(results[slashIndex()]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashPicker(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function selectSlashCommand(cmd: SlashCommand) {
    setText(`/${cmd.name} `);
    setShowSlashPicker(false);
    textareaRef?.focus();
  }

  function handleInput(e: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    const value = e.currentTarget.value;
    setText(value);

    // Auto-resize
    e.currentTarget.style.height = "auto";
    e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 200) + "px";

    const cursor = e.currentTarget.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursor);

    // Detect / trigger for slash picker (only when / is first char)
    if (isSlashTrigger(value, cursor)) {
      const query = textBeforeCursor.slice(1); // strip leading /
      const results = filterCommands(query);
      setSlashResults(results);
      setSlashIndex(0);
      setShowSlashPicker(true);
      if (showMentions()) closeMentionPicker();
      return;
    } else if (showSlashPicker()) {
      setShowSlashPicker(false);
    }

    // Detect @ trigger for mention picker
    const atMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (atMatch) {
      mentionAnchor = cursor - atMatch[0].length;
      const query = atMatch[1];
      setMentionQuery(query);
      setShowMentions(true);
      searchMentions(query);
    } else if (showMentions()) {
      closeMentionPicker();
    }
  }

  // Close pickers on outside click
  function handleDocClick() {
    if (showMentions()) closeMentionPicker();
    if (showSlashPicker()) setShowSlashPicker(false);
  }
  document.addEventListener("mousedown", handleDocClick);
  onCleanup(() => document.removeEventListener("mousedown", handleDocClick));

  // ─── Render ───

  const typeIcon = (type: string) => type === "file" ? "F" : type === "vault" ? "N" : "T";
  const typeColor = (type: string) => type === "file" ? "var(--accent-primary)" : type === "vault" ? "var(--accent-secondary, #e8a54b)" : "var(--text-muted)";

  return (
    <div class="cc-composer">
      {/* Screenshot preview */}
      <Show when={pendingScreenshot()}>
        <div class="cc-composer__screenshot-preview">
          <img
            src={`data:${pendingScreenshot()!.media_type};base64,${pendingScreenshot()!.data}`}
            alt="Screenshot"
            class="cc-composer__screenshot-thumb"
          />
          <button
            class="cc-composer__screenshot-remove"
            onClick={() => setPendingScreenshot(null)}
            title={t("ide.removeScreenshot")}
          >&times;</button>
        </div>
      </Show>

      {/* Context chips — active file + manual attachments */}
      <Show when={props.activeFileName || attachments().length > 0}>
        <div class="cc-composer__chips">
          <Show when={props.activeFileName}>
            <span class="cc-composer__chip">
              <span class="cc-composer__chip-icon">@</span>
              {props.activeFileName}
              <Show when={props.activeSelection}>
                <span style={{ opacity: 0.6 }}>&nbsp;(selection)</span>
              </Show>
            </span>
          </Show>
          <For each={attachments()}>
            {(att) => (
              <span class="cc-composer__chip">
                <span class="cc-composer__chip-icon" style={{ color: typeColor(att.type) }}>{typeIcon(att.type)}</span>
                {att.name}
                <button class="cc-composer__chip-remove" onClick={() => removeAttachment(att.id)}>&times;</button>
              </span>
            )}
          </For>
        </div>
      </Show>

      {/* Input area */}
      <div class="cc-composer__input-wrap" style={{ position: "relative" }}>
        <Show when={supportsImages()}>
          <button
            class="cc-composer__screenshot-btn"
            onClick={handleCapture}
            disabled={props.disabled || isCapturing()}
            title={t("ide.captureScreen")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <circle cx="8" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <path d="M5 4L6 2H10L11 4" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </Show>
        <button
          class="cc-composer__at-btn"
          onClick={() => { if (!showMentions()) { mentionAnchor = text().length; openMentionPicker(); } else closeMentionPicker(); }}
          title={t("ide.addContext")}
        >@</button>
        <textarea
          ref={textareaRef}
          class="cc-composer__textarea"
          value={text()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t("ide.composerPlaceholder")}
          disabled={props.disabled}
          rows={1}
        />
        <button
          class="cc-composer__send"
          onClick={handleSend}
          disabled={props.disabled || (!text().trim() && !pendingScreenshot())}
          title={t("ide.sendMessage")}
        >
          <Show when={props.disabled} fallback={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L2 8.5L6.5 10L10 6L7 11L9.5 14L14 2Z" fill="currentColor" />
            </svg>
          }>
            <span class="cc-composer__stop">&#x25A0;</span>
          </Show>
        </button>

        {/* Slash command picker dropdown */}
        <Show when={showSlashPicker() && slashResults().length > 0}>
          <div class="cc-slash-picker" onMouseDown={(e) => e.stopPropagation()}>
            <For each={slashResults()}>
              {(cmd, idx) => (
                <div
                  class={`cc-slash-picker__item ${idx() === slashIndex() ? "cc-slash-picker__item--active" : ""}`}
                  onClick={() => selectSlashCommand(cmd)}
                  onMouseEnter={() => setSlashIndex(idx())}
                >
                  <span class="cc-slash-picker__name">/{cmd.name}</span>
                  <span class="cc-slash-picker__desc">{cmd.description}</span>
                  <span class={`cc-slash-picker__level cc-slash-picker__level--${cmd.level}`}>
                    {cmd.level === "local" ? "local" : "LLM"}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Mention picker dropdown */}
        <Show when={showMentions()}>
          <div class="cc-mention-picker" onMouseDown={(e) => e.stopPropagation()}>
            <div class="cc-mention-picker__header">{t("ide.addContextHeader")}</div>
            <Show when={mentionResults().length === 0}>
              <div class="cc-mention-picker__empty">{t("ide.noResultFor")} "{mentionQuery()}"</div>
            </Show>
            <For each={mentionResults()}>
              {(option, idx) => (
                <div
                  class={`cc-mention-picker__item ${idx() === mentionIndex() ? "cc-mention-picker__item--active" : ""}`}
                  onClick={() => selectMention(option)}
                  onMouseEnter={() => setMentionIndex(idx())}
                >
                  <span class="cc-mention-picker__icon" style={{ color: typeColor(option.type) }}>{typeIcon(option.type)}</span>
                  <span class="cc-mention-picker__name">{option.name}</span>
                  <Show when={option.section}>
                    <span class="cc-mention-picker__section">{option.section}</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Quick actions */}
      <div class="cc-composer__actions">
        <For each={getActions(t)}>
          {(action) => (
            <button
              class="cc-composer__action"
              onClick={() => handleQuickAction(action)}
              disabled={props.disabled || (action.needsContext && !props.activeFileName)}
              title={action.label}
            >
              <span class="cc-composer__action-icon">{action.icon}</span>
              {action.label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

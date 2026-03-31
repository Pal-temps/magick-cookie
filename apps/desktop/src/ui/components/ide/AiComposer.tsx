import { createSignal, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { AdapterCapabilities } from "../../../application/stores/aiSessionStore";

interface AiComposerProps {
  onSend: (content: string, images?: { media_type: string; data: string }[]) => void;
  disabled?: boolean;
  activeFileName?: string | null;
  activeSelection?: string | null;
  capabilities?: AdapterCapabilities | null;
}

interface QuickAction {
  label: string;
  icon: string;
  prompt: (ctx: { fileName?: string; selection?: string }) => string;
  needsContext: boolean;
}

const ACTIONS: QuickAction[] = [
  { label: "Expliquer", icon: "?", prompt: (ctx) => ctx.selection ? `Explique ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Explique le fichier ${ctx.fileName ?? "actif"}`, needsContext: false },
  { label: "Refactorer", icon: "R", prompt: (ctx) => ctx.selection ? `Refactorise ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Refactorise le fichier ${ctx.fileName ?? "actif"}`, needsContext: true },
  { label: "Corriger", icon: "!", prompt: (ctx) => ctx.selection ? `Corrige ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Corrige les bugs dans ${ctx.fileName ?? "le fichier actif"}`, needsContext: true },
  { label: "Tests", icon: "T", prompt: (ctx) => ctx.selection ? `Ecris des tests pour:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Ecris des tests pour ${ctx.fileName ?? "le fichier actif"}`, needsContext: true },
];

export function AiComposer(props: AiComposerProps) {
  const [text, setText] = createSignal("");
  const [pendingScreenshot, setPendingScreenshot] = createSignal<{ media_type: string; data: string } | null>(null);
  const [isCapturing, setIsCapturing] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;

  const supportsImages = () => props.capabilities?.supports_images ?? false;

  async function handleCapture() {
    if (isCapturing()) return;
    setIsCapturing(true);
    try {
      const img = await invoke<{ media_type: string; data: string }>("capture_app_screenshot");
      setPendingScreenshot(img);
    } catch (err) {
      console.error("Screenshot failed:", err);
    } finally {
      setIsCapturing(false);
    }
  }

  function handleSend() {
    const t = text().trim();
    const screenshot = pendingScreenshot();
    if ((!t && !screenshot) || props.disabled) return;
    const images = screenshot ? [screenshot] : undefined;
    props.onSend(t || "Voici une capture d'ecran de l'application.", images);
    setText("");
    setPendingScreenshot(null);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    setText(e.currentTarget.value);
    // Auto-resize
    e.currentTarget.style.height = "auto";
    e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 200) + "px";
  }

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
            title="Retirer la capture"
          >&times;</button>
        </div>
      </Show>

      {/* Context chips */}
      <Show when={props.activeFileName}>
        <div class="cc-composer__chips">
          <span class="cc-composer__chip">
            <span class="cc-composer__chip-icon">@</span>
            {props.activeFileName}
          </span>
          <Show when={props.activeSelection}>
            <span class="cc-composer__chip">selection</span>
          </Show>
        </div>
      </Show>

      {/* Input area */}
      <div class="cc-composer__input-wrap">
        <Show when={supportsImages()}>
          <button
            class="cc-composer__screenshot-btn"
            onClick={handleCapture}
            disabled={props.disabled || isCapturing()}
            title="Capturer l'ecran"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <circle cx="8" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <path d="M5 4L6 2H10L11 4" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </Show>
        <textarea
          ref={textareaRef}
          class="cc-composer__textarea"
          value={text()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ecrivez un message... (/ + @)"
          disabled={props.disabled}
          rows={1}
        />
        <button
          class="cc-composer__send"
          onClick={handleSend}
          disabled={props.disabled || (!text().trim() && !pendingScreenshot())}
          title="Envoyer (Enter)"
        >
          <Show when={props.disabled} fallback={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L2 8.5L6.5 10L10 6L7 11L9.5 14L14 2Z" fill="currentColor" />
            </svg>
          }>
            <span class="cc-composer__stop">&#x25A0;</span>
          </Show>
        </button>
      </div>

      {/* Quick actions */}
      <div class="cc-composer__actions">
        <For each={ACTIONS}>
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

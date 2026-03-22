import { createSignal, Show, For } from "solid-js";
import type { AdapterCapabilities } from "../../../application/stores/aiSessionStore";

interface AiComposerProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  activeFileName?: string | null;
  activeSelection?: string | null;
  capabilities?: AdapterCapabilities | null;
}

interface QuickAction {
  label: string;
  prompt: (ctx: { fileName?: string; selection?: string }) => string;
  needsContext: boolean;
}

const ACTIONS: QuickAction[] = [
  { label: "Expliquer", prompt: (ctx) => ctx.selection ? `Explique ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Explique le fichier ${ctx.fileName ?? "actif"}`, needsContext: false },
  { label: "Refactorer", prompt: (ctx) => ctx.selection ? `Refactorise ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Refactorise le fichier ${ctx.fileName ?? "actif"}`, needsContext: true },
  { label: "Corriger", prompt: (ctx) => ctx.selection ? `Corrige ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Corrige les bugs dans ${ctx.fileName ?? "le fichier actif"}`, needsContext: true },
  { label: "Tests", prompt: (ctx) => ctx.selection ? `Ecris des tests pour:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Ecris des tests pour ${ctx.fileName ?? "le fichier actif"}`, needsContext: true },
  { label: "Documenter", prompt: (ctx) => ctx.selection ? `Documente ce code:\n\`\`\`\n${ctx.selection}\n\`\`\`` : `Documente ${ctx.fileName ?? "le fichier actif"}`, needsContext: true },
];

export function AiComposer(props: AiComposerProps) {
  const [text, setText] = createSignal("");

  function handleSend() {
    const t = text().trim();
    if (!t || props.disabled) return;
    props.onSend(t);
    setText("");
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

  return (
    <div class="ide-ai-composer">
      {/* Context chips */}
      <Show when={props.activeFileName}>
        <div class="ide-ai-composer__chips">
          <span class="ide-ai-composer__chip">@ {props.activeFileName}</span>
          <Show when={props.activeSelection}>
            <span class="ide-ai-composer__chip">selection</span>
          </Show>
        </div>
      </Show>

      {/* Input row */}
      <div class="ide-ai-composer__input-row">
        <textarea
          class="ide-ai-composer__textarea"
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Poser une question..."
          disabled={props.disabled}
          rows={1}
        />
        <button
          class="ide-ai-composer__send"
          onClick={handleSend}
          disabled={props.disabled || !text().trim()}
        >↵</button>
      </div>

      {/* Quick actions */}
      <div class="ide-ai-composer__actions">
        <For each={ACTIONS}>
          {(action) => (
            <button
              class="ide-ai-composer__action"
              onClick={() => handleQuickAction(action)}
              disabled={props.disabled || (action.needsContext && !props.activeFileName)}
            >{action.label}</button>
          )}
        </For>
      </div>
    </div>
  );
}

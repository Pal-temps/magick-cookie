import { createSignal, For, Show } from "solid-js";
import type { ProviderInfo } from "../../../application/stores/aiSessionStore";

interface ProviderPickerProps {
  providers: ProviderInfo[];
  activeProvider: string | null;
  onSelect: (providerId: string) => void;
}

export function ProviderPicker(props: ProviderPickerProps) {
  const [open, setOpen] = createSignal(false);

  const activeLabel = () => {
    const p = props.providers.find((p) => p.id === props.activeProvider);
    return p?.name ?? "Choisir un provider";
  };

  function select(id: string) {
    props.onSelect(id);
    setOpen(false);
  }

  function toggle() {
    setOpen((v) => !v);
    if (!open()) return;
    const close = () => { setOpen(false); document.removeEventListener("click", close); };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  return (
    <div class="ide-provider-picker">
      <button class="ide-provider-picker__trigger" onClick={toggle}>
        {activeLabel()}
        <span style={{ "font-size": "8px" }}>{open() ? "▴" : "▾"}</span>
      </button>

      <Show when={open()}>
        <div class="ide-provider-picker__dropdown" onClick={(e) => e.stopPropagation()}>
          <For each={props.providers}>
            {(provider) => (
              <div
                class={`ide-provider-picker__item ${!provider.available ? "ide-provider-picker__item--disabled" : ""}`}
                onClick={() => provider.available && select(provider.id)}
              >
                <span>{provider.name}</span>
                <Show when={provider.capabilities.supports_tools}>
                  <span class="ide-provider-picker__badge">tools</span>
                </Show>
                <Show when={!provider.available}>
                  <span class="ide-provider-picker__badge">indisponible</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

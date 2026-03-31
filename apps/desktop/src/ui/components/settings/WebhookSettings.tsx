import { createSignal, For, Show, onMount } from "solid-js";
import { useWebhookStore, type CreateWebhookInput, type Webhook } from "../../../application/stores/webhookStore";
import { Button } from "../common/Button";

const API_BASE = "http://localhost:47300/api";

export function WebhookSettings() {
  const {
    webhooks, webhookEvents, selectedWebhookId,
    fetchWebhooks, createWebhook, updateWebhook, deleteWebhook,
    fetchEvents, markEventRead,
  } = useWebhookStore();

  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [source, setSource] = createSignal("");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  const inputStyle: Record<string, string> = {
    width: "100%",
    padding: "6px 10px",
    "border-radius": "var(--radius-sm)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
    "box-sizing": "border-box",
  };

  onMount(() => {
    fetchWebhooks();
  });

  function resetForm() {
    setName("");
    setSource("");
    setCreating(false);
  }

  function getWebhookUrl(webhook: Webhook): string {
    return `${API_BASE}/webhooks/${webhook.id}/receive?secret=${webhook.secret}`;
  }

  async function copyUrl(webhook: Webhook) {
    try {
      await navigator.clipboard.writeText(getWebhookUrl(webhook));
      setCopiedId(webhook.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }

  async function handleCreate() {
    const n = name().trim();
    if (!n) return;
    const input: CreateWebhookInput = { name: n };
    if (source().trim()) input.source = source().trim();
    await createWebhook(input);
    resetForm();
  }

  async function handleToggleEnabled(webhook: Webhook) {
    await updateWebhook(webhook.id, { enabled: !webhook.enabled });
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function truncatePayload(payload: string, max = 120): string {
    return payload.length > max ? payload.slice(0, max) + "..." : payload;
  }

  return (
    <div style={{ padding: "24px", "max-width": "700px" }}>
      <h3 style={{ margin: "0 0 4px", "font-size": "16px", "font-weight": "600", color: "var(--text-primary)" }}>
        Webhooks
      </h3>
      <p style={{ margin: "0 0 20px", "font-size": "12px", color: "var(--text-muted)" }}>
        Recevez des evenements depuis des services externes. Copiez l'URL du webhook et configurez-la dans le service source.
      </p>

      {/* List */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-bottom": "16px" }}>
        <For each={webhooks()}>
          {(webhook) => (
            <div style={{
              padding: "10px 12px",
              "border-radius": "var(--radius-md)",
              border: selectedWebhookId() === webhook.id ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
              background: selectedWebhookId() === webhook.id ? "var(--bg-elevated)" : "transparent",
              opacity: webhook.enabled ? "1" : "0.5",
            }}>
              <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                <div style={{ flex: "1" }}>
                  <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                    {webhook.name}
                    <Show when={webhook.source}>
                      <span style={{ "font-size": "11px", color: "var(--text-muted)", "margin-left": "8px" }}>
                        ({webhook.source})
                      </span>
                    </Show>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                  <Button variant="ghost" size="sm" onClick={() => copyUrl(webhook)}>
                    {copiedId() === webhook.id ? "Copie !" : "Copier URL"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => fetchEvents(webhook.id)}>
                    Events
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleEnabled(webhook)}>
                    {webhook.enabled ? "Desact." : "Activer"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteWebhook(webhook.id)}>
                    Suppr.
                  </Button>
                </div>
              </div>

              {/* URL preview */}
              <div style={{
                "margin-top": "6px",
                "font-size": "10px",
                color: "var(--text-muted)",
                "word-break": "break-all",
                "font-family": "monospace",
              }}>
                {getWebhookUrl(webhook)}
              </div>
            </div>
          )}
        </For>

        <Show when={webhooks().length === 0}>
          <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "12px 0" }}>
            Aucun webhook. Cliquez sur "+ Nouveau webhook" pour commencer.
          </div>
        </Show>
      </div>

      {/* Add button */}
      <Show when={!creating()}>
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          + Nouveau webhook
        </Button>
      </Show>

      {/* Create form */}
      <Show when={creating()}>
        <div style={{
          "margin-top": "16px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
              Nom
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Mon webhook"
              style={inputStyle}
            />
          </div>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
              Source (optionnel)
            </label>
            <input
              type="text"
              value={source()}
              onInput={(e) => setSource(e.currentTarget.value)}
              placeholder="ex: github, n8n, zapier"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Annuler
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCreate}>
              Creer
            </Button>
          </div>
        </div>
      </Show>

      {/* Event log viewer */}
      <Show when={selectedWebhookId()}>
        <div style={{ "margin-top": "24px" }}>
          <h4 style={{ margin: "0 0 8px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
            Evenements recus
          </h4>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <For each={webhookEvents()}>
              {(event) => (
                <div style={{
                  padding: "8px 10px",
                  "border-radius": "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: event.readAt ? "transparent" : "var(--bg-elevated)",
                }}>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                      {formatDate(event.receivedAt)}
                    </span>
                    <Show when={!event.readAt}>
                      <span style={{
                        "font-size": "9px",
                        padding: "1px 6px",
                        "border-radius": "8px",
                        background: "var(--accent-color)",
                        color: "#fff",
                      }}>
                        nouveau
                      </span>
                    </Show>
                    <div style={{ flex: "1" }} />
                    <Show when={!event.readAt}>
                      <Button variant="ghost" size="sm" onClick={() => markEventRead(event.id)}>
                        Marquer lu
                      </Button>
                    </Show>
                  </div>
                  <div style={{
                    "margin-top": "4px",
                    "font-size": "11px",
                    color: "var(--text-secondary)",
                    "font-family": "monospace",
                    "word-break": "break-all",
                  }}>
                    {truncatePayload(event.payload)}
                  </div>
                </div>
              )}
            </For>

            <Show when={webhookEvents().length === 0}>
              <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "8px 0" }}>
                Aucun evenement recu.
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

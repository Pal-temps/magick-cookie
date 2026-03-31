import { createSignal, Show, For, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface SshKeyResult {
  name: string;
  public_key: string;
  fingerprint: string;
}

export function SshKeyManager() {
  const [keys, setKeys] = createSignal<SshKeyResult[]>([]);
  const [showGenerate, setShowGenerate] = createSignal(false);
  const [newKeyName, setNewKeyName] = createSignal("");
  const [newKeyComment, setNewKeyComment] = createSignal("");
  const [generating, setGenerating] = createSignal(false);
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");

  onMount(fetchKeys);

  async function fetchKeys() {
    try {
      const list = await invoke<SshKeyResult[]>("secrets_list_ssh_keys");
      setKeys(list);
    } catch { /* vault not unlocked */ }
  }

  async function generateKey() {
    const name = newKeyName().trim();
    if (!name) return;
    setGenerating(true);
    setError("");
    try {
      await invoke<SshKeyResult>("secrets_generate_ssh_key", {
        name,
        comment: newKeyComment().trim() || null,
      });
      await fetchKeys();
      setShowGenerate(false);
      setNewKeyName("");
      setNewKeyComment("");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function copyPublicKey(pubkey: string, name: string) {
    await navigator.clipboard.writeText(pubkey);
    setCopiedKey(name);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function exportKey(name: string) {
    try {
      const slug = name.replace(/\s+/g, "-").toLowerCase();
      // Use the standard SSH directory via Tauri fs
      const outputPath = `~/.ssh/${slug}`;
      await invoke<string>("secrets_export_ssh_key", { name, outputPath });
      alert(`Cle exportee vers ${outputPath}\nCle publique: ${outputPath}.pub`);
    } catch (e: any) {
      alert(`Erreur: ${e}`);
    }
  }

  return (
    <div class="pwd-ssh-manager">
      <div class="pwd-ssh-manager__header">
        <span>Cles SSH</span>
        <button class="pwd-btn pwd-btn--sm pwd-btn--primary" onClick={() => setShowGenerate(true)}>
          + Generer
        </button>
      </div>

      {/* Generate form */}
      <Show when={showGenerate()}>
        <div class="pwd-ssh-generate">
          <label class="pwd-field">
            <span>Nom de la cle</span>
            <input
              autofocus
              value={newKeyName()}
              onInput={(e) => setNewKeyName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") generateKey(); if (e.key === "Escape") setShowGenerate(false); }}
              placeholder="vps-production"
            />
          </label>
          <label class="pwd-field">
            <span>Commentaire (optionnel)</span>
            <input
              value={newKeyComment()}
              onInput={(e) => setNewKeyComment(e.currentTarget.value)}
              placeholder="deploy@paltemps.fr"
            />
          </label>
          <Show when={error()}>
            <div style={{ "font-size": "12px", color: "var(--danger, #e74c3c)" }}>{error()}</div>
          </Show>
          <div style={{ display: "flex", gap: "6px" }}>
            <button class="pwd-btn pwd-btn--primary" onClick={generateKey} disabled={generating() || !newKeyName().trim()}>
              {generating() ? "Generation..." : "Generer ED25519"}
            </button>
            <button class="pwd-btn" onClick={() => setShowGenerate(false)}>Annuler</button>
          </div>
          <p style={{ "font-size": "11px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            La cle privee sera stockee dans le coffre-fort chiffre. Seule la cle publique est visible.
          </p>
        </div>
      </Show>

      {/* Key list */}
      <div class="pwd-ssh-list">
        <For each={keys()} fallback={
          <div style={{ padding: "16px", "text-align": "center", color: "var(--text-muted)", "font-size": "12px" }}>
            Aucune cle SSH. Cliquez sur "+ Generer" pour en creer une.
          </div>
        }>
          {(key) => (
            <div class="pwd-ssh-key">
              <div class="pwd-ssh-key__header">
                <span class="pwd-ssh-key__name">{key.name}</span>
                <span class="pwd-ssh-key__fp">{key.fingerprint}</span>
              </div>
              <div class="pwd-ssh-key__pubkey">
                <code>{key.public_key}</code>
              </div>
              <div class="pwd-ssh-key__actions">
                <button
                  class={`pwd-btn pwd-btn--sm ${copiedKey() === key.name ? "pwd-btn--success" : ""}`}
                  onClick={() => copyPublicKey(key.public_key, key.name)}
                >
                  {copiedKey() === key.name ? "Copiee!" : "Copier pub"}
                </button>
                <button class="pwd-btn pwd-btn--sm" onClick={() => exportKey(key.name)}>
                  Exporter ~/.ssh/
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

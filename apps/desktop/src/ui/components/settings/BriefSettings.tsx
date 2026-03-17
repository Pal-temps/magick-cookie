import { createSignal, For, Show, onMount } from "solid-js";
import { Button } from "../common/Button";
import {
  type BriefTemplate,
  BRIEF_PRESETS,
  getCustomTemplates,
  getActiveTemplateId,
  setActiveTemplateId,
  addCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
} from "../../../application/brief/briefTemplates";

export function BriefSettings() {
  const [allTemplates, setAllTemplates] = createSignal<BriefTemplate[]>([]);
  const [activeId, setActiveId] = createSignal("standup-fr");
  const [editingTemplate, setEditingTemplate] = createSignal<BriefTemplate | null>(null);
  const [editName, setEditName] = createSignal("");
  const [editPrompt, setEditPrompt] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  function reload() {
    setAllTemplates([...BRIEF_PRESETS, ...getCustomTemplates()]);
    setActiveId(getActiveTemplateId());
  }

  onMount(() => reload());

  function handleSelectActive(id: string) {
    setActiveTemplateId(id);
    setActiveId(id);
  }

  function handleEdit(template: BriefTemplate) {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditPrompt(template.prompt);
    setCreating(false);
  }

  function handleStartCreate() {
    setEditingTemplate(null);
    setEditName("");
    setEditPrompt("");
    setCreating(true);
  }

  function handleSave() {
    const name = editName().trim();
    const prompt = editPrompt().trim();
    if (!name || !prompt) return;

    if (creating()) {
      const t = addCustomTemplate(name, prompt);
      setActiveTemplateId(t.id);
    } else {
      const tpl = editingTemplate();
      if (tpl && !tpl.builtin) {
        updateCustomTemplate(tpl.id, name, prompt);
      }
    }

    reload();
    setEditingTemplate(null);
    setCreating(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleCancel() {
    setEditingTemplate(null);
    setCreating(false);
  }

  function handleDelete(id: string) {
    deleteCustomTemplate(id);
    reload();
    setEditingTemplate(null);
  }

  return (
    <div style={{ padding: "24px", "max-width": "700px" }}>
      <h3 style={{
        margin: "0 0 4px",
        "font-size": "16px",
        "font-weight": "600",
        color: "var(--text-primary)",
      }}>
        Templates de brief
      </h3>
      <p style={{
        margin: "0 0 20px",
        "font-size": "12px",
        color: "var(--text-muted)",
      }}>
        Choisissez un template pour personnaliser le format de votre brief quotidien.
      </p>

      {/* Template list */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-bottom": "16px" }}>
        <For each={allTemplates()}>
          {(template) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "10px 12px",
                "border-radius": "var(--radius-md)",
                border: activeId() === template.id
                  ? "1px solid var(--accent-color)"
                  : "1px solid var(--border-color)",
                background: activeId() === template.id
                  ? "var(--bg-elevated)"
                  : "transparent",
                cursor: "pointer",
              }}
              onClick={() => handleSelectActive(template.id)}
            >
              {/* Radio indicator */}
              <div style={{
                width: "14px",
                height: "14px",
                "border-radius": "50%",
                border: activeId() === template.id
                  ? "4px solid var(--accent-color)"
                  : "2px solid var(--border-color)",
                "flex-shrink": "0",
              }} />

              {/* Name + badge */}
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{
                  "font-size": "13px",
                  "font-weight": "500",
                  color: "var(--text-primary)",
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                }}>
                  {template.name}
                  <Show when={template.builtin}>
                    <span style={{
                      "font-size": "10px",
                      padding: "1px 5px",
                      "border-radius": "4px",
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                      "font-weight": "400",
                    }}>
                      preset
                    </span>
                  </Show>
                </div>
                <div style={{
                  "font-size": "11px",
                  color: "var(--text-muted)",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "margin-top": "2px",
                }}>
                  {template.prompt.split("\n")[0].slice(0, 80)}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(template)}
                >
                  {template.builtin ? "Voir" : "Editer"}
                </Button>
                <Show when={!template.builtin}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                  >
                    Suppr.
                  </Button>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Add custom button */}
      <Show when={!creating() && !editingTemplate()}>
        <Button variant="secondary" size="sm" onClick={handleStartCreate}>
          + Nouveau template
        </Button>
      </Show>

      {/* Edit / Create form */}
      <Show when={creating() || editingTemplate()}>
        <div style={{
          "margin-top": "16px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{
              display: "block",
              "font-size": "12px",
              "font-weight": "500",
              color: "var(--text-secondary)",
              "margin-bottom": "4px",
            }}>
              Nom
            </label>
            <input
              type="text"
              value={editName()}
              onInput={(e) => setEditName(e.currentTarget.value)}
              disabled={!!editingTemplate()?.builtin}
              placeholder="Mon template"
              style={{
                width: "100%",
                padding: "6px 10px",
                "border-radius": "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                "font-size": "13px",
                outline: "none",
                "box-sizing": "border-box",
              }}
            />
          </div>

          <div style={{ "margin-bottom": "12px" }}>
            <label style={{
              display: "block",
              "font-size": "12px",
              "font-weight": "500",
              color: "var(--text-secondary)",
              "margin-bottom": "4px",
            }}>
              Prompt systeme
            </label>
            <textarea
              value={editPrompt()}
              onInput={(e) => setEditPrompt(e.currentTarget.value)}
              disabled={!!editingTemplate()?.builtin}
              rows={10}
              placeholder="Tu es un assistant qui..."
              style={{
                width: "100%",
                padding: "8px 10px",
                "border-radius": "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                "font-size": "12px",
                "font-family": "monospace",
                "line-height": "1.5",
                resize: "vertical",
                outline: "none",
                "box-sizing": "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Annuler
            </Button>
            <Show when={!editingTemplate()?.builtin}>
              <Button variant="secondary" size="sm" onClick={handleSave}>
                {creating() ? "Creer" : "Enregistrer"}
              </Button>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={saved()}>
        <div style={{
          "margin-top": "12px",
          "font-size": "12px",
          color: "var(--accent-color)",
        }}>
          Template enregistre.
        </div>
      </Show>
    </div>
  );
}

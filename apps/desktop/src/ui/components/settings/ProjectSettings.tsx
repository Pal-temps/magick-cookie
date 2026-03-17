import { createSignal, For, Show } from "solid-js";
import { useProjectStore, type CreateProjectInput } from "../../../application/stores/projectStore";
import { Button } from "../common/Button";

const PRESET_COLORS = [
  "#6c5ce7", "#0984e3", "#00b894", "#fdcb6e", "#e17055",
  "#d63031", "#fd79a8", "#636e72", "#2d3436", "#e8a54b",
];

export function ProjectSettings() {
  const { projects, createProject, updateProject, deleteProject } = useProjectStore();
  const [editing, setEditing] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [color, setColor] = createSignal("#6c5ce7");

  function resetForm() {
    setName("");
    setColor("#6c5ce7");
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(id: string) {
    const p = projects().find((p) => p.id === id);
    if (!p) return;
    setName(p.name);
    setColor(p.color);
    setEditing(id);
    setCreating(false);
  }

  async function handleSave() {
    const n = name().trim();
    if (!n) return;

    const input: CreateProjectInput = { name: n, color: color() };

    if (creating()) {
      await createProject(input);
    } else if (editing()) {
      await updateProject(editing()!, input);
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    if (editing() === id) resetForm();
  }

  return (
    <div style={{ padding: "24px", "max-width": "700px" }}>
      <h3 style={{ margin: "0 0 4px", "font-size": "16px", "font-weight": "600", color: "var(--text-primary)" }}>
        Projets
      </h3>
      <p style={{ margin: "0 0 20px", "font-size": "12px", color: "var(--text-muted)" }}>
        Organisez votre temps par projet. Selectionnez un projet dans le timer pour suivre le temps passe.
      </p>

      {/* List */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-bottom": "16px" }}>
        <For each={projects()}>
          {(project) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "10px 12px",
              "border-radius": "var(--radius-md)",
              border: editing() === project.id ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
              background: editing() === project.id ? "var(--bg-elevated)" : "transparent",
            }}>
              <div style={{
                width: "14px",
                height: "14px",
                "border-radius": "50%",
                background: project.color,
                "flex-shrink": "0",
              }} />
              <div style={{ flex: "1", "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                {project.name}
              </div>
              <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                <Button variant="ghost" size="sm" onClick={() => startEdit(project.id)}>
                  Editer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                  Suppr.
                </Button>
              </div>
            </div>
          )}
        </For>

        <Show when={projects().length === 0}>
          <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "12px 0" }}>
            Aucun projet. Cliquez sur "+ Nouveau projet" pour commencer.
          </div>
        </Show>
      </div>

      {/* Add button */}
      <Show when={!creating() && !editing()}>
        <Button variant="secondary" size="sm" onClick={startCreate}>
          + Nouveau projet
        </Button>
      </Show>

      {/* Edit / Create form */}
      <Show when={creating() || editing()}>
        <div style={{
          "margin-top": "16px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
              Nom du projet
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Mon projet"
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
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
              Couleur
            </label>
            <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
              {PRESET_COLORS.map((c) => (
                <button
                  onClick={() => setColor(c)}
                  style={{
                    width: "28px",
                    height: "28px",
                    "border-radius": "50%",
                    background: c,
                    border: color() === c ? "3px solid var(--text-primary)" : "2px solid transparent",
                    cursor: "pointer",
                    padding: "0",
                    outline: color() === c ? "2px solid var(--bg-base)" : "none",
                    "outline-offset": "-3px",
                  }}
                />
              ))}
              <input
                type="color"
                value={color()}
                onInput={(e) => setColor(e.currentTarget.value)}
                style={{
                  width: "28px",
                  height: "28px",
                  "border-radius": "50%",
                  border: "2px solid var(--border-color)",
                  cursor: "pointer",
                  padding: "0",
                  background: "none",
                }}
                title="Couleur personnalisee"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Annuler
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave}>
              {creating() ? "Creer" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}

import { createSignal, For, Show } from "solid-js";
import { useRoutineStore, type CreateRoutineInput, type RoutineStep, type Routine } from "../../../application/stores/routineStore";
import { Button } from "../common/Button";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const STEP_ACTIONS = [
  { value: "navigate", label: "Naviguer vers" },
  { value: "sync", label: "Synchroniser" },
  { value: "generate", label: "Generer" },
  { value: "notify", label: "Notifier" },
] as const;

const NAVIGATE_VIEWS = [
  { value: "dashboard", label: "Tableau de bord" },
  { value: "flux", label: "Flux" },
  { value: "email", label: "Email" },
  { value: "chat", label: "Chat" },
  { value: "rss", label: "RSS" },
  { value: "library", label: "Bibliotheque" },
];

const SYNC_TARGETS = [
  { value: "email", label: "Email" },
  { value: "rss", label: "RSS" },
  { value: "github", label: "GitHub" },
];

const GENERATE_TARGETS = [
  { value: "brief", label: "Brief" },
  { value: "changelog", label: "Changelog" },
  { value: "rss-digest", label: "Digest RSS (IA)" },
];

export function RoutineSettings() {
  const { routines, createRoutine, updateRoutine, deleteRoutine, runRoutineNow } = useRoutineStore();
  const [editing, setEditing] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [triggerTime, setTriggerTime] = createSignal("08:00");
  const [triggerDays, setTriggerDays] = createSignal<number[]>([1, 2, 3, 4, 5]);
  const [steps, setSteps] = createSignal<RoutineStep[]>([]);
  const [enabled, setEnabled] = createSignal(true);

  // New step form
  const [newStepAction, setNewStepAction] = createSignal<string>("navigate");
  const [newStepParam1, setNewStepParam1] = createSignal("dashboard");
  const [newStepParam2, setNewStepParam2] = createSignal("");

  const inputStyle = {
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

  function resetForm() {
    setName("");
    setTriggerTime("08:00");
    setTriggerDays([1, 2, 3, 4, 5]);
    setSteps([]);
    setEnabled(true);
    setEditing(null);
    setCreating(false);
    resetStepForm();
  }

  function resetStepForm() {
    setNewStepAction("navigate");
    setNewStepParam1("dashboard");
    setNewStepParam2("");
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(routine: Routine) {
    setName(routine.name);
    setTriggerTime(routine.triggerTime);
    setTriggerDays([...routine.triggerDays]);
    setSteps([...routine.steps]);
    setEnabled(routine.enabled);
    setEditing(routine.id);
    setCreating(false);
  }

  function toggleDay(day: number) {
    setTriggerDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      return [...prev, day].sort();
    });
  }

  function addStep() {
    const action = newStepAction();
    let step: RoutineStep;

    switch (action) {
      case "navigate":
        step = { action: "navigate", view: newStepParam1() };
        break;
      case "sync":
        step = { action: "sync", target: newStepParam1() as "email" | "rss" | "github" };
        break;
      case "generate":
        step = { action: "generate", target: newStepParam1() as "brief" | "changelog" | "rss-digest" };
        break;
      case "notify":
        step = { action: "notify", title: newStepParam1(), body: newStepParam2() };
        break;
      default:
        return;
    }

    setSteps((prev) => [...prev, step]);
    resetStepForm();
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function getStepLabel(step: RoutineStep): string {
    switch (step.action) {
      case "navigate":
        return `Naviguer vers: ${step.view}`;
      case "sync":
        return `Synchroniser: ${step.target}`;
      case "generate":
        return `Generer: ${step.target}`;
      case "notify":
        return `Notifier: ${step.title}`;
    }
  }

  async function handleSave() {
    const n = name().trim();
    if (!n) return;

    const input: CreateRoutineInput = {
      name: n,
      triggerTime: triggerTime(),
      triggerDays: triggerDays(),
      steps: steps(),
      enabled: enabled(),
    };

    if (creating()) {
      await createRoutine(input);
    } else if (editing()) {
      await updateRoutine(editing()!, input);
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    await deleteRoutine(id);
    if (editing() === id) resetForm();
  }

  async function handleToggleEnabled(routine: Routine) {
    await updateRoutine(routine.id, { enabled: !routine.enabled });
  }

  return (
    <div style={{ padding: "24px", "max-width": "700px" }}>
      <h3 style={{ margin: "0 0 4px", "font-size": "16px", "font-weight": "600", color: "var(--text-primary)" }}>
        Routines
      </h3>
      <p style={{ margin: "0 0 20px", "font-size": "12px", color: "var(--text-muted)" }}>
        Sequences d'actions programmables declenchees automatiquement a une heure et des jours precis.
      </p>

      {/* List */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-bottom": "16px" }}>
        <For each={routines()}>
          {(routine) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "10px 12px",
              "border-radius": "var(--radius-md)",
              border: editing() === routine.id ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
              background: editing() === routine.id ? "var(--bg-elevated)" : "transparent",
              opacity: routine.enabled ? "1" : "0.5",
            }}>
              <div style={{ flex: "1" }}>
                <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                  {routine.name}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px" }}>
                  {routine.triggerTime} - {routine.triggerDays.map((d) => DAY_LABELS[d]).join(", ")} - {routine.steps.length} etape(s)
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                <Button variant="ghost" size="sm" onClick={() => runRoutineNow(routine.id)}>
                  Lancer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleToggleEnabled(routine)}>
                  {routine.enabled ? "Desact." : "Activer"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(routine)}>
                  Editer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(routine.id)}>
                  Suppr.
                </Button>
              </div>
            </div>
          )}
        </For>

        <Show when={routines().length === 0}>
          <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "12px 0" }}>
            Aucune routine. Cliquez sur "+ Nouvelle routine" pour commencer.
          </div>
        </Show>
      </div>

      {/* Add button */}
      <Show when={!creating() && !editing()}>
        <Button variant="secondary" size="sm" onClick={startCreate}>
          + Nouvelle routine
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
          {/* Name */}
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
              Nom
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Ma routine matinale"
              style={inputStyle}
            />
          </div>

          {/* Time */}
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
              Heure de declenchement
            </label>
            <input
              type="time"
              value={triggerTime()}
              onInput={(e) => setTriggerTime(e.currentTarget.value)}
              style={{ ...inputStyle, width: "140px" }}
            />
          </div>

          {/* Days */}
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
              Jours
            </label>
            <div style={{ display: "flex", gap: "4px" }}>
              {DAY_LABELS.map((label, idx) => (
                <button
                  onClick={() => toggleDay(idx)}
                  style={{
                    padding: "4px 8px",
                    "border-radius": "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    background: triggerDays().includes(idx) ? "var(--accent-color)" : "transparent",
                    color: triggerDays().includes(idx) ? "#fff" : "var(--text-secondary)",
                    "font-size": "11px",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Enabled */}
          <div style={{ "margin-bottom": "12px", display: "flex", "align-items": "center", gap: "8px" }}>
            <label style={{ "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)" }}>
              Active
            </label>
            <input
              type="checkbox"
              checked={enabled()}
              onChange={(e) => setEnabled(e.currentTarget.checked)}
            />
          </div>

          {/* Steps */}
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
              Etapes ({steps().length})
            </label>

            <For each={steps()}>
              {(step, idx) => (
                <div style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "6px 8px",
                  "margin-bottom": "4px",
                  "border-radius": "var(--radius-sm)",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                }}>
                  <span style={{ "font-size": "11px", color: "var(--text-muted)", "min-width": "20px" }}>
                    {idx() + 1}.
                  </span>
                  <span style={{ flex: "1", "font-size": "12px", color: "var(--text-primary)" }}>
                    {getStepLabel(step)}
                  </span>
                  <button
                    onClick={() => removeStep(idx())}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      "font-size": "14px",
                      padding: "0 4px",
                    }}
                  >
                    x
                  </button>
                </div>
              )}
            </For>

            {/* Add step */}
            <div style={{
              display: "flex",
              gap: "6px",
              "align-items": "flex-end",
              "margin-top": "8px",
              "flex-wrap": "wrap",
            }}>
              <select
                value={newStepAction()}
                onChange={(e) => {
                  setNewStepAction(e.currentTarget.value);
                  // Reset params based on action
                  switch (e.currentTarget.value) {
                    case "navigate": setNewStepParam1("dashboard"); break;
                    case "sync": setNewStepParam1("email"); break;
                    case "generate": setNewStepParam1("brief"); break;
                    case "notify": setNewStepParam1(""); break;
                  }
                  setNewStepParam2("");
                }}
                style={{ ...inputStyle, width: "140px" }}
              >
                {STEP_ACTIONS.map((a) => (
                  <option value={a.value}>{a.label}</option>
                ))}
              </select>

              <Show when={newStepAction() === "navigate"}>
                <select
                  value={newStepParam1()}
                  onChange={(e) => setNewStepParam1(e.currentTarget.value)}
                  style={{ ...inputStyle, width: "140px" }}
                >
                  {NAVIGATE_VIEWS.map((v) => (
                    <option value={v.value}>{v.label}</option>
                  ))}
                </select>
              </Show>

              <Show when={newStepAction() === "sync"}>
                <select
                  value={newStepParam1()}
                  onChange={(e) => setNewStepParam1(e.currentTarget.value)}
                  style={{ ...inputStyle, width: "140px" }}
                >
                  {SYNC_TARGETS.map((t) => (
                    <option value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Show>

              <Show when={newStepAction() === "generate"}>
                <select
                  value={newStepParam1()}
                  onChange={(e) => setNewStepParam1(e.currentTarget.value)}
                  style={{ ...inputStyle, width: "140px" }}
                >
                  {GENERATE_TARGETS.map((t) => (
                    <option value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Show>

              <Show when={newStepAction() === "notify"}>
                <input
                  type="text"
                  value={newStepParam1()}
                  onInput={(e) => setNewStepParam1(e.currentTarget.value)}
                  placeholder="Titre"
                  style={{ ...inputStyle, width: "120px" }}
                />
                <input
                  type="text"
                  value={newStepParam2()}
                  onInput={(e) => setNewStepParam2(e.currentTarget.value)}
                  placeholder="Message"
                  style={{ ...inputStyle, width: "160px" }}
                />
              </Show>

              <Button variant="ghost" size="sm" onClick={addStep}>
                + Ajouter
              </Button>
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

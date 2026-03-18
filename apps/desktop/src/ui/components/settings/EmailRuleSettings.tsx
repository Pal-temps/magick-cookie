import { createSignal, onMount, Show, For } from "solid-js";
import { useEmailRuleStore, type CreateEmailRuleInput, type EmailRule } from "../../../application/stores/emailRuleStore";
import { Button } from "../common/Button";

const CONDITION_FIELDS = [
  { value: "from", label: "Expediteur" },
  { value: "subject", label: "Sujet" },
  { value: "domain", label: "Domaine" },
] as const;

const CONDITION_OPERATORS = [
  { value: "contains", label: "contient" },
  { value: "equals", label: "est egal a" },
  { value: "startsWith", label: "commence par" },
  { value: "endsWith", label: "se termine par" },
] as const;

const ACTION_TYPES = [
  { value: "classify", label: "Classer comme" },
  { value: "star", label: "Marquer favoris" },
  { value: "archive", label: "Archiver" },
] as const;

export function EmailRuleSettings() {
  const { rules, isLoading, fetchRules, createRule, updateRule, deleteRule, toggleRule } = useEmailRuleStore();

  const [showForm, setShowForm] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [name, setName] = createSignal("");
  const [conditionField, setConditionField] = createSignal<EmailRule["conditionField"]>("from");
  const [conditionOperator, setConditionOperator] = createSignal<EmailRule["conditionOperator"]>("contains");
  const [conditionValue, setConditionValue] = createSignal("");
  const [actionType, setActionType] = createSignal<EmailRule["actionType"]>("classify");
  const [actionValue, setActionValue] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  onMount(async () => {
    await fetchRules();
  });

  function resetForm() {
    setName("");
    setConditionField("from");
    setConditionOperator("contains");
    setConditionValue("");
    setActionType("classify");
    setActionValue("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(rule: EmailRule) {
    setName(rule.name);
    setConditionField(rule.conditionField);
    setConditionOperator(rule.conditionOperator);
    setConditionValue(rule.conditionValue);
    setActionType(rule.actionType);
    setActionValue(rule.actionValue);
    setEditingId(rule.id);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const resolvedActionValue = actionType() === "classify" ? actionValue() : "true";
      const input: CreateEmailRuleInput = {
        name: name(),
        conditionField: conditionField(),
        conditionOperator: conditionOperator(),
        conditionValue: conditionValue(),
        actionType: actionType(),
        actionValue: resolvedActionValue,
      };

      if (editingId()) {
        await updateRule(editingId()!, input);
      } else {
        await createRule(input);
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: EmailRule) {
    await toggleRule(rule.id, !rule.enabled);
  }

  async function handleDelete(id: string) {
    await deleteRule(id);
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "13px",
    "box-sizing": "border-box" as const,
  };

  const labelStyle = {
    "font-size": "12px",
    "font-weight": "500" as const,
    color: "var(--text-muted)",
    "margin-bottom": "4px",
    display: "block",
  };

  const sectionStyle = {
    "margin-bottom": "16px",
  };

  function actionLabel(type: string, value: string): string {
    switch (type) {
      case "classify": return `Classer : ${value}`;
      case "star": return "Marquer favoris";
      case "archive": return "Archiver";
      default: return type;
    }
  }

  function conditionLabel(field: string, op: string, value: string): string {
    const f = CONDITION_FIELDS.find((c) => c.value === field)?.label || field;
    const o = CONDITION_OPERATORS.find((c) => c.value === op)?.label || op;
    return `${f} ${o} "${value}"`;
  }

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
        Regles email
      </h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        Classez automatiquement vos emails avec des regles basees sur l'expediteur, le sujet ou le domaine.
      </p>

      {/* Rule list */}
      <Show when={rules().length > 0}>
        <div style={{ "margin-bottom": "16px" }}>
          <For each={rules()}>
            {(rule) => (
              <div style={{
                padding: "12px 14px",
                background: "var(--bg-elevated)",
                "border-radius": "var(--radius-md)",
                "margin-bottom": "8px",
                border: "1px solid var(--border-color)",
                opacity: rule.enabled ? "1" : "0.5",
              }}>
                <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
                  <div>
                    <div style={{ "font-weight": "500", color: "var(--text-primary)", "font-size": "13px" }}>
                      {rule.name}
                    </div>
                    <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px" }}>
                      Si {conditionLabel(rule.conditionField, rule.conditionOperator, rule.conditionValue)}
                    </div>
                    <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                      Alors {actionLabel(rule.actionType, rule.actionValue)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Button size="sm" variant="secondary" onClick={() => handleToggle(rule)}>
                      {rule.enabled ? "Desactiver" : "Activer"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => startEdit(rule)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDelete(rule.id)}>
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={rules().length === 0 && !isLoading()}>
        <div style={{ "font-size": "13px", color: "var(--text-muted)", "margin-bottom": "16px" }}>
          Aucune regle configuree.
        </div>
      </Show>

      {/* Add/Edit form */}
      <Show when={!showForm()}>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          Ajouter une regle
        </Button>
      </Show>

      <Show when={showForm()}>
        <div style={{
          padding: "16px",
          background: "var(--bg-elevated)",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
        }}>
          <div style={sectionStyle}>
            <label style={labelStyle}>Nom de la regle</label>
            <input type="text" value={name()} onInput={(e) => setName(e.target.value)} style={inputStyle} placeholder="Ex: Newsletters" />
          </div>

          <div style={{ display: "flex", gap: "8px", ...sectionStyle }}>
            <div style={{ flex: "1" }}>
              <label style={labelStyle}>Champ</label>
              <select value={conditionField()} onChange={(e) => setConditionField(e.target.value as EmailRule["conditionField"])} style={inputStyle}>
                <For each={CONDITION_FIELDS}>{(f) => <option value={f.value}>{f.label}</option>}</For>
              </select>
            </div>
            <div style={{ flex: "1" }}>
              <label style={labelStyle}>Operateur</label>
              <select value={conditionOperator()} onChange={(e) => setConditionOperator(e.target.value as EmailRule["conditionOperator"])} style={inputStyle}>
                <For each={CONDITION_OPERATORS}>{(o) => <option value={o.value}>{o.label}</option>}</For>
              </select>
            </div>
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Valeur</label>
            <input type="text" value={conditionValue()} onInput={(e) => setConditionValue(e.target.value)} style={inputStyle} placeholder="Ex: newsletter@, noreply" />
          </div>

          <div style={{ display: "flex", gap: "8px", ...sectionStyle }}>
            <div style={{ flex: "1" }}>
              <label style={labelStyle}>Action</label>
              <select value={actionType()} onChange={(e) => setActionType(e.target.value as EmailRule["actionType"])} style={inputStyle}>
                <For each={ACTION_TYPES}>{(a) => <option value={a.value}>{a.label}</option>}</For>
              </select>
            </div>
            <Show when={actionType() === "classify"}>
              <div style={{ flex: "1" }}>
                <label style={labelStyle}>Classification</label>
                <input type="text" value={actionValue()} onInput={(e) => setActionValue(e.target.value)} style={inputStyle} placeholder="Ex: newsletter, facture" />
              </div>
            </Show>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving() || !name() || !conditionValue() || (actionType() === "classify" && !actionValue())}>
              {saving() ? "..." : editingId() ? "Mettre a jour" : "Ajouter"}
            </Button>
            <Button variant="secondary" size="sm" onClick={resetForm}>
              Annuler
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}

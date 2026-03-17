import { createSignal, onMount, Show, For } from "solid-js";
import { useLlmStore } from "../../../application/stores/llmStore";
import { Button } from "../common/Button";

type LlmMode = "local" | "api";

interface ProviderPreset {
  id: string;
  label: string;
  mode: LlmMode;
  baseUrl: string;
  model: string;
  needsApiKey: boolean;
}

const PRESETS: ProviderPreset[] = [
  { id: "ollama", label: "Ollama", mode: "local", baseUrl: "http://localhost:11434", model: "llama3.2", needsApiKey: false },
  { id: "lmstudio", label: "LM Studio", mode: "local", baseUrl: "http://localhost:1234", model: "local-model", needsApiKey: false },
  { id: "openai", label: "OpenAI", mode: "api", baseUrl: "https://api.openai.com", model: "gpt-4o-mini", needsApiKey: true },
  { id: "anthropic", label: "Anthropic", mode: "api", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-20250514", needsApiKey: true },
  { id: "mistral", label: "Mistral AI", mode: "api", baseUrl: "https://api.mistral.ai", model: "mistral-small-latest", needsApiKey: true },
  { id: "groq", label: "Groq", mode: "api", baseUrl: "https://api.groq.com/openai", model: "llama-3.3-70b-versatile", needsApiKey: true },
  { id: "openai-compatible", label: "Autre (OpenAI compatible)", mode: "api", baseUrl: "", model: "", needsApiKey: true },
];

export function LlmSettings() {
  const { llmConfig, llmLoading, llmTestResult, fetchConfig, updateConfig, testConnection } = useLlmStore();

  const [mode, setMode] = createSignal<LlmMode>("local");
  const [provider, setProvider] = createSignal("ollama");
  const [baseUrl, setBaseUrl] = createSignal("http://localhost:11434");
  const [model, setModel] = createSignal("llama3.2");
  const [apiKey, setApiKey] = createSignal("");
  const [maxTokens, setMaxTokens] = createSignal(2048);
  const [temperature, setTemperature] = createSignal(0.7);
  const [saved, setSaved] = createSignal(false);

  onMount(async () => {
    await fetchConfig();
    const cfg = llmConfig();
    if (cfg) {
      setProvider(cfg.provider);
      setBaseUrl(cfg.baseUrl);
      setModel(cfg.model);
      setApiKey(cfg.apiKey || "");
      setMaxTokens(cfg.maxTokens);
      setTemperature(cfg.temperature);
      // Determine mode from provider
      const preset = PRESETS.find((p) => p.id === cfg.provider);
      setMode(preset?.mode ?? (cfg.apiKey ? "api" : "local"));
    }
  });

  function selectPreset(preset: ProviderPreset) {
    setProvider(preset.id);
    setMode(preset.mode);
    if (preset.baseUrl) setBaseUrl(preset.baseUrl);
    if (preset.model) setModel(preset.model);
    if (!preset.needsApiKey) setApiKey("");
  }

  function switchMode(m: LlmMode) {
    setMode(m);
    const firstOfMode = PRESETS.find((p) => p.mode === m);
    if (firstOfMode) selectPreset(firstOfMode);
  }

  const currentPreset = () => PRESETS.find((p) => p.id === provider());
  const needsApiKey = () => currentPreset()?.needsApiKey ?? mode() === "api";
  const presetsForMode = () => PRESETS.filter((p) => p.mode === mode());

  async function handleSave() {
    setSaved(false);
    await updateConfig({
      provider: provider(),
      baseUrl: baseUrl(),
      model: model(),
      apiKey: needsApiKey() ? (apiKey() || null) : null,
      maxTokens: maxTokens(),
      temperature: temperature(),
      enabled: true,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
    "margin-bottom": "24px",
  };

  const helpStyle = {
    "font-size": "11px",
    color: "var(--text-muted)",
    "margin-top": "4px",
  };

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
        Intelligence artificielle
      </h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        Configurez un modele de langage pour les fonctionnalites IA (resume d'emails, etc.)
      </p>

      {/* Mode selector */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Type de connexion</label>
        <div style={{ display: "flex", gap: "0", "border-radius": "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-color)", width: "fit-content" }}>
          <button
            onClick={() => switchMode("local")}
            style={{
              padding: "8px 20px",
              border: "none",
              background: mode() === "local" ? "var(--accent-primary)" : "var(--bg-elevated)",
              color: mode() === "local" ? "white" : "var(--text-muted)",
              "font-size": "13px",
              cursor: "pointer",
              "font-weight": mode() === "local" ? "600" : "400",
            }}
          >
            LLM Local
          </button>
          <button
            onClick={() => switchMode("api")}
            style={{
              padding: "8px 20px",
              border: "none",
              "border-left": "1px solid var(--border-color)",
              background: mode() === "api" ? "var(--accent-primary)" : "var(--bg-elevated)",
              color: mode() === "api" ? "white" : "var(--text-muted)",
              "font-size": "13px",
              cursor: "pointer",
              "font-weight": mode() === "api" ? "600" : "400",
            }}
          >
            API Cloud
          </button>
        </div>
        <div style={helpStyle}>
          {mode() === "local"
            ? "Connectez un LLM tournant sur votre machine (aucune donnee envoyee a l'exterieur)"
            : "Utilisez une API cloud avec une cle API (les donnees sont envoyees au fournisseur)"
          }
        </div>
      </div>

      {/* Provider selector */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Fournisseur</label>
        <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
          <For each={presetsForMode()}>
            {(preset) => (
              <Button
                size="sm"
                variant={provider() === preset.id ? "primary" : "secondary"}
                onClick={() => selectPreset(preset)}
              >
                {preset.label}
              </Button>
            )}
          </For>
        </div>
      </div>

      {/* API Key — only for cloud providers */}
      <Show when={needsApiKey()}>
        <div style={sectionStyle}>
          <label style={labelStyle}>Cle API</label>
          <input
            type="password"
            value={apiKey()}
            onInput={(e) => setApiKey(e.target.value)}
            style={inputStyle}
            placeholder={provider() === "openai" ? "sk-..." : provider() === "anthropic" ? "sk-ant-..." : "Votre cle API"}
          />
          <div style={helpStyle}>
            {provider() === "openai" && "Obtenez votre cle sur platform.openai.com"}
            {provider() === "anthropic" && "Obtenez votre cle sur console.anthropic.com"}
            {provider() === "mistral" && "Obtenez votre cle sur console.mistral.ai"}
            {provider() === "groq" && "Obtenez votre cle sur console.groq.com"}
            {provider() === "openai-compatible" && "Entrez la cle API de votre fournisseur"}
          </div>
        </div>
      </Show>

      {/* URL */}
      <div style={sectionStyle}>
        <label style={labelStyle}>URL de base</label>
        <input
          type="text"
          value={baseUrl()}
          onInput={(e) => setBaseUrl(e.target.value)}
          style={inputStyle}
          placeholder={mode() === "local" ? "http://localhost:11434" : "https://api.example.com"}
        />
        <Show when={mode() === "local"}>
          <div style={helpStyle}>
            Assurez-vous que {provider() === "ollama" ? "Ollama" : "LM Studio"} est lance sur cette adresse
          </div>
        </Show>
      </div>

      {/* Model */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Modele</label>
        <input
          type="text"
          value={model()}
          onInput={(e) => setModel(e.target.value)}
          style={inputStyle}
          placeholder={mode() === "local" ? "llama3.2" : "gpt-4o-mini"}
        />
        <Show when={mode() === "local"}>
          <div style={helpStyle}>
            {provider() === "ollama"
              ? "Listez vos modeles avec : ollama list"
              : "Nom du modele charge dans LM Studio"
            }
          </div>
        </Show>
      </div>

      {/* Advanced: max tokens + temperature */}
      <div style={sectionStyle}>
        <label style={{ ...labelStyle, "margin-bottom": "8px" }}>Parametres avances</label>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: "1" }}>
            <label style={{ ...labelStyle, "font-size": "11px" }}>Max tokens</label>
            <input
              type="number"
              value={maxTokens()}
              onInput={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
              style={inputStyle}
              min="1"
              max="32768"
            />
          </div>
          <div style={{ flex: "1" }}>
            <label style={{ ...labelStyle, "font-size": "11px" }}>Temperature</label>
            <input
              type="number"
              value={temperature()}
              onInput={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
              style={inputStyle}
              min="0"
              max="2"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={llmLoading()}>
          {llmLoading() ? "..." : "Sauvegarder"}
        </Button>
        <Button variant="secondary" size="sm" onClick={testConnection}>
          Tester la connexion
        </Button>

        <Show when={saved()}>
          <span style={{ "font-size": "12px", color: "#00b894", "margin-left": "8px" }}>
            Sauvegarde
          </span>
        </Show>

        <Show when={llmTestResult() !== null}>
          <span style={{
            "font-size": "12px",
            color: llmTestResult() ? "#00b894" : "#d63031",
            "margin-left": "8px",
          }}>
            {llmTestResult() ? "Connexion OK" : "Echec de connexion"}
          </span>
        </Show>
      </div>

      {/* Status */}
      <Show when={llmConfig()}>
        {(cfg) => (
          <div style={{
            "margin-top": "24px",
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            "border-radius": "var(--radius-md)",
            "font-size": "12px",
            color: "var(--text-muted)",
          }}>
            <div style={{ "font-weight": "500", color: "var(--text-primary)", "margin-bottom": "6px" }}>
              Configuration active
            </div>
            <div>Fournisseur : {PRESETS.find((p) => p.id === cfg().provider)?.label ?? cfg().provider}</div>
            <div>Modele : {cfg().model}</div>
            <div>URL : {cfg().baseUrl}</div>
            <div>Cle API : {cfg().apiKey ? "configuree" : "aucune"}</div>
          </div>
        )}
      </Show>
    </div>
  );
}

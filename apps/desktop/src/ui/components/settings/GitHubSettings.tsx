import { createSignal, onMount, Show, For } from "solid-js";
import { useGitHubStore } from "../../../application/stores/githubStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";

export function GitHubSettings() {
  const { config, isSyncing, fetchConfig, saveConfig, deleteConfig, syncPRs } = useGitHubStore();
  const { t } = useT();

  const [token, setToken] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [repoInput, setRepoInput] = createSignal("");
  const [repos, setRepos] = createSignal<string[]>([]);
  const [saved, setSaved] = createSignal(false);
  const [testResult, setTestResult] = createSignal<boolean | null>(null);
  const [saving, setSaving] = createSignal(false);

  onMount(async () => {
    await fetchConfig();
    const cfg = config();
    if (cfg) {
      setToken("");
      setUsername(cfg.username);
      setRepos(cfg.repos);
    }
  });

  function addRepo() {
    const value = repoInput().trim();
    if (!value) return;
    const newRepos = value.split(",").map((r) => r.trim()).filter(Boolean);
    setRepos((prev) => [...prev, ...newRepos.filter((r) => !prev.includes(r))]);
    setRepoInput("");
  }

  function removeRepo(repo: string) {
    setRepos((prev) => prev.filter((r) => r !== repo));
  }

  function handleRepoKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRepo();
    }
  }

  async function handleSave() {
    setSaved(false);
    setSaving(true);
    try {
      const tokenValue = token();
      if (!tokenValue && !config()) return;
      await saveConfig({
        token: tokenValue || config()?.token || "",
        username: username(),
        repos: repos(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    try {
      const result = await syncPRs();
      setTestResult(result.length >= 0);
    } catch {
      setTestResult(false);
    }
  }

  async function handleDelete() {
    await deleteConfig();
    setToken("");
    setUsername("");
    setRepos([]);
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
        GitHub
      </h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        {t("settings.githubDesc")}
      </p>

      {/* Token */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.personalAccessToken")}</label>
        <input
          type="password"
          value={token()}
          onInput={(e) => setToken(e.target.value)}
          style={inputStyle}
          placeholder={config() ? t("settings.keepCurrentToken") : "ghp_..."}
        />
        <div style={helpStyle}>
          {t("settings.createTokenHint")}
        </div>
      </div>

      {/* Username */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.githubUsername")}</label>
        <input
          type="text"
          value={username()}
          onInput={(e) => setUsername(e.target.value)}
          style={inputStyle}
          placeholder="votre-username"
        />
        <div style={helpStyle}>
          {t("settings.usernameHint")}
        </div>
      </div>

      {/* Repos */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.reposToWatch")}</label>
        <div style={{ display: "flex", gap: "6px", "margin-bottom": "8px" }}>
          <input
            type="text"
            value={repoInput()}
            onInput={(e) => setRepoInput(e.target.value)}
            onKeyDown={handleRepoKeyDown}
            style={{ ...inputStyle, flex: "1" }}
            placeholder={t("settings.reposSeparated")}
          />
          <Button size="sm" variant="secondary" onClick={addRepo}>
            {t("common.add")}
          </Button>
        </div>
        <Show when={repos().length > 0}>
          <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
            <For each={repos()}>
              {(repo) => (
                <span style={{
                  display: "inline-flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "3px 8px",
                  "border-radius": "var(--radius-md)",
                  background: "var(--bg-elevated)",
                  "font-size": "12px",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                }}>
                  {repo}
                  <button
                    onClick={() => removeRepo(repo)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "0 2px",
                      "font-size": "14px",
                      "line-height": "1",
                    }}
                  >
                    x
                  </button>
                </span>
              )}
            </For>
          </div>
        </Show>
        <div style={helpStyle}>
          {t("settings.repoFormatHint")}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" }}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving() || (!token() && !config())}
        >
          {saving() ? "..." : t("common.save")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleTest}
          disabled={isSyncing() || !config()}
        >
          {isSyncing() ? "..." : t("settings.testConnection")}
        </Button>

        <Show when={config()}>
          <Button variant="secondary" size="sm" onClick={handleDelete}>
            {t("common.delete")}
          </Button>
        </Show>

        <Show when={saved()}>
          <span style={{ "font-size": "12px", color: "#00b894", "margin-left": "8px" }}>
            {t("settings.saved")}
          </span>
        </Show>

        <Show when={testResult() !== null}>
          <span style={{
            "font-size": "12px",
            color: testResult() ? "#00b894" : "#d63031",
            "margin-left": "8px",
          }}>
            {testResult() ? t("settings.connectionOk") : t("settings.connectionFailed")}
          </span>
        </Show>
      </div>

      {/* Current config status */}
      <Show when={config()}>
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
              {t("settings.activeConfig")}
            </div>
            <div>{t("settings.user")} : {cfg().username}</div>
            <div>{t("settings.token")} : {cfg().token}</div>
            <div>{t("settings.repos")} : {cfg().repos.length > 0 ? cfg().repos.join(", ") : t("settings.noneLabel")}</div>
          </div>
        )}
      </Show>
    </div>
  );
}

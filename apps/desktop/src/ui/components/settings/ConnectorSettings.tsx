import { createSignal, onMount, Show, For } from "solid-js";
import { api } from "../../../infrastructure/api/apiClient";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";

interface ConnectorConfigResponse {
  id: string;
  type: string;
  token: string;
  settings: Record<string, unknown>;
  enabled: boolean;
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

const sectionStyle = { "margin-bottom": "16px" };

const helpStyle = {
  "font-size": "11px",
  color: "var(--text-muted)",
  "margin-top": "4px",
};

const cardStyle = {
  padding: "20px",
  background: "var(--bg-surface)",
  "border-radius": "var(--radius-md)",
  border: "1px solid var(--border-color)",
  "margin-bottom": "20px",
};

export function ConnectorSettings() {
  const { t } = useT();

  return (
    <div style={{ padding: "24px 32px", "max-width": "700px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
        {t("settings.connectorsTitle")}
      </h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        {t("settings.connectorsDesc")}
      </p>

      <ClickUpConnector />
      <GitHubConnector />
      <GitLabConnector />
    </div>
  );
}

// --- ClickUp ---

function ClickUpConnector() {
  const { t } = useT();
  const [token, setToken] = createSignal("");
  const [existing, setExisting] = createSignal<ConnectorConfigResponse | null>(null);
  const [saved, setSaved] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [testOk, setTestOk] = createSignal<boolean | null>(null);

  onMount(async () => {
    try {
      const data = await api.get<ConnectorConfigResponse>("/connector-configs/clickup");
      setExisting(data);
    } catch {}
  });

  async function handleSave() {
    if (!token() && !existing()) return;
    const data = await api.put<ConnectorConfigResponse>("/connector-configs/clickup", {
      token: token() || existing()?.token || "",
      settings: {},
    });
    setExisting(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    setTesting(true);
    setTestOk(null);
    try {
      await api.post("/connectors/clickup/sync", {});
      setTestOk(true);
    } catch {
      setTestOk(false);
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    await api.delete("/connector-configs/clickup");
    setExisting(null);
    setToken("");
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 12px", "font-size": "15px", "font-weight": "600", color: "var(--text-primary)" }}>
        ClickUp
      </h3>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.apiToken")}</label>
        <input type="password" value={token()} onInput={(e) => setToken(e.target.value)} style={inputStyle}
          placeholder={existing() ? t("settings.keepCurrentToken") : "pk_..."} />
      </div>
      <div style={{ display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" }}>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!token() && !existing()}>{t("common.save")}</Button>
        <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing() || !existing()}>
          {testing() ? "..." : t("settings.test")}
        </Button>
        <Show when={existing()}>
          <Button variant="secondary" size="sm" onClick={handleDelete}>{t("common.delete")}</Button>
        </Show>
        <Show when={saved()}><span style={{ "font-size": "12px", color: "#00b894" }}>{t("settings.saved")}</span></Show>
        <Show when={testOk() !== null}>
          <span style={{ "font-size": "12px", color: testOk() ? "#00b894" : "#d63031" }}>
            {testOk() ? "OK" : t("settings.failed")}
          </span>
        </Show>
      </div>
    </div>
  );
}

// --- GitHub ---

function GitHubConnector() {
  const { t } = useT();
  const [token, setToken] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [repoInput, setRepoInput] = createSignal("");
  const [repos, setRepos] = createSignal<string[]>([]);
  const [syncIssues, setSyncIssues] = createSignal(true);
  const [syncPRs, setSyncPRs] = createSignal(false);
  const [existing, setExisting] = createSignal<ConnectorConfigResponse | null>(null);
  const [saved, setSaved] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [testOk, setTestOk] = createSignal<boolean | null>(null);

  onMount(async () => {
    try {
      const data = await api.get<ConnectorConfigResponse>("/connector-configs/github");
      setExisting(data);
      const s = data.settings as { username?: string; repos?: string[]; syncIssues?: boolean; syncPRs?: boolean };
      setUsername(s.username || "");
      setRepos(s.repos || []);
      setSyncIssues(s.syncIssues !== false);
      setSyncPRs(s.syncPRs || false);
    } catch {}
  });

  function addRepo() {
    const value = repoInput().trim();
    if (!value) return;
    const newRepos = value.split(",").map((r) => r.trim()).filter(Boolean);
    setRepos((prev) => [...prev, ...newRepos.filter((r) => !prev.includes(r))]);
    setRepoInput("");
  }

  async function handleSave() {
    if (!token() && !existing()) return;
    const data = await api.put<ConnectorConfigResponse>("/connector-configs/github", {
      token: token() || existing()?.token || "",
      settings: {
        username: username(),
        repos: repos(),
        syncIssues: syncIssues(),
        syncPRs: syncPRs(),
      },
    });
    setExisting(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    setTesting(true);
    setTestOk(null);
    try {
      await api.post("/connectors/github/sync", {});
      setTestOk(true);
    } catch {
      setTestOk(false);
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    await api.delete("/connector-configs/github");
    setExisting(null);
    setToken("");
    setUsername("");
    setRepos([]);
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 12px", "font-size": "15px", "font-weight": "600", color: "var(--text-primary)" }}>
        GitHub
      </h3>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.personalAccessToken")}</label>
        <input type="password" value={token()} onInput={(e) => setToken(e.target.value)} style={inputStyle}
          placeholder={existing() ? t("settings.keepCurrentToken") : "ghp_..."} />
        <div style={helpStyle}>{t("settings.permissionsRequired")}</div>
      </div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.username")}</label>
        <input type="text" value={username()} onInput={(e) => setUsername(e.target.value)} style={inputStyle} placeholder="votre-username" />
      </div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.repositories")}</label>
        <div style={{ display: "flex", gap: "6px", "margin-bottom": "8px" }}>
          <input type="text" value={repoInput()} onInput={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRepo(); }}}
            style={{ ...inputStyle, flex: "1" }} placeholder="owner/repo" />
          <Button size="sm" variant="secondary" onClick={addRepo}>{t("common.add")}</Button>
        </div>
        <Show when={repos().length > 0}>
          <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
            <For each={repos()}>
              {(repo) => (
                <span style={{
                  display: "inline-flex", "align-items": "center", gap: "4px",
                  padding: "3px 8px", "border-radius": "var(--radius-md)",
                  background: "var(--bg-elevated)", "font-size": "12px",
                  color: "var(--text-primary)", border: "1px solid var(--border-color)",
                }}>
                  {repo}
                  <button onClick={() => setRepos((p) => p.filter((r) => r !== repo))}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", "font-size": "14px", "line-height": "1" }}>x</button>
                </span>
              )}
            </For>
          </div>
        </Show>
      </div>
      <div style={{ ...sectionStyle, display: "flex", gap: "16px" }}>
        <label style={{ display: "flex", "align-items": "center", gap: "6px", "font-size": "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={syncIssues()} onChange={(e) => setSyncIssues(e.target.checked)} /> Issues
        </label>
        <label style={{ display: "flex", "align-items": "center", gap: "6px", "font-size": "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={syncPRs()} onChange={(e) => setSyncPRs(e.target.checked)} /> Pull Requests
        </label>
      </div>
      <div style={{ display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" }}>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!token() && !existing()}>{t("common.save")}</Button>
        <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing() || !existing()}>
          {testing() ? "..." : t("settings.test")}
        </Button>
        <Show when={existing()}>
          <Button variant="secondary" size="sm" onClick={handleDelete}>{t("common.delete")}</Button>
        </Show>
        <Show when={saved()}><span style={{ "font-size": "12px", color: "#00b894" }}>{t("settings.saved")}</span></Show>
        <Show when={testOk() !== null}>
          <span style={{ "font-size": "12px", color: testOk() ? "#00b894" : "#d63031" }}>
            {testOk() ? "OK" : t("settings.failed")}
          </span>
        </Show>
      </div>
    </div>
  );
}

// --- GitLab ---

function GitLabConnector() {
  const { t } = useT();
  const [token, setToken] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal("https://gitlab.com");
  const [projectIdsInput, setProjectIdsInput] = createSignal("");
  const [existing, setExisting] = createSignal<ConnectorConfigResponse | null>(null);
  const [saved, setSaved] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [testOk, setTestOk] = createSignal<boolean | null>(null);

  onMount(async () => {
    try {
      const data = await api.get<ConnectorConfigResponse>("/connector-configs/gitlab");
      setExisting(data);
      const s = data.settings as { baseUrl?: string; projectIds?: number[] };
      setBaseUrl(s.baseUrl || "https://gitlab.com");
      setProjectIdsInput((s.projectIds || []).join(", "));
    } catch {}
  });

  function parseProjectIds(): number[] {
    return projectIdsInput().split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  }

  async function handleSave() {
    if (!token() && !existing()) return;
    const data = await api.put<ConnectorConfigResponse>("/connector-configs/gitlab", {
      token: token() || existing()?.token || "",
      settings: {
        baseUrl: baseUrl(),
        projectIds: parseProjectIds(),
      },
    });
    setExisting(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    setTesting(true);
    setTestOk(null);
    try {
      await api.post("/connectors/gitlab/sync", {});
      setTestOk(true);
    } catch {
      setTestOk(false);
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    await api.delete("/connector-configs/gitlab");
    setExisting(null);
    setToken("");
    setProjectIdsInput("");
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 12px", "font-size": "15px", "font-weight": "600", color: "var(--text-primary)" }}>
        GitLab
      </h3>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.personalAccessToken")}</label>
        <input type="password" value={token()} onInput={(e) => setToken(e.target.value)} style={inputStyle}
          placeholder={existing() ? t("settings.keepCurrentToken") : "glpat-..."} />
      </div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.baseUrlLabel")}</label>
        <input type="text" value={baseUrl()} onInput={(e) => setBaseUrl(e.target.value)} style={inputStyle}
          placeholder="https://gitlab.com" />
        <div style={helpStyle}>{t("settings.selfHostedHint")}</div>
      </div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("settings.projectIds")}</label>
        <input type="text" value={projectIdsInput()} onInput={(e) => setProjectIdsInput(e.target.value)} style={inputStyle}
          placeholder="12345, 67890" />
        <div style={helpStyle}>{t("settings.projectIdsHint")}</div>
      </div>
      <div style={{ display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" }}>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!token() && !existing()}>{t("common.save")}</Button>
        <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing() || !existing()}>
          {testing() ? "..." : t("settings.test")}
        </Button>
        <Show when={existing()}>
          <Button variant="secondary" size="sm" onClick={handleDelete}>{t("common.delete")}</Button>
        </Show>
        <Show when={saved()}><span style={{ "font-size": "12px", color: "#00b894" }}>{t("settings.saved")}</span></Show>
        <Show when={testOk() !== null}>
          <span style={{ "font-size": "12px", color: testOk() ? "#00b894" : "#d63031" }}>
            {testOk() ? "OK" : t("settings.failed")}
          </span>
        </Show>
      </div>
    </div>
  );
}

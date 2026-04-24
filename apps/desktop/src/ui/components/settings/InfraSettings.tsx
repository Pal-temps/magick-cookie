import { createSignal, For, Show, onMount } from "solid-js";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { useSecretsStore } from "../../../application/stores/secretsStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";

export function InfraSettings() {
  const settings = useSettingsStore();
  const secrets = useSecretsStore();
  const { t } = useT();
  const infra = () => settings.getInfra();

  // Secret fields — loaded from KDBX on mount
  const [ovhAppKey, setOvhAppKey] = createSignal("");
  const [ovhAppSecret, setOvhAppSecret] = createSignal("");
  const [ovhConsumerKey, setOvhConsumerKey] = createSignal("");
  const [cfApiToken, setCfApiToken] = createSignal("");
  const [githubToken, setGithubToken] = createSignal("");
  const [gitlabToken, setGitlabToken] = createSignal("");

  onMount(async () => {
    if (!secrets.isUnlocked()) return;
    setOvhAppKey(await secrets.getAppSecret("ovh_app_key") ?? "");
    setOvhAppSecret(await secrets.getAppSecret("ovh_app_secret") ?? "");
    setOvhConsumerKey(await secrets.getAppSecret("ovh_consumer_key") ?? "");
    setCfApiToken(await secrets.getAppSecret("cf_api_token") ?? "");
    setGithubToken(await secrets.getAppSecret("github_token") ?? "");
    setGitlabToken(await secrets.getAppSecret("gitlab_token") ?? "");
  });

  async function saveSecret(key: string, value: string) {
    if (!value) return;
    await secrets.setAppSecret(key, value);
    await secrets.syncAppSecretsToBackend();
  }

  function updateField(field: string, value: string) {
    settings.patchInfra({ [field]: value } as any);
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)", background: "var(--bg-elevated)",
    color: "var(--text-primary)", "font-size": "13px", "box-sizing": "border-box" as const,
  };
  const labelStyle = { "font-size": "12px", "font-weight": "500" as const, color: "var(--text-muted)", "margin-bottom": "4px", display: "block" };
  const sectionStyle = { "margin-bottom": "32px" };
  const helpStyle = { "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" };
  const fieldStyle = { "margin-bottom": "12px" };
  const headingStyle = { margin: "0 0 4px", "font-size": "16px", "font-weight": "600" as const, color: "var(--text-primary)" };
  const subHeadingStyle = { margin: "0 0 16px", "font-size": "12px", color: "var(--text-muted)" };

  const [addingServer, setAddingServer] = createSignal(false);
  const [newServer, setNewServer] = createSignal({ label: "", host: "", user: "root", port: "22" });

  function addServer() {
    const s = newServer();
    if (!s.label || !s.host || !s.user) return;
    const servers = [...(infra().servers ?? [])];
    servers.push({
      id: `srv-${Date.now().toString(36)}`,
      label: s.label, host: s.host, user: s.user,
      port: parseInt(s.port) || 22, authMethod: "key",
    });
    settings.patchInfra({ servers });
    setAddingServer(false);
    setNewServer({ label: "", host: "", user: "root", port: "22" });
  }

  function removeServer(id: string) {
    const servers = (infra().servers ?? []).filter((s) => s.id !== id);
    settings.patchInfra({ servers });
  }

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>{t("settings.infraTitle")}</h2>
      <p style={{ margin: "0 0 8px", "font-size": "13px", color: "var(--text-muted)" }}>
        {t("settings.infraDesc")}
      </p>
      <Show when={!secrets.isUnlocked()}>
        <div style={{ padding: "12px", background: "rgba(231,76,60,0.1)", "border-radius": "var(--radius-md)", "font-size": "12px", color: "var(--danger, #e74c3c)", "margin-bottom": "24px" }}>
          {t("settings.vaultNotUnlocked")}
        </div>
      </Show>

      {/* OVH */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>OVH DNS</h3>
        <p style={subHeadingStyle}>{t("settings.ovhApiKeys")}</p>
        <div style={fieldStyle}>
          <label style={labelStyle}>Application Key</label>
          <input style={inputStyle} type="text" value={ovhAppKey()} onInput={(e) => setOvhAppKey(e.currentTarget.value)} onBlur={() => saveSecret("ovh_app_key", ovhAppKey())} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Application Secret</label>
          <input style={inputStyle} type="password" value={ovhAppSecret()} onInput={(e) => setOvhAppSecret(e.currentTarget.value)} onBlur={() => saveSecret("ovh_app_secret", ovhAppSecret())} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Consumer Key</label>
          <input style={inputStyle} type="password" value={ovhConsumerKey()} onInput={(e) => setOvhConsumerKey(e.currentTarget.value)} onBlur={() => saveSecret("ovh_consumer_key", ovhConsumerKey())} />
        </div>
      </div>

      {/* Cloudflare */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Cloudflare DNS</h3>
        <div style={fieldStyle}>
          <label style={labelStyle}>API Token</label>
          <input style={inputStyle} type="password" value={cfApiToken()} onInput={(e) => setCfApiToken(e.currentTarget.value)} onBlur={() => saveSecret("cf_api_token", cfApiToken())} />
        </div>
      </div>

      {/* GitHub */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>GitHub</h3>
        <div style={fieldStyle}>
          <label style={labelStyle}>Personal Access Token</label>
          <input style={inputStyle} type="password" value={githubToken()} onInput={(e) => setGithubToken(e.currentTarget.value)} onBlur={() => saveSecret("github_token", githubToken())} />
        </div>
      </div>

      {/* GitLab */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>GitLab</h3>
        <div style={fieldStyle}>
          <label style={labelStyle}>Personal Access Token</label>
          <input style={inputStyle} type="password" value={gitlabToken()} onInput={(e) => setGitlabToken(e.currentTarget.value)} onBlur={() => saveSecret("gitlab_token", gitlabToken())} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>{t("settings.gitlabUrl")}</label>
          <input style={inputStyle} type="text" value={infra().gitlabUrl} onInput={(e) => updateField("gitlabUrl", e.currentTarget.value)} placeholder="https://gitlab.com" />
          <p style={helpStyle}>{t("settings.selfHostedHint")}</p>
        </div>
      </div>

      {/* Servers */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>{t("settings.sshServers")}</h3>
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-bottom": "12px" }}>
          <For each={infra().servers ?? []} fallback={
            <p style={{ "font-size": "12px", color: "var(--text-muted)", padding: "8px 0" }}>{t("settings.noServers")}</p>
          }>
            {(server) => (
              <div style={{ display: "flex", "align-items": "center", gap: "10px", padding: "8px 12px", background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", "font-size": "12px" }}>
                <span style={{ width: "8px", height: "8px", "border-radius": "50%", background: "var(--success, #2ecc71)", "flex-shrink": "0" }} />
                <span style={{ "font-weight": "500", color: "var(--text-primary)" }}>{server.label}</span>
                <span style={{ color: "var(--text-muted)", "font-family": "monospace", "font-size": "11px" }}>{server.user}@{server.host}:{server.port}</span>
                <span style={{ "margin-left": "auto", "font-size": "10px", color: "var(--text-muted)" }}>{server.id}</span>
                <button onClick={() => removeServer(server.id)} style={{ background: "none", border: "none", color: "var(--danger, #e74c3c)", cursor: "pointer", "font-size": "14px" }}>&times;</button>
              </div>
            )}
          </For>
        </div>

        <Show when={!addingServer()}>
          <Button variant="secondary" size="sm" onClick={() => setAddingServer(true)}>{t("settings.addServer")}</Button>
        </Show>
        <Show when={addingServer()}>
          <div style={{ padding: "12px", background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", display: "flex", "flex-direction": "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ flex: "1" }}><label style={labelStyle}>{t("settings.name")}</label><input style={inputStyle} value={newServer().label} onInput={(e) => setNewServer({ ...newServer(), label: e.currentTarget.value })} placeholder="VPS OVH" /></div>
              <div style={{ flex: "1" }}><label style={labelStyle}>Host</label><input style={inputStyle} value={newServer().host} onInput={(e) => setNewServer({ ...newServer(), host: e.currentTarget.value })} placeholder="1.2.3.4" /></div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ flex: "1" }}><label style={labelStyle}>User</label><input style={inputStyle} value={newServer().user} onInput={(e) => setNewServer({ ...newServer(), user: e.currentTarget.value })} /></div>
              <div style={{ width: "80px" }}><label style={labelStyle}>Port</label><input style={inputStyle} value={newServer().port} onInput={(e) => setNewServer({ ...newServer(), port: e.currentTarget.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: "8px", "margin-top": "4px" }}>
              <Button variant="primary" size="sm" onClick={addServer}>{t("common.add")}</Button>
              <Button variant="secondary" size="sm" onClick={() => setAddingServer(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

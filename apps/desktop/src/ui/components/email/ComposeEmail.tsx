import { createSignal, For, Show } from "solid-js";
import type { EmailAccount } from "../../../domain/models/Email";
import type { SendEmailDTO } from "../../../domain/models/Email";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";

interface ComposeEmailProps {
  accounts: EmailAccount[];
  onSend: (input: SendEmailDTO) => Promise<unknown>;
  onClose: () => void;
  prefill?: Partial<SendEmailDTO>;
}

export function ComposeEmail(props: ComposeEmailProps) {
  const { t } = useT();
  const pf = props.prefill;
  const [selectedAccountId, setSelectedAccountId] = createSignal(pf?.accountId ?? props.accounts[0]?.id ?? "");
  const [to, setTo] = createSignal(pf?.to?.join(", ") ?? "");
  const [cc, setCc] = createSignal(pf?.cc?.join(", ") ?? "");
  const [showCc, setShowCc] = createSignal((pf?.cc?.length ?? 0) > 0);
  const [subject, setSubject] = createSignal(pf?.subject ?? "");
  const [body, setBody] = createSignal(pf?.bodyText ?? "");
  const [isSending, setIsSending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const selectedAccount = () => props.accounts.find((a) => a.id === selectedAccountId());

  function parseAddresses(raw: string): string[] {
    return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }

  async function handleSend() {
    const toAddrs = parseAddresses(to());
    if (toAddrs.length === 0) {
      setError(t("email.recipientRequired"));
      return;
    }
    if (!body()) {
      setError(t("email.emptyBodyError"));
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const input: SendEmailDTO = {
        accountId: selectedAccountId(),
        to: toAddrs,
        cc: showCc() ? parseAddresses(cc()) : undefined,
        subject: subject(),
        bodyText: body(),
      };
      await props.onSend(input);
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email.sendError"));
    } finally {
      setIsSending(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    background: "var(--bg-base)",
    border: "1px solid var(--border-color)",
    "border-radius": "var(--radius-sm)",
    color: "var(--text-primary)",
    "font-size": "13px",
    "box-sizing": "border-box" as const,
  };

  const labelStyle = {
    "font-size": "11px",
    color: "var(--text-muted)",
    "margin-bottom": "4px",
    display: "block" as const,
  };

  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", "flex-direction": "column" }}>
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "16px" }}>
        <h2 style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", margin: "0" }}>
          {t("email.newMessage")}
        </h2>
        <Button size="sm" variant="ghost" onClick={props.onClose}>{t("common.close")}</Button>
      </div>

      <div style={{ display: "flex", "flex-direction": "column", gap: "10px", flex: "1", "min-height": "0" }}>
        {/* Account selector */}
        <div>
          <span style={labelStyle}>{t("email.from")}</span>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={selectedAccountId()}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            <For each={props.accounts}>
              {(acc) => (
                <option value={acc.id}>{acc.label} &lt;{acc.email}&gt;</option>
              )}
            </For>
          </select>
        </div>

        {/* To */}
        <div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <span style={labelStyle}>{t("email.to")}</span>
            <Show when={!showCc()}>
              <span
                style={{ "font-size": "11px", color: "var(--accent)", cursor: "pointer" }}
                onClick={() => setShowCc(true)}
              >{t("email.cc")}</span>
            </Show>
          </div>
          <input
            style={inputStyle}
            value={to()}
            onInput={(e) => setTo(e.target.value)}
            placeholder="destinataire@example.com"
          />
        </div>

        {/* Cc */}
        <Show when={showCc()}>
          <div>
            <span style={labelStyle}>{t("email.cc")}</span>
            <input
              style={inputStyle}
              value={cc()}
              onInput={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
            />
          </div>
        </Show>

        {/* Subject */}
        <div>
          <span style={labelStyle}>{t("email.subject")}</span>
          <input
            style={inputStyle}
            value={subject()}
            onInput={(e) => setSubject(e.target.value)}
            placeholder={t("email.subjectPlaceholder")}
          />
        </div>

        {/* Body */}
        <div style={{ flex: "1", display: "flex", "flex-direction": "column", "min-height": "0" }}>
          <span style={labelStyle}>Message</span>
          <textarea
            style={{
              ...inputStyle,
              flex: "1",
              resize: "none",
              "font-family": "inherit",
              "min-height": "150px",
            }}
            value={body()}
            onInput={(e) => setBody(e.target.value)}
            placeholder={t("email.messagePlaceholder")}
          />
        </div>

        {/* Error */}
        <Show when={error()}>
          <div style={{
            padding: "6px 10px",
            "border-radius": "var(--radius-sm)",
            "font-size": "12px",
            background: "#ef444422",
            color: "#ef4444",
          }}>
            {error()}
          </div>
        </Show>

        {/* Actions */}
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
          <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
            {t("email.sendVia")} {selectedAccount()?.smtpHost}:{selectedAccount()?.smtpPort}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="sm" variant="ghost" onClick={props.onClose}>{t("common.cancel")}</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSend}
              disabled={isSending() || !to() || !body()}
            >
              {isSending() ? t("email.sending") : t("email.sendBtn")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Show, createSignal } from "solid-js";
import type { Email, SecurityLevel } from "../../../domain/models/Email";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";
import "../../styles/email.css";

const SEC_ICONS: Record<SecurityLevel, string> = {
  safe: "", low: "🔵", medium: "🟡", high: "🟠", critical: "🔴",
};
const SEC_LABELS: Record<SecurityLevel, string> = {
  safe: "Sur", low: "Risque faible", medium: "Risque moyen", high: "Risque eleve", critical: "Danger",
};

interface EmailDetailProps {
  email: Email | null;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onSummarize?: (id: string) => void;
  onReply?: () => void;
  onForward?: () => void;
  summary?: string | null;
  summaryLoading?: boolean;
}

export function EmailDetail(props: EmailDetailProps) {
  const { t } = useT();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatAddresses(addresses: { name: string | null; address: string }[]): string {
    return addresses.map((a) => a.name ? `${a.name} <${a.address}>` : a.address).join(", ");
  }

  return (
    <Show when={props.email}>
      {(email) => (
        <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            padding: "16px 20px",
            "border-bottom": "1px solid var(--border-color)",
            "flex-shrink": "0",
          }}>
            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "flex-start" }}>
              <h2 style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", margin: "0" }}>
                {email().subject || t("email.noSubject")}
              </h2>
              <div style={{ display: "flex", gap: "6px", "flex-shrink": "0", "margin-left": "12px" }}>
                <Button size="sm" variant="ghost" onClick={() => props.onToggleStar(email().id)}>
                  {email().isStarred ? "★" : "☆"}
                </Button>
                <Show when={props.onSummarize}>
                  <AiButton
                    size="sm"
                    variant="secondary"
                    onClick={() => props.onSummarize?.(email().id)}
                    disabled={props.summaryLoading}
                  >
                    {props.summaryLoading ? "..." : t("email.summarize")}
                  </AiButton>
                </Show>
                <Show when={props.onReply}>
                  <Button size="sm" variant="secondary" onClick={() => props.onReply?.()}>
                    {t("email.reply")}
                  </Button>
                </Show>
                <Show when={props.onForward}>
                  <Button size="sm" variant="secondary" onClick={() => props.onForward?.()}>
                    {t("email.forward")}
                  </Button>
                </Show>
                <Button size="sm" variant="secondary" onClick={() => props.onArchive(email().id)}>
                  {t("email.archiveBtn")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => props.onDelete(email().id)}>
                  {t("email.deleteBtn")}
                </Button>
              </div>
            </div>

            <div style={{ "margin-top": "10px", "font-size": "12px", color: "var(--text-muted)" }}>
              <div style={{ "margin-bottom": "4px" }}>
                <strong style={{ color: "var(--text-primary)" }}>
                  {email().fromName || email().fromAddress}
                </strong>
                {email().fromName && (
                  <span> &lt;{email().fromAddress}&gt;</span>
                )}
              </div>
              <div>{t("email.to")}: {formatAddresses(email().toAddresses)}</div>
              <Show when={email().ccAddresses.length > 0}>
                <div>{t("email.cc")}: {formatAddresses(email().ccAddresses)}</div>
              </Show>
              <div style={{ "margin-top": "4px" }}>{formatDate(email().sentAt)}</div>
            </div>

            <Show when={email().hasAttachments}>
              <div style={{
                "margin-top": "8px",
                "font-size": "11px",
                color: "var(--text-muted)",
                display: "flex",
                "align-items": "center",
                gap: "6px",
              }}>
                <span>📎</span>
                <span>{email().attachmentNames.join(", ")}</span>
              </div>
            </Show>
          </div>

          {/* Security banner */}
          <Show when={email().security && email().security!.level !== "safe"}>
            {(() => {
              const sec = () => email().security!;
              const [showWarnings, setShowWarnings] = createSignal(false);
              return (
                <div class={`email-security-banner email-security-banner--${sec().level}`}>
                  <div class="email-security-header">
                    <span class="email-security-label">
                      {SEC_ICONS[sec().level]} {SEC_LABELS[sec().level]} (score: {sec().score}/10)
                    </span>
                    <Show when={sec().warnings && sec().warnings!.length > 0}>
                      <button class="email-security-toggle" onClick={() => setShowWarnings((v) => !v)}>
                        {showWarnings() ? "Masquer" : "Details"}
                      </button>
                    </Show>
                  </div>
                  <Show when={showWarnings() && sec().warnings}>
                    <div class="email-security-warnings">
                      {sec().warnings!.map((w) => (
                        <div class="email-security-warning">⚠ {w}</div>
                      ))}
                    </div>
                  </Show>
                </div>
              );
            })()}
          </Show>

          {/* AI Summary */}
          <Show when={props.summary}>
            <div style={{
              margin: "0 20px",
              padding: "10px 14px",
              background: "rgba(99, 102, 241, 0.1)",
              "border-radius": "var(--radius-md)",
              "border-left": "3px solid #6366f1",
              "font-size": "13px",
              color: "var(--text-primary)",
              "line-height": "1.5",
              "margin-top": "12px",
            }}>
              <div style={{ "font-size": "11px", "font-weight": "600", color: "#6366f1", "margin-bottom": "4px" }}>
                {t("email.aiSummary")}
              </div>
              {props.summary}
            </div>
          </Show>

          {/* Body */}
          {(() => {
            const [forceHtml, setForceHtml] = createSignal(false);
            const isBlocked = () => {
              const level = email().security?.level;
              return (level === "high" || level === "critical") && !forceHtml();
            };
            return (
          <div style={{ flex: "1", overflow: "auto", padding: "16px 20px" }}>
            <Show when={isBlocked()}>
              <div style={{
                padding: "16px", "text-align": "center", background: "rgba(239,68,68,0.08)",
                "border-radius": "var(--radius-md)", "margin-bottom": "12px",
              }}>
                <div style={{ "font-size": "13px", "font-weight": "600", color: "#ef4444", "margin-bottom": "8px" }}>
                  Contenu HTML bloque (email a risque)
                </div>
                <button
                  onClick={() => setForceHtml(true)}
                  style={{
                    padding: "4px 12px", "font-size": "11px",
                    background: "rgba(239,68,68,0.15)", color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.3)", "border-radius": "var(--radius-sm)",
                    cursor: "pointer",
                  }}
                >Afficher quand meme (dangereux)</button>
              </div>
            </Show>
            <Show when={!isBlocked() && email().bodyHtml} fallback={
              <pre style={{
                "font-family": "inherit",
                "font-size": "13px",
                color: "var(--text-primary)",
                "white-space": "pre-wrap",
                "word-break": "break-word",
                margin: "0",
              }}>
                {email().bodyText || ""}
              </pre>
            }>
              <iframe
                sandbox="allow-same-origin"
                srcdoc={`
                  <html>
                    <head>
                      <style>
                        body {
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                          font-size: 13px;
                          color: #e0e0e0;
                          background: transparent;
                          margin: 0;
                          padding: 0;
                          line-height: 1.5;
                        }
                        a { color: #60a5fa; }
                        img { max-width: 100%; height: auto; }
                      </style>
                    </head>
                    <body>${email().bodyHtml}</body>
                  </html>
                `}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "transparent",
                }}
              />
            </Show>
          </div>
            );
          })()}
        </div>
      )}
    </Show>
  );
}

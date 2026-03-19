import { createSignal, For, Show } from "solid-js";
import type { EmailAccount } from "../../../domain/models/Email";
import type { SendEmailDTO } from "../../../domain/models/Email";
import { Button } from "../common/Button";

interface ComposeEmailProps {
  accounts: EmailAccount[];
  onSend: (input: SendEmailDTO) => Promise<unknown>;
  onClose: () => void;
}

export function ComposeEmail(props: ComposeEmailProps) {
  const [selectedAccountId, setSelectedAccountId] = createSignal(props.accounts[0]?.id ?? "");
  const [to, setTo] = createSignal("");
  const [cc, setCc] = createSignal("");
  const [showCc, setShowCc] = createSignal(false);
  const [subject, setSubject] = createSignal("");
  const [body, setBody] = createSignal("");
  const [isSending, setIsSending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const selectedAccount = () => props.accounts.find((a) => a.id === selectedAccountId());

  function parseAddresses(raw: string): string[] {
    return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }

  async function handleSend() {
    const toAddrs = parseAddresses(to());
    if (toAddrs.length === 0) {
      setError("Au moins un destinataire requis");
      return;
    }
    if (!body()) {
      setError("Le message ne peut pas etre vide");
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
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
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
          Nouveau message
        </h2>
        <Button size="sm" variant="ghost" onClick={props.onClose}>Fermer</Button>
      </div>

      <div style={{ display: "flex", "flex-direction": "column", gap: "10px", flex: "1", "min-height": "0" }}>
        {/* Account selector */}
        <div>
          <span style={labelStyle}>De</span>
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
            <span style={labelStyle}>A</span>
            <Show when={!showCc()}>
              <span
                style={{ "font-size": "11px", color: "var(--accent)", cursor: "pointer" }}
                onClick={() => setShowCc(true)}
              >Cc</span>
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
            <span style={labelStyle}>Cc</span>
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
          <span style={labelStyle}>Sujet</span>
          <input
            style={inputStyle}
            value={subject()}
            onInput={(e) => setSubject(e.target.value)}
            placeholder="Sujet du message"
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
            placeholder="Votre message..."
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
            Envoi via {selectedAccount()?.smtpHost}:{selectedAccount()?.smtpPort}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="sm" variant="ghost" onClick={props.onClose}>Annuler</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSend}
              disabled={isSending() || !to() || !body()}
            >
              {isSending() ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

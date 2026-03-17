import { For, Show, createEffect } from "solid-js";
import type { Email } from "../../../domain/models/Email";

interface EmailListProps {
  emails: Email[];
  selectedId: string | null;
  focusedIndex: number;
  onSelect: (email: Email) => void;
  onToggleStar: (emailId: string) => void;
}

export function EmailList(props: EmailListProps) {
  const itemRefs = new Map<number, HTMLDivElement>();

  createEffect(() => {
    const idx = props.focusedIndex;
    const el = itemRefs.get(idx);
    if (el) el.scrollIntoView({ block: "nearest" });
  });

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  function senderDisplay(email: Email): string {
    return email.fromName || email.fromAddress.split("@")[0];
  }

  return (
    <div style={{ height: "100%", "overflow-y": "auto" }}>
      <Show when={props.emails.length === 0}>
        <div style={{ padding: "40px 20px", "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
          Aucun email
        </div>
      </Show>
      <For each={props.emails}>
        {(email, idx) => (
          <div
            ref={(el) => itemRefs.set(idx(), el)}
            onClick={() => props.onSelect(email)}
            style={{
              display: "flex",
              gap: "10px",
              padding: "10px 14px",
              cursor: "pointer",
              "border-bottom": "1px solid var(--border-color)",
              background: props.selectedId === email.id
                ? "var(--bg-elevated)"
                : props.focusedIndex === idx()
                  ? "var(--bg-surface)"
                  : "transparent",
              outline: props.focusedIndex === idx() ? "1px solid var(--accent-primary)" : "none",
              "outline-offset": "-1px",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              if (props.selectedId !== email.id && props.focusedIndex !== idx()) e.currentTarget.style.background = "var(--bg-surface)";
            }}
            onMouseLeave={(e) => {
              if (props.selectedId !== email.id && props.focusedIndex !== idx()) e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Unread indicator */}
            <div style={{
              width: "6px",
              height: "6px",
              "border-radius": "50%",
              background: email.isRead ? "transparent" : "#3b82f6",
              "margin-top": "6px",
              "flex-shrink": "0",
            }} />

            {/* Content */}
            <div style={{ flex: "1", "min-width": "0" }}>
              <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "2px" }}>
                <span style={{
                  "font-size": "13px",
                  "font-weight": email.isRead ? "400" : "600",
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                }}>
                  {senderDisplay(email)}
                </span>
                <span style={{ "font-size": "11px", color: "var(--text-muted)", "flex-shrink": "0", "margin-left": "8px" }}>
                  {formatDate(email.sentAt)}
                </span>
              </div>
              <div style={{
                "font-size": "12px",
                "font-weight": email.isRead ? "400" : "500",
                color: "var(--text-primary)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
                "margin-bottom": "2px",
              }}>
                {email.subject || "(sans objet)"}
              </div>
              <div style={{
                "font-size": "11px",
                color: "var(--text-muted)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}>
                {email.bodyText?.slice(0, 120) || ""}
              </div>
            </div>

            {/* Star */}
            <button
              onClick={(e) => { e.stopPropagation(); props.onToggleStar(email.id); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                "font-size": "14px",
                padding: "0",
                color: email.isStarred ? "#f59e0b" : "var(--text-muted)",
                "flex-shrink": "0",
                "margin-top": "2px",
              }}
            >
              {email.isStarred ? "★" : "☆"}
            </button>
          </div>
        )}
      </For>
    </div>
  );
}

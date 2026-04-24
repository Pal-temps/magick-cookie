import { For, Show, createEffect, createSignal, createMemo } from "solid-js";
import type { Email, EmailAccount, SecurityLevel } from "../../../domain/models/Email";
import { useT } from "../../../i18n/context";
import { requestConfirm } from "../common/ConfirmDialog";

const SEC_COLORS: Record<SecurityLevel, string> = {
  safe: "#22c55e", low: "#3b82f6", medium: "#eab308", high: "#f97316", critical: "#ef4444",
};
const SEC_LABELS: Record<SecurityLevel, string> = {
  safe: "Sur", low: "Risque faible", medium: "Risque moyen", high: "Risque eleve", critical: "Danger",
};

type SortMode = "date" | "sender";

const [sortMode, setSortMode] = createSignal<SortMode>(
  (localStorage.getItem("email-sort-mode") as SortMode) || "date"
);

function switchSortMode(mode: SortMode) {
  setSortMode(mode);
  localStorage.setItem("email-sort-mode", mode);
}

const [deleteAlerts, setDeleteAlerts] = createSignal(
  localStorage.getItem("email-delete-alerts") !== "false"
);

function toggleDeleteAlerts() {
  const next = !deleteAlerts();
  setDeleteAlerts(next);
  localStorage.setItem("email-delete-alerts", String(next));
}

interface EmailListProps {
  emails: Email[];
  accounts: EmailAccount[];
  selectedId: string | null;
  focusedIndex: number;
  activeAccountId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  getAccountColor: (accountId: string) => string;
  onSelect: (email: Email) => void;
  onToggleStar: (emailId: string) => void;
  onLoadMore: () => void;
  onBulkDelete: (emailIds: string[]) => void;
}

export function EmailList(props: EmailListProps) {
  const { t } = useT();
  const itemRefs = new Map<number, HTMLDivElement>();

  createEffect(() => {
    const idx = props.focusedIndex;
    const el = itemRefs.get(idx);
    if (el) el.scrollIntoView({ block: "nearest" });
  });

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  function senderDisplay(email: Email): string {
    return email.fromName || email.fromAddress.split("@")[0];
  }

  function senderKey(email: Email): string {
    return email.fromAddress.toLowerCase();
  }

  const showAccountDot = () => props.activeAccountId === null;

  // Collapsed/expanded state for sender groups (default: all collapsed)
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set());

  function toggleGroup(address: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  }

  // Group emails by sender when in sender mode
  const groupedBySender = createMemo(() => {
    if (sortMode() !== "sender") return null;
    const groups = new Map<string, { sender: string; address: string; emails: Email[]; latestDate: string; unreadCount: number }>();
    for (const email of props.emails) {
      const key = senderKey(email);
      const existing = groups.get(key);
      if (existing) {
        existing.emails.push(email);
        if (email.sentAt > existing.latestDate) existing.latestDate = email.sentAt;
        if (!email.isRead) existing.unreadCount++;
      } else {
        groups.set(key, {
          sender: senderDisplay(email),
          address: email.fromAddress,
          emails: [email],
          latestDate: email.sentAt,
          unreadCount: email.isRead ? 0 : 1,
        });
      }
    }
    // Sort groups by most recent email
    return [...groups.values()].sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  });

  // Flat index for keyboard navigation in sender mode
  let flatIdx = 0;

  return (
    <div class="email-list">
      {/* Sort toggle + delete alerts */}
      <div class="email-sort-bar">
        <button
          class={`email-sort-btn ${sortMode() === "date" ? "email-sort-btn--active" : ""}`}
          onClick={() => switchSortMode("date")}
        >Chronologique</button>
        <button
          class={`email-sort-btn ${sortMode() === "sender" ? "email-sort-btn--active" : ""}`}
          onClick={() => switchSortMode("sender")}
        >Par expediteur</button>
        <div class="email-sort-bar__spacer" />
        <button
          class="email-sort-btn"
          onClick={() => props.onLoadMore()}
          disabled={props.isLoadingMore || !props.hasMore}
          title={props.hasMore ? "Charger plus d'emails" : "Tous les emails sont charges"}
        >{props.isLoadingMore ? "..." : props.hasMore ? `+200` : `${props.emails.length} ✓`}</button>
        <button
          class={`email-sort-btn ${deleteAlerts() ? "" : "email-sort-btn--warn"}`}
          onClick={toggleDeleteAlerts}
          title={deleteAlerts() ? "Alertes de suppression activees" : "Alertes de suppression desactivees"}
        >{deleteAlerts() ? "🔔" : "🔕"}</button>
      </div>

      <Show when={props.emails.length === 0}>
        <div class="email-list__empty">{t("email.noEmail")}</div>
      </Show>

      {/* Sender-grouped mode */}
      <Show when={sortMode() === "sender" && groupedBySender()}>
        {(() => { flatIdx = 0; return null; })()}
        <For each={groupedBySender()!}>
          {(group) => {
            const isOpen = () => expandedGroups().has(group.address);
            return (
              <div>
                <div class="email-group-header" onClick={() => toggleGroup(group.address)} style={{ cursor: "pointer" }}>
                  <svg
                    class={`email-group-header__chevron ${isOpen() ? "email-group-header__chevron--open" : ""}`}
                    width="10" height="10" viewBox="0 0 12 12" fill="none"
                  >
                    <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span class="email-group-header__name">{group.sender}</span>
                  <div class="email-group-header__badges">
                    <Show when={group.unreadCount > 0}>
                      <span class="email-group-header__unread">{group.unreadCount}</span>
                    </Show>
                    <span class="email-group-header__count">{group.emails.length}</span>
                    <button
                      class="email-group-header__delete"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!deleteAlerts() || await requestConfirm(`Supprimer ${group.emails.length} email(s) de ${group.sender} ?`)) {
                          props.onBulkDelete(group.emails.map((em) => em.id));
                        }
                      }}
                      title={`Supprimer ${group.emails.length} email(s) de ${group.sender}`}
                    >&#10005;</button>
                  </div>
                </div>
                <Show when={isOpen()}>
                  <For each={group.emails}>
                    {(email) => {
                      const myIdx = flatIdx++;
                      const selected = () => props.selectedId === email.id;
                      const focused = () => props.focusedIndex === myIdx;
                      return (
                        <div
                          ref={(el) => itemRefs.set(myIdx, el)}
                          class={`email-item ${selected() ? "email-item--selected" : ""} ${focused() ? "email-item--focused" : ""}`}
                          onClick={() => props.onSelect(email)}
                        >
                          <div class="email-item__dots">
                            <Show when={showAccountDot()}>
                              <div class="email-item__account-dot" style={{ background: props.getAccountColor(email.accountId) }} />
                            </Show>
                            <div class="email-item__unread-dot" style={{ background: email.isRead ? "transparent" : "#3b82f6" }} />
                            <Show when={email.security && email.security.level !== "safe"}>
                              <div class="email-security-dot" style={{ background: SEC_COLORS[email.security!.level] }} title={SEC_LABELS[email.security!.level]} />
                            </Show>
                          </div>
                          <div class="email-item__content">
                            <div class="email-item__header">
                              <span class={`email-item__subject ${!email.isRead ? "email-item__subject--unread" : ""}`}>
                                {email.subject || t("email.noSubject")}
                              </span>
                              <span class="email-item__date">{formatDate(email.sentAt)}</span>
                            </div>
                            <div class="email-item__preview">{email.bodyText?.slice(0, 100) || ""}</div>
                          </div>
                          <button
                            class={`email-item__star ${email.isStarred ? "email-item__star--active" : ""}`}
                            onClick={(e) => { e.stopPropagation(); props.onToggleStar(email.id); }}
                          >{email.isStarred ? "★" : "☆"}</button>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>

      {/* Chronological mode */}
      <Show when={sortMode() === "date"}>
      <For each={props.emails}>
        {(email, idx) => {
          const selected = () => props.selectedId === email.id;
          const focused = () => props.focusedIndex === idx();

          return (
            <div
              ref={(el) => itemRefs.set(idx(), el)}
              class={`email-item ${selected() ? "email-item--selected" : ""} ${focused() ? "email-item--focused" : ""}`}
              onClick={() => props.onSelect(email)}
            >
              <div class="email-item__dots">
                <Show when={showAccountDot()}>
                  <div
                    class="email-item__account-dot"
                    style={{ background: props.getAccountColor(email.accountId) }}
                  />
                </Show>
                <div
                  class="email-item__unread-dot"
                  style={{ background: email.isRead ? "transparent" : "#3b82f6" }}
                />
                <Show when={email.security && email.security.level !== "safe"}>
                  <div class="email-security-dot" style={{ background: SEC_COLORS[email.security!.level] }} title={SEC_LABELS[email.security!.level]} />
                </Show>
              </div>

              <div class="email-item__content">
                <div class="email-item__header">
                  <span class={`email-item__sender ${!email.isRead ? "email-item__sender--unread" : ""}`}>
                    {senderDisplay(email)}
                  </span>
                  <span class="email-item__date">{formatDate(email.sentAt)}</span>
                </div>
                <div class={`email-item__subject ${!email.isRead ? "email-item__subject--unread" : ""}`}>
                  {email.subject || t("email.noSubject")}
                </div>
                <div class="email-item__preview">
                  {email.bodyText?.slice(0, 120) || ""}
                </div>
              </div>

              <button
                class={`email-item__star ${email.isStarred ? "email-item__star--active" : ""}`}
                onClick={(e) => { e.stopPropagation(); props.onToggleStar(email.id); }}
              >
                {email.isStarred ? "★" : "☆"}
              </button>
            </div>
          );
        }}
      </For>
      </Show>

      {/* Load more / status */}
      <Show when={props.emails.length > 0}>
        <Show when={props.hasMore} fallback={
          <div style={{ padding: "14px", "text-align": "center", "font-size": "11px", color: "var(--text-muted)" }}>
            {props.emails.length} emails charges
          </div>
        }>
          <button
            class="email-item"
            style={{ "justify-content": "center", padding: "14px", color: "var(--accent-primary)", "font-size": "12px", "font-weight": "500" }}
            onClick={() => props.onLoadMore()}
            disabled={props.isLoadingMore}
          >
            {props.isLoadingMore ? "Chargement..." : `Charger plus d'emails (${props.emails.length} charges)`}
          </button>
        </Show>
      </Show>
    </div>
  );
}

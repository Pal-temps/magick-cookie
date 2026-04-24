import { For, Show, createSignal } from "solid-js";
import type { EmailAccount } from "../../../domain/models/Email";
import { useT } from "../../../i18n/context";

interface AccountSidebarProps {
  accounts: EmailAccount[];
  activeAccountId: string | null;
  activeFolder: string;
  unreadPerAccount: Record<string, number>;
  totalUnread: number;
  getAccountColor: (accountId: string) => string;
  onSelectAccount: (accountId: string | null, folder?: string) => void;
  onSelectFolder: (accountId: string, folder: string) => void;
}

const FOLDERS = [
  { key: "INBOX", icon: "📥" },
  { key: "Sent", icon: "📤" },
  { key: "Archive", icon: "📦" },
] as const;

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem("email-sidebar-collapsed");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsed(set: Set<string>) {
  localStorage.setItem("email-sidebar-collapsed", JSON.stringify([...set]));
}

export function AccountSidebar(props: AccountSidebarProps) {
  const { t } = useT();
  const [collapsed, setCollapsed] = createSignal(loadCollapsed());

  function toggleCollapse(accountId: string) {
    const next = new Set(collapsed());
    if (next.has(accountId)) next.delete(accountId);
    else next.add(accountId);
    setCollapsed(next);
    saveCollapsed(next);
  }

  function isActive(accountId: string | null, folder?: string): boolean {
    if (accountId === null) return props.activeAccountId === null;
    if (folder) return props.activeAccountId === accountId && props.activeFolder === folder;
    return props.activeAccountId === accountId;
  }

  function folderLabel(key: string): string {
    if (key === "INBOX") return t("email.inbox");
    if (key === "Sent") return t("email.sent");
    return t("email.archive");
  }

  return (
    <>
      <div class="email-sidebar__header">Comptes</div>
      <div class="email-sidebar__tree">
        {/* All accounts */}
        <button
          class={`email-sidebar__all ${isActive(null) ? "email-sidebar__all--active" : ""}`}
          onClick={() => props.onSelectAccount(null)}
        >
          <span>📬</span>
          <span style={{ flex: "1" }}>{t("email.all")}</span>
          <Show when={props.totalUnread > 0}>
            <span class="email-account__badge email-account__badge--unread">
              {props.totalUnread}
            </span>
          </Show>
        </button>

        <div class="email-sidebar__divider" />

        {/* Account tree */}
        <For each={props.accounts}>
          {(account) => {
            const isCollapsed = () => collapsed().has(account.id);
            const unread = () => props.unreadPerAccount[account.id] ?? 0;
            const color = () => props.getAccountColor(account.id);

            return (
              <div>
                {/* Account header */}
                <button
                  class={`email-account__header ${isActive(account.id) ? "email-account__header--active" : ""}`}
                  onClick={() => {
                    if (isCollapsed()) toggleCollapse(account.id);
                    props.onSelectAccount(account.id, "INBOX");
                  }}
                >
                  <svg
                    class={`email-account__chevron ${!isCollapsed() ? "email-account__chevron--open" : ""}`}
                    width="10" height="10" viewBox="0 0 12 12" fill="none"
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(account.id); }}
                    style={{ cursor: "pointer" }}
                  >
                    <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <div class="email-account__dot" style={{ background: color() }} />
                  <span class="email-account__name">{account.label}</span>
                  <Show when={unread() > 0}>
                    <span class="email-account__badge email-account__badge--unread">
                      {unread()}
                    </span>
                  </Show>
                </button>

                {/* Folders */}
                <Show when={!isCollapsed()}>
                  <div class="email-account__folders">
                    <For each={FOLDERS}>
                      {(folder) => (
                        <button
                          class={`email-folder__row ${isActive(account.id, folder.key) ? "email-folder__row--active" : ""}`}
                          onClick={() => props.onSelectFolder(account.id, folder.key)}
                        >
                          <span class="email-folder__name">{folderLabel(folder.key)}</span>
                          <Show when={folder.key === "INBOX" && unread() > 0}>
                            <span class="email-folder__count">{unread()}</span>
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}

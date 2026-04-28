import { onMount, onCleanup, createEffect, Show, createSignal } from "solid-js";
import { useEmailStore } from "../../../application/stores/emailStore";
import { useT } from "../../../i18n/context";
import { EmailList } from "./EmailList";
import { EmailDetail } from "./EmailDetail";
import { EmailDigest } from "./EmailDigest";
import { AccountSettings } from "./AccountSettings";
import { ComposeEmail } from "./ComposeEmail";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import { SettingsGear } from "../common/SettingsGear";
import { useViewStore } from "../../../application/stores/viewStore";
import type { SendEmailDTO } from "../../../domain/models/Email";
import "../../styles/email.css";

export function EmailView() {
  const store = useEmailStore();
  const { t } = useT();
  const { openSettings } = useViewStore();
  const [showSettings, setShowSettings] = createSignal(false);
  const [showDigest, setShowDigest] = createSignal(false);
  const [showCompose, setShowCompose] = createSignal(false);
  const [composePrefill, setComposePrefill] = createSignal<Partial<SendEmailDTO> | null>(null);

  function openCompose(prefill?: Partial<SendEmailDTO>) {
    setComposePrefill(prefill ?? null);
    setShowCompose(true);
  }

  function handleReply() {
    const email = store.selectedEmail();
    if (!email) return;
    openCompose({
      accountId: email.accountId,
      to: [email.fromAddress],
      subject: `Re: ${email.subject?.replace(/^Re:\s*/i, "") ?? ""}`,
      bodyText: `\n\n--- ${email.fromName || email.fromAddress} a ecrit ---\n${email.bodyText ?? ""}`,
    });
  }

  function handleForward() {
    const email = store.selectedEmail();
    if (!email) return;
    const header = [
      `---------- ${t("email.forwarded")} ----------`,
      `${t("email.from")}: ${email.fromName || email.fromAddress}`,
      `${t("email.date")}: ${new Date(email.sentAt).toLocaleDateString("fr-FR")}`,
      `${t("email.subject")}: ${email.subject ?? ""}`,
      `${t("email.to")}: ${email.toAddresses.map((a: any) => a.name ? `${a.name} <${a.address}>` : a.address).join(", ")}`,
      ``,
    ].join("\n");
    openCompose({
      accountId: email.accountId,
      subject: `Fwd: ${email.subject?.replace(/^Fwd:\s*/i, "") ?? ""}`,
      bodyText: `\n\n${header}\n${email.bodyText ?? ""}`,
    });
  }

  onMount(async () => {
    await store.fetchAccounts();
    await store.fetchEmails();
    await store.fetchUnreadCount();
    await store.fetchUnreadPerAccount();
  });

  createEffect(() => {
    store.activeAccountId();
    store.activeFolder();
    store.fetchEmails();
  });

  // Keyboard shortcuts
  let gPressed = false;
  let gTimer: ReturnType<typeof setTimeout> | null = null;

  function handleKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (showSettings() || showCompose()) return;

    const key = e.key.toLowerCase();

    if (gPressed) {
      gPressed = false;
      if (gTimer) clearTimeout(gTimer);
      if (key === "i") { store.setActiveFolder("INBOX"); e.preventDefault(); return; }
      if (key === "s") { store.setActiveFolder("Sent"); e.preventDefault(); return; }
    }

    if (key === "g") {
      gPressed = true;
      gTimer = setTimeout(() => { gPressed = false; }, 500);
      return;
    }

    switch (key) {
      case "c": openCompose(); e.preventDefault(); break;
      case "j": store.moveFocus(1); e.preventDefault(); break;
      case "k": store.moveFocus(-1); e.preventDefault(); break;
      case "enter": store.selectFocused(); e.preventDefault(); break;
      case "escape": store.setSelectedEmail(null); store.setEmailSummary(null); e.preventDefault(); break;
      case "e": {
        const sel = store.selectedEmail();
        if (sel) { store.archiveEmail(sel.id); e.preventDefault(); }
        break;
      }
      case "s": {
        const sel = store.selectedEmail();
        if (sel) { store.toggleStar(sel.id); e.preventDefault(); }
        break;
      }
      case "r": {
        const sel = store.selectedEmail();
        if (sel) { store.toggleReadStatus(sel.id); e.preventDefault(); }
        break;
      }
      case "delete":
      case "backspace": {
        const sel = store.selectedEmail();
        if (sel) { store.deleteEmail(sel.id); e.preventDefault(); }
        break;
      }
    }
  }

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
    store.clearBulkData();
  });

  return (
    <Show when={!showCompose()} fallback={
      <ComposeEmail
        accounts={store.accounts()}
        onSend={store.sendEmail}
        onClose={() => setShowCompose(false)}
        prefill={composePrefill() ?? undefined}
      />
    }>
    <Show when={!showDigest()} fallback={
      <EmailDigest onClose={() => setShowDigest(false)} />
    }>
    <Show when={!showSettings()} fallback={
      <AccountSettings
        accounts={store.accounts()}
        onAdd={store.addAccount}
        onRemove={store.removeAccount}
        onTestConnection={store.testConnection}
        onClose={() => setShowSettings(false)}
      />
    }>
      <div class="email">
        {/* Toolbar */}
        <div class="email-toolbar">
          <div class="email-toolbar__left">
            <Button size="sm" variant="primary" onClick={() => openCompose()}>
              {t("email.newEmail")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => store.syncEmails(false)} disabled={store.isSyncing()} title={t("email.syncTooltip")}>
              {store.isSyncing() ? t("email.syncing") : t("email.sync")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => store.syncEmails(true)} disabled={store.isSyncing()} title={t("email.syncAllTooltip")}>
              {store.isSyncing() ? "..." : t("email.syncAll")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowDigest(true)} title={t("email.digestTooltip")}>
              {t("email.digest")}
            </Button>
          </div>
          <div class="email-toolbar__right">
            <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
              {t("email.accounts")}
            </Button>
            <SettingsGear tab="email-rules" title="Paramètres email" />
          </div>
        </div>

        {/* Progress bar (non-blocking) */}
        <Show when={store.isSyncing() || store.isDeleting()}>
          <div class="email-progress-bar" />
        </Show>

        {/* Body */}
        <div class="email-body">

          <div class="email-list-pane" style={{ flex: "1", width: "auto" }}>
            <Show when={!store.isLoading()} fallback={
              <div class="email-list__loading">
                <CookieLoader size={32} message={t("email.loading")} />
              </div>
            }>
              <Show
                when={store.accounts().length > 0}
                fallback={
                  <div class="email-list__empty">
                    <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", gap: "8px" }}>
                      <span>Aucun compte email configuré</span>
                      <button class="settings-gear-cta" onClick={() => openSettings("email-rules")}>
                        Configurer →
                      </button>
                    </div>
                  </div>
                }
              >
                <EmailList
                  emails={store.emails()}
                  accounts={store.accounts()}
                  selectedId={store.selectedEmail()?.id ?? null}
                  focusedIndex={store.focusedIndex()}
                  activeAccountId={store.activeAccountId()}
                  hasMore={store.hasMore()}
                  isLoadingMore={store.isLoadingMore()}
                  getAccountColor={store.getAccountColor}
                  onSelect={store.selectEmail}
                  onToggleStar={store.toggleStar}
                  onLoadMore={store.loadMoreEmails}
                  onBulkDelete={store.bulkDeleteEmails}
                />
              </Show>
            </Show>
          </div>

          {/* Email detail drawer */}
          <Show when={store.selectedEmail()}>
            <div class="email-drawer-backdrop" onClick={() => { store.setSelectedEmail(null); store.setEmailSummary(null); }} />
            <div class="email-drawer">
              <div class="email-drawer__header">
                <button class="email-drawer__back" onClick={() => { store.setSelectedEmail(null); store.setEmailSummary(null); }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Retour
                </button>
              </div>
              <EmailDetail
                email={store.selectedEmail()}
                onArchive={store.archiveEmail}
                onDelete={store.deleteEmail}
                onToggleStar={store.toggleStar}
                onSummarize={store.summarizeEmail}
                onReply={handleReply}
                onForward={handleForward}
                summary={store.emailSummary()}
                summaryLoading={store.summaryLoading()}
              />
            </div>
          </Show>
        </div>

      </div>
    </Show>
    </Show>
    </Show>
  );
}

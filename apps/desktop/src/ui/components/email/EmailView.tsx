import { onMount, onCleanup, createEffect, Show, createSignal } from "solid-js";
import { useEmailStore } from "../../../application/stores/emailStore";
import { EmailList } from "./EmailList";
import { EmailDetail } from "./EmailDetail";
import { EmailDigest } from "./EmailDigest";
import { AccountSettings } from "./AccountSettings";
import { ComposeEmail } from "./ComposeEmail";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import type { SendEmailDTO } from "../../../domain/models/Email";

export function EmailView() {
  const store = useEmailStore();
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
      `---------- Message transfere ----------`,
      `De: ${email.fromName || email.fromAddress}`,
      `Date: ${new Date(email.sentAt).toLocaleDateString("fr-FR")}`,
      `Objet: ${email.subject ?? ""}`,
      `A: ${email.toAddresses.map((a) => a.name ? `${a.name} <${a.address}>` : a.address).join(", ")}`,
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
  });

  createEffect(() => {
    // Refetch when account or folder changes
    store.activeAccountId();
    store.activeFolder();
    store.fetchEmails();
  });

  // Keyboard shortcuts
  let gPressed = false;
  let gTimer: ReturnType<typeof setTimeout> | null = null;

  function handleKeyDown(e: KeyboardEvent) {
    // Don't handle when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (showSettings() || showCompose()) return;

    const key = e.key.toLowerCase();

    // g+i / g+s chord
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
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  const folders = ["INBOX", "Sent", "Archive"] as const;

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
      <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden", position: "relative" }}>
        {/* Toolbar */}
        <div style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "8px 14px",
          "border-bottom": "1px solid var(--border-color)",
          "flex-shrink": "0",
        }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            {/* Account tabs */}
            <Button
              size="sm"
              variant={store.activeAccountId() === null ? "primary" : "ghost"}
              onClick={() => store.setActiveAccountId(null)}
            >
              Tous
              <Show when={store.unreadCount() > 0}>
                <span style={{
                  "margin-left": "4px",
                  "font-size": "10px",
                  background: "#3b82f6",
                  color: "white",
                  padding: "1px 5px",
                  "border-radius": "8px",
                }}>
                  {store.unreadCount()}
                </span>
              </Show>
            </Button>
            {store.accounts().map((acc) => (
              <Button
                size="sm"
                variant={store.activeAccountId() === acc.id ? "primary" : "ghost"}
                onClick={() => store.setActiveAccountId(acc.id)}
              >
                {acc.label}
              </Button>
            ))}
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <Button size="sm" variant="primary" onClick={() => openCompose()}>
              Nouveau
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowDigest(true)}>
              Digest
            </Button>
            <Button size="sm" variant="secondary" onClick={store.syncEmails} disabled={store.isSyncing()}>
              Sync
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
              Comptes
            </Button>
          </div>
        </div>

        {/* Overlay loader for sync / delete */}
        <Show when={store.isSyncing() || store.isDeleting()}>
          <div style={{
            position: "absolute",
            inset: "0",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            background: "rgba(0,0,0,0.3)",
            "z-index": "10",
            "pointer-events": "all",
          }}>
            <CookieLoader
              size={48}
              message={store.isSyncing() ? "Synchronisation..." : "Suppression..."}
            />
          </div>
        </Show>

        {/* Main area */}
        <div style={{ flex: "1", display: "flex", overflow: "hidden" }}>
          {/* Folder sidebar */}
          <div style={{
            width: "100px",
            "flex-shrink": "0",
            "border-right": "1px solid var(--border-color)",
            padding: "8px 0",
          }}>
            {folders.map((folder) => (
              <button
                onClick={() => store.setActiveFolder(folder)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "6px 14px",
                  border: "none",
                  background: store.activeFolder() === folder ? "var(--bg-elevated)" : "transparent",
                  color: store.activeFolder() === folder ? "var(--text-primary)" : "var(--text-muted)",
                  "font-size": "12px",
                  "text-align": "left",
                  cursor: "pointer",
                  "font-weight": store.activeFolder() === folder ? "500" : "400",
                }}
              >
                {folder === "INBOX" ? "Inbox" : folder === "Sent" ? "Envoyes" : "Archive"}
              </button>
            ))}
          </div>

          {/* Email list */}
          <div style={{
            width: "320px",
            "flex-shrink": "0",
            "border-right": "1px solid var(--border-color)",
            overflow: "hidden",
          }}>
            <Show when={!store.isLoading()} fallback={
              <div style={{ padding: "20px", display: "flex", "justify-content": "center" }}>
                <CookieLoader size={32} message="Chargement..." />
              </div>
            }>
              <EmailList
                emails={store.emails()}
                selectedId={store.selectedEmail()?.id ?? null}
                focusedIndex={store.focusedIndex()}
                onSelect={store.selectEmail}
                onToggleStar={store.toggleStar}
              />
            </Show>
          </div>

          {/* Email detail */}
          <div style={{ flex: "1", overflow: "hidden" }}>
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
        </div>
      </div>
    </Show>
    </Show>
    </Show>
  );
}

import { createSignal } from "solid-js";
import type { Email, EmailAccount, CreateEmailAccountDTO, SendEmailDTO } from "../../domain/models/Email";
import { api } from "../../infrastructure/api/apiClient";

const CACHE_KEY = "magick-cookie-email-cache";

interface EmailCache {
  emails: Omit<Email, "bodyText" | "bodyHtml">[];
  unreadCount: number;
  accountId: string | null;
  folder: string;
  timestamp: number;
}

function loadEmailCache(accountId: string | null, folder: string): EmailCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as EmailCache;
    if (cache.accountId !== accountId || cache.folder !== folder) return null;
    return cache;
  } catch {
    return null;
  }
}

function saveEmailCache(emailList: Email[], unread: number, accountId: string | null, folder: string): void {
  try {
    const cache: EmailCache = {
      emails: emailList.map(({ bodyText, bodyHtml, ...rest }) => rest),
      unreadCount: unread,
      accountId,
      folder,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

const [emails, setEmails] = createSignal<Email[]>([]);
const [accounts, setAccounts] = createSignal<EmailAccount[]>([]);
const [selectedEmail, setSelectedEmail] = createSignal<Email | null>(null);
const [activeAccountId, setActiveAccountId] = createSignal<string | null>(null); // null = tous
const [activeFolder, setActiveFolder] = createSignal("INBOX");
const [isLoading, setIsLoading] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);
const [isDeleting, setIsDeleting] = createSignal(false);
const [unreadCount, setUnreadCount] = createSignal(0);
const [focusedIndex, setFocusedIndex] = createSignal(-1);
const [emailSummary, setEmailSummary] = createSignal<string | null>(null);
const [summaryLoading, setSummaryLoading] = createSignal(false);
const [isStale, setIsStale] = createSignal(false);
const [hasMore, setHasMore] = createSignal(true);
const [isLoadingMore, setIsLoadingMore] = createSignal(false);
const PAGE_SIZE = 200;

export interface EmailDigestBySender {
  sender: string;
  senderAddress: string;
  count: number;
  subjects: string[];
  emailIds: string[];
}

export interface EmailDigest {
  totalUnread: number;
  period: { from: string; to: string };
  bySender: EmailDigestBySender[];
  summary: string;
}

const [unreadPerAccount, setUnreadPerAccount] = createSignal<Record<string, number>>({});

// Monotonic token for fetchEmails — drops stale responses when account/folder changes mid-flight.
let fetchEmailsToken = 0;

const ACCOUNT_COLORS = [
  "var(--cal-blue)", "var(--cal-green)", "var(--cal-orange)",
  "var(--cal-pink)", "var(--cal-red)", "var(--cal-purple)",
  "#00cec9", "#e17055", "#a29bfe", "#ffeaa7",
];

function getAccountColor(accountId: string): string {
  const idx = accounts().findIndex((a) => a.id === accountId);
  return ACCOUNT_COLORS[(idx >= 0 ? idx : 0) % ACCOUNT_COLORS.length];
}

const [digest, setDigest] = createSignal<EmailDigest | null>(null);
const [digestLoading, setDigestLoading] = createSignal(false);
const [digestSummary, setDigestSummary] = createSignal<string>("");
const [digestSummaryLoading, setDigestSummaryLoading] = createSignal(false);

export function useEmailStore() {
  async function fetchAccounts() {
    const data = await api.get<EmailAccount[]>("/email-accounts");
    setAccounts(data);
  }

  async function fetchEmails() {
    const accountId = activeAccountId();
    const folder = activeFolder();
    const token = ++fetchEmailsToken;

    // 1. Load from cache first for instant display
    const cache = loadEmailCache(accountId, folder);
    if (cache) {
      setEmails(cache.emails as Email[]);
      setUnreadCount(cache.unreadCount);
      setIsStale(true);
    }

    // 2. Fetch fresh data from API (reset to first page)
    setIsLoading(!cache);
    setHasMore(true);
    try {
      const params = new URLSearchParams();
      if (accountId) params.set("accountId", accountId);
      params.set("folder", folder);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", "0");

      const qs = params.toString();
      const data = await api.get<Email[]>(`/emails?${qs}`);
      // Drop stale response: a newer fetch has been started while this one was in flight.
      if (token !== fetchEmailsToken) return;
      setEmails(data);
      setHasMore(data.length >= PAGE_SIZE);
      setIsStale(false);

      // Update cache with fresh data
      const unread = await api.get<{ count: number }>("/emails/unread-count");
      if (token !== fetchEmailsToken) return;
      setUnreadCount(unread.count);
      saveEmailCache(data, unread.count, accountId, folder);
    } catch (err) {
      // Offline: cache data remains displayed
      if (!cache) {
        console.error("[email] Failed to fetch emails and no cache available:", err);
      }
    } finally {
      if (token === fetchEmailsToken) setIsLoading(false);
    }
  }

  async function loadMoreEmails() {
    if (isLoadingMore() || !hasMore()) return;
    setIsLoadingMore(true);
    try {
      const accountId = activeAccountId();
      const folder = activeFolder();
      const offset = emails().length;

      const params = new URLSearchParams();
      if (accountId) params.set("accountId", accountId);
      params.set("folder", folder);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const data = await api.get<Email[]>(`/emails?${params}`);
      if (data.length > 0) {
        setEmails((prev) => [...prev, ...data]);
        persistCache();
      }
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      console.error("[email] Failed to load more emails:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function fetchUnreadCount() {
    const data = await api.get<{ count: number }>("/emails/unread-count");
    setUnreadCount(data.count);
  }

  async function fetchUnreadPerAccount() {
    const counts: Record<string, number> = {};
    for (const acc of accounts()) {
      try {
        const data = await api.get<{ count: number }>(`/emails/unread-count?accountId=${acc.id}`);
        counts[acc.id] = data.count;
      } catch {
        counts[acc.id] = 0;
      }
    }
    setUnreadPerAccount(counts);
  }

  function persistCache() {
    saveEmailCache(emails(), unreadCount(), activeAccountId(), activeFolder());
  }

  async function selectEmail(email: Email) {
    // Show immediately with light scan data
    setSelectedEmail(email);
    setEmailSummary(null);

    // Mark as read if unread
    if (!email.isRead) {
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e)));
      setSelectedEmail({ ...email, isRead: true });
      setUnreadCount((c) => Math.max(0, c - 1));
      persistCache();
      try {
        await api.patch<Email>(`/emails/${email.id}`, { isRead: true });
      } catch (err) {
        console.error("[email] Failed to mark as read:", err);
      }
    }

    // Fetch full detail (body + full security scan with warnings)
    try {
      const full = await api.get<Email>(`/emails/${email.id}`);
      if (selectedEmail()?.id === email.id) {
        setSelectedEmail({ ...full, isRead: true });
      }
    } catch {
      // Offline — keep the list version
    }
  }

  async function toggleStar(emailId: string) {
    const email = emails().find((e) => e.id === emailId);
    if (!email) return;
    // Optimistic update
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, isStarred: !e.isStarred } : e)));
    if (selectedEmail()?.id === emailId) {
      setSelectedEmail((prev) => prev ? { ...prev, isStarred: !prev.isStarred } : null);
    }
    persistCache();
    try {
      await api.patch<Email>(`/emails/${emailId}`, { isStarred: !email.isStarred });
    } catch (err) {
      // Revert on failure
      setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, isStarred: email.isStarred } : e)));
      if (selectedEmail()?.id === emailId) {
        setSelectedEmail((prev) => prev ? { ...prev, isStarred: email.isStarred } : null);
      }
      persistCache();
    }
  }

  async function refreshCounts() {
    fetchUnreadCount().catch(() => {});
    fetchUnreadPerAccount().catch(() => {});
  }

  async function archiveEmail(emailId: string) {
    setIsDeleting(true);
    try {
      await api.patch<Email>(`/emails/${emailId}`, { isArchived: true });
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (selectedEmail()?.id === emailId) setSelectedEmail(null);
      persistCache();
      refreshCounts();
    } finally {
      setIsDeleting(false);
    }
  }

  async function deleteEmail(emailId: string) {
    setIsDeleting(true);
    try {
      await api.delete(`/emails/${emailId}`);
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (selectedEmail()?.id === emailId) setSelectedEmail(null);
      persistCache();
      refreshCounts();
    } finally {
      setIsDeleting(false);
    }
  }

  async function syncEmails(full = false) {
    setIsSyncing(true);
    try {
      for (const acc of accounts()) {
        try {
          await api.post(`/email-accounts/${acc.id}/sync${full ? "?full=true" : ""}`, {});
        } catch (err) {
          console.error(`Failed to sync ${acc.label}:`, err);
        }
      }
      await fetchEmails();
      await refreshCounts();
    } finally {
      setIsSyncing(false);
    }
  }

  async function addAccount(input: CreateEmailAccountDTO): Promise<EmailAccount> {
    const account = await api.post<EmailAccount>("/email-accounts", input);
    setAccounts((prev) => [...prev, account]);
    // Trigger initial sync for the new account
    try {
      await api.post(`/email-accounts/${account.id}/sync`, {});
      await fetchEmails();
      await fetchUnreadCount();
    } catch (err) {
      console.error(`[email] Initial sync failed for ${account.label}:`, err);
    }
    return account;
  }

  async function removeAccount(id: string) {
    await api.delete(`/email-accounts/${id}`);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    if (activeAccountId() === id) setActiveAccountId(null);
  }

  async function testConnection(input: CreateEmailAccountDTO): Promise<boolean> {
    const data = await api.post<{ success: boolean }>("/email-accounts/test-connection", input);
    return data.success;
  }

  function moveFocus(delta: number) {
    const list = emails();
    if (list.length === 0) return;
    const next = Math.max(0, Math.min(list.length - 1, focusedIndex() + delta));
    setFocusedIndex(next);
  }

  function selectFocused() {
    const list = emails();
    const idx = focusedIndex();
    if (idx >= 0 && idx < list.length) {
      selectEmail(list[idx]);
    }
  }

  async function toggleReadStatus(id: string) {
    const email = emails().find((e) => e.id === id);
    if (!email) return;
    const newIsRead = !email.isRead;
    // Optimistic update
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: newIsRead } : e)));
    if (selectedEmail()?.id === id) {
      setSelectedEmail((prev) => prev ? { ...prev, isRead: newIsRead } : null);
    }
    setUnreadCount((c) => email.isRead ? c + 1 : Math.max(0, c - 1));
    persistCache();
    try {
      await api.patch<Email>(`/emails/${id}`, { isRead: newIsRead });
      refreshCounts();
    } catch (err) {
      console.error("[email] Failed to toggle read status:", err);
    }
  }

  // Refresh emails when coming back online
  function setupReconnectionListener() {
    window.addEventListener("online", () => {
      fetchEmails();
    });
  }

  async function fetchDigest(days: number = 7) {
    setDigestLoading(true);
    try {
      const data = await api.get<EmailDigest>(`/emails/digest?days=${days}&summary=true`);
      setDigest(data);
    } catch (err) {
      console.error("Failed to fetch email digest:", err);
      setDigest(null);
    } finally {
      setDigestLoading(false);
    }
  }

  async function fetchInlineDigest(days: number = 7) {
    setDigestLoading(true);
    setDigestSummary("");
    setDigestSummaryLoading(true);
    try {
      // Fast call: structured data only (no LLM)
      const structData = api.get<EmailDigest>(`/emails/digest?days=${days}`);
      // Slow call: with LLM summary
      const summaryData = api.get<EmailDigest>(`/emails/digest?days=${days}&summary=true`);

      // Structure arrives first → display groups immediately
      const fast = await structData;
      setDigest(fast);
      setDigestLoading(false);

      // Summary arrives later → replace loader
      const slow = await summaryData;
      setDigestSummary(slow.summary);
    } catch (err) {
      console.error("Failed to fetch inline digest:", err);
      setDigest(null);
    } finally {
      setDigestLoading(false);
      setDigestSummaryLoading(false);
    }
  }

  async function bulkDeleteEmails(ids: string[]): Promise<number> {
    // Optimistic update
    const idSet = new Set(ids);
    setEmails((prev) => prev.filter((e) => !idSet.has(e.id)));
    persistCache();
    try {
      const data = await api.post<{ deleted: number }>("/emails/bulk-delete", { ids });
      refreshCounts();
      return data?.deleted ?? ids.length;
    } catch (err) {
      console.error("[email] Failed to bulk delete:", err);
      return ids.length;
    }
  }

  async function deleteSenderFromDigest(sender: string, emailIds: string[]): Promise<void> {
    // Optimistic: remove sender card from digest immediately
    setDigest((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        bySender: prev.bySender.filter((s) => s.sender !== sender),
        totalUnread: prev.totalUnread - emailIds.length,
      };
    });
    // API call in background — UI already updated
    await bulkDeleteEmails(emailIds);
    await fetchUnreadCount();
  }

  async function sendEmail(input: SendEmailDTO): Promise<Email | null> {
    try {
      const data = await api.post<Email>("/emails/send", input);
      return data ?? null;
    } catch (err) {
      console.error("[email] Failed to send email:", err);
      return null;
    }
  }

  async function generateReport(days: number = 7): Promise<{ markdown: string; emailCount: number }> {
    const { trackAiActivity } = await import("./aiActivityStore");
    return trackAiActivity("Rapport email IA", () =>
      api.post<{ markdown: string; emailCount: number }>(`/emails/report?days=${days}`, {})
    );
  }

  async function summarizeEmail(id: string) {
    const { trackAiActivity } = await import("./aiActivityStore");
    setSummaryLoading(true);
    setEmailSummary(null);
    try {
      const data = await trackAiActivity("Resume email IA", () =>
        api.post<{ summary: string }>(`/emails/${id}/summarize`, {})
      );
      setEmailSummary(data.summary);
    } catch (err) {
      console.error("Failed to summarize email:", err);
      setEmailSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  return {
    emails, accounts, selectedEmail, activeAccountId, activeFolder,
    isLoading, isSyncing, isDeleting, unreadCount, unreadPerAccount, isStale, hasMore, isLoadingMore,
    focusedIndex, emailSummary, summaryLoading,
    digest, digestLoading, digestSummary, digestSummaryLoading,
    setActiveAccountId, setActiveFolder, setSelectedEmail, setFocusedIndex, setEmailSummary,
    fetchAccounts, fetchEmails, fetchUnreadCount, fetchUnreadPerAccount, loadMoreEmails, fetchDigest, fetchInlineDigest,
    getAccountColor,
    selectEmail, toggleStar, archiveEmail, deleteEmail,
    syncEmails, addAccount, removeAccount, testConnection,
    moveFocus, selectFocused, toggleReadStatus, summarizeEmail,
    bulkDeleteEmails, deleteSenderFromDigest, generateReport, sendEmail,
    setupReconnectionListener,
    /** Free heavy data from memory (call when leaving email tab) */
    clearBulkData() {
      setEmails([]);
      setSelectedEmail(null);
      setEmailSummary(null);
    },
  };
}

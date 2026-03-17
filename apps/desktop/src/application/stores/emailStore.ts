import { createSignal } from "solid-js";
import type { Email, EmailAccount, CreateEmailAccountDTO } from "../../domain/models/Email";
import { api } from "../../infrastructure/api/apiClient";

const [emails, setEmails] = createSignal<Email[]>([]);
const [accounts, setAccounts] = createSignal<EmailAccount[]>([]);
const [selectedEmail, setSelectedEmail] = createSignal<Email | null>(null);
const [activeAccountId, setActiveAccountId] = createSignal<string | null>(null); // null = tous
const [activeFolder, setActiveFolder] = createSignal("INBOX");
const [isLoading, setIsLoading] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);
const [unreadCount, setUnreadCount] = createSignal(0);
const [focusedIndex, setFocusedIndex] = createSignal(-1);
const [emailSummary, setEmailSummary] = createSignal<string | null>(null);
const [summaryLoading, setSummaryLoading] = createSignal(false);

export function useEmailStore() {
  async function fetchAccounts() {
    const data = await api.get<EmailAccount[]>("/email-accounts");
    setAccounts(data);
  }

  async function fetchEmails() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      const accountId = activeAccountId();
      if (accountId) params.set("accountId", accountId);
      params.set("folder", activeFolder());
      params.set("limit", "50");

      const qs = params.toString();
      const data = await api.get<Email[]>(`/emails?${qs}`);
      setEmails(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUnreadCount() {
    const data = await api.get<{ count: number }>("/emails/unread-count");
    setUnreadCount(data.count);
  }

  async function selectEmail(email: Email) {
    setSelectedEmail(email);
    setEmailSummary(null);
    // Mark as read if unread
    if (!email.isRead) {
      await api.put<Email>(`/emails/${email.id}`, { isRead: true });
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e)));
      setSelectedEmail({ ...email, isRead: true });
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  async function toggleStar(emailId: string) {
    const email = emails().find((e) => e.id === emailId);
    if (!email) return;
    await api.put<Email>(`/emails/${emailId}`, { isStarred: !email.isStarred });
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, isStarred: !e.isStarred } : e)));
    if (selectedEmail()?.id === emailId) {
      setSelectedEmail((prev) => prev ? { ...prev, isStarred: !prev.isStarred } : null);
    }
  }

  async function archiveEmail(emailId: string) {
    await api.put<Email>(`/emails/${emailId}`, { isArchived: true });
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmail()?.id === emailId) setSelectedEmail(null);
  }

  async function deleteEmail(emailId: string) {
    await api.delete(`/emails/${emailId}`);
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmail()?.id === emailId) setSelectedEmail(null);
  }

  async function syncEmails() {
    setIsSyncing(true);
    try {
      // Sync all accounts
      for (const acc of accounts()) {
        try {
          await api.post(`/email-accounts/${acc.id}/sync`, {});
        } catch (err) {
          console.error(`Failed to sync ${acc.label}:`, err);
        }
      }
      await fetchEmails();
      await fetchUnreadCount();
    } finally {
      setIsSyncing(false);
    }
  }

  async function addAccount(input: CreateEmailAccountDTO): Promise<EmailAccount> {
    const account = await api.post<EmailAccount>("/email-accounts", input);
    setAccounts((prev) => [...prev, account]);
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
    await api.put<Email>(`/emails/${id}`, { isRead: !email.isRead });
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: !email.isRead } : e)));
    if (selectedEmail()?.id === id) {
      setSelectedEmail((prev) => prev ? { ...prev, isRead: !email.isRead } : null);
    }
    setUnreadCount((c) => email.isRead ? c + 1 : Math.max(0, c - 1));
  }

  async function summarizeEmail(id: string) {
    setSummaryLoading(true);
    setEmailSummary(null);
    try {
      const data = await api.post<{ summary: string }>(`/emails/${id}/summarize`, {});
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
    isLoading, isSyncing, unreadCount,
    focusedIndex, emailSummary, summaryLoading,
    setActiveAccountId, setActiveFolder, setSelectedEmail, setFocusedIndex, setEmailSummary,
    fetchAccounts, fetchEmails, fetchUnreadCount,
    selectEmail, toggleStar, archiveEmail, deleteEmail,
    syncEmails, addAccount, removeAccount, testConnection,
    moveFocus, selectFocused, toggleReadStatus, summarizeEmail,
  };
}

import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface CalDavAccount {
  id: string;
  label: string;
  url: string;
  username: string;
  calendarId: string | null;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalDavAccountInput {
  label: string;
  url: string;
  username: string;
  password: string;
  calendarId?: string;
}

export interface UpdateCalDavAccountInput {
  label?: string;
  url?: string;
  username?: string;
  password?: string;
  calendarId?: string;
  syncEnabled?: boolean;
}

const [accounts, setAccounts] = createSignal<CalDavAccount[]>([]);
const [isLoading, setIsLoading] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);

export function useCalDavStore() {
  async function fetchAccounts() {
    setIsLoading(true);
    try {
      const data = await api.get<CalDavAccount[]>("/caldav-accounts");
      setAccounts(data);
    } catch (err) {
      console.error("Failed to fetch CalDAV accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function createAccount(input: CreateCalDavAccountInput) {
    try {
      const data = await api.post<CalDavAccount>("/caldav-accounts", input);
      if (data) {
        setAccounts((prev) => [...prev, data]);
      }
      return data;
    } catch (err) {
      console.error("[caldav] Failed to create account:", err);
      throw err;
    }
  }

  async function updateAccount(id: string, input: UpdateCalDavAccountInput) {
    try {
      const data = await api.put<CalDavAccount>(`/caldav-accounts/${id}`, input);
      if (data) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? data : a)));
      }
      return data;
    } catch (err) {
      console.error("[caldav] Failed to update account:", err);
      throw err;
    }
  }

  async function deleteAccount(id: string) {
    // Optimistic update
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    try {
      await api.delete(`/caldav-accounts/${id}`);
    } catch (err) {
      console.error("[caldav] Failed to delete account:", err);
    }
  }

  async function syncAccount(id: string) {
    setIsSyncing(true);
    try {
      const data = await api.post<{ imported: number; updated: number }>(`/caldav-accounts/${id}/sync`, {});
      return data;
    } finally {
      setIsSyncing(false);
    }
  }

  async function testConnection(input: CreateCalDavAccountInput) {
    const data = await api.post<{ success: boolean }>("/caldav-accounts/test-connection", input);
    return data.success;
  }

  return {
    accounts,
    isLoading,
    isSyncing,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    syncAccount,
    testConnection,
  };
}

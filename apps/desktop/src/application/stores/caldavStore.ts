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
    const data = await api.post<CalDavAccount>("/caldav-accounts", input);
    setAccounts((prev) => [...prev, data]);
    return data;
  }

  async function updateAccount(id: string, input: UpdateCalDavAccountInput) {
    const data = await api.put<CalDavAccount>(`/caldav-accounts/${id}`, input);
    setAccounts((prev) => prev.map((a) => (a.id === id ? data : a)));
    return data;
  }

  async function deleteAccount(id: string) {
    await api.delete(`/caldav-accounts/${id}`);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
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

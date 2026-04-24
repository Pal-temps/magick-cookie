import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { createCrudStore } from "./createCrudStore";

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

const crud = createCrudStore<CalDavAccount, CreateCalDavAccountInput, UpdateCalDavAccountInput>({
  endpoint: "/caldav-accounts",
  label: "caldav-accounts",
});
const [isLoading, setIsLoading] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);

export function useCalDavStore() {
  async function fetchAccounts() {
    setIsLoading(true);
    try {
      await crud.fetchAll();
    } finally {
      setIsLoading(false);
    }
  }

  async function syncAccount(id: string) {
    setIsSyncing(true);
    try {
      return await api.post<{ imported: number; updated: number }>(`/caldav-accounts/${id}/sync`, {});
    } finally {
      setIsSyncing(false);
    }
  }

  async function testConnection(input: CreateCalDavAccountInput) {
    const data = await api.post<{ success: boolean }>("/caldav-accounts/test-connection", input);
    return data.success;
  }

  return {
    accounts: crud.items,
    isLoading,
    isSyncing,
    fetchAccounts,
    createAccount: crud.create,
    updateAccount: crud.update,
    deleteAccount: crud.delete,
    syncAccount,
    testConnection,
  };
}

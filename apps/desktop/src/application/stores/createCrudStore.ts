import { createSignal, type Accessor } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

// Minimal CRUD shape shared by the majority of REST-backed stores. For stores that need extra
// fields (fire-timers, caches, etc.) compose this helper with whatever bespoke state they need.

export interface CrudStore<T extends { id: string }, CreateInput, UpdateInput> {
  items: Accessor<T[]>;
  setItems: (updater: (prev: T[]) => T[]) => void;
  fetchAll: () => Promise<void>;
  create: (input: CreateInput) => Promise<T | undefined>;
  update: (id: string, input: UpdateInput) => Promise<T | undefined>;
  delete: (id: string) => Promise<void>;
}

export interface CrudOptions {
  // Base path under /api, e.g. "/projects" or "/alarms". A trailing slash is accepted but not
  // required; the id is appended with a `/` separator.
  endpoint: string;
  // Label used in console.error messages. Defaults to the endpoint.
  label?: string;
}

export function createCrudStore<
  T extends { id: string },
  CreateInput,
  UpdateInput,
>(opts: CrudOptions): CrudStore<T, CreateInput, UpdateInput> {
  const [items, setItems] = createSignal<T[]>([]);
  const resource = opts.endpoint.replace(/\/$/, "");
  const label = opts.label ?? resource;

  async function fetchAll() {
    try {
      const data = await api.get<T[]>(resource);
      setItems(() => data);
    } catch (e) {
      console.error(`Failed to fetch ${label}:`, e);
    }
  }

  async function create(input: CreateInput): Promise<T | undefined> {
    try {
      const item = await api.post<T>(resource, input);
      setItems((prev) => [...prev, item]);
      return item;
    } catch (e) {
      console.error(`Failed to create ${label}:`, e);
      return undefined;
    }
  }

  async function update(id: string, input: UpdateInput): Promise<T | undefined> {
    try {
      const item = await api.put<T>(`${resource}/${id}`, input);
      setItems((prev) => prev.map((p) => (p.id === id ? item : p)));
      return item;
    } catch (e) {
      console.error(`Failed to update ${label}:`, e);
      return undefined;
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`${resource}/${id}`);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(`Failed to delete ${label}:`, e);
    }
  }

  return {
    items,
    setItems: (updater) => setItems(updater),
    fetchAll,
    create,
    update,
    delete: remove,
  };
}

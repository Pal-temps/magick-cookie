import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface EmailRule {
  id: string;
  name: string;
  conditionField: "from" | "subject" | "domain";
  conditionOperator: "contains" | "equals" | "startsWith" | "endsWith";
  conditionValue: string;
  actionType: "classify" | "star" | "archive";
  actionValue: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailRuleInput {
  name: string;
  conditionField: "from" | "subject" | "domain";
  conditionOperator: "contains" | "equals" | "startsWith" | "endsWith";
  conditionValue: string;
  actionType: "classify" | "star" | "archive";
  actionValue: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface UpdateEmailRuleInput {
  name?: string;
  conditionField?: "from" | "subject" | "domain";
  conditionOperator?: "contains" | "equals" | "startsWith" | "endsWith";
  conditionValue?: string;
  actionType?: "classify" | "star" | "archive";
  actionValue?: string;
  enabled?: boolean;
  sortOrder?: number;
}

const [rules, setRules] = createSignal<EmailRule[]>([]);
const [isLoading, setIsLoading] = createSignal(false);

export function useEmailRuleStore() {
  async function fetchRules() {
    setIsLoading(true);
    try {
      const data = await api.get<EmailRule[]>("/email-rules");
      setRules(data);
    } catch (err) {
      console.error("Failed to fetch email rules:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function createRule(input: CreateEmailRuleInput) {
    const data = await api.post<EmailRule>("/email-rules", input);
    setRules((prev) => [...prev, data]);
    return data;
  }

  async function updateRule(id: string, input: UpdateEmailRuleInput) {
    const data = await api.put<EmailRule>(`/email-rules/${id}`, input);
    setRules((prev) => prev.map((r) => (r.id === id ? data : r)));
    return data;
  }

  async function deleteRule(id: string) {
    await api.delete(`/email-rules/${id}`);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function toggleRule(id: string, enabled: boolean) {
    return updateRule(id, { enabled });
  }

  return {
    rules,
    isLoading,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}

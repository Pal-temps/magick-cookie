import { createSignal } from "solid-js";
import { createCrudStore } from "./createCrudStore";

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

const crud = createCrudStore<EmailRule, CreateEmailRuleInput, UpdateEmailRuleInput>({
  endpoint: "/email-rules",
  label: "email-rules",
});
const [isLoading, setIsLoading] = createSignal(false);

export function useEmailRuleStore() {
  async function fetchRules() {
    setIsLoading(true);
    try {
      await crud.fetchAll();
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    return crud.update(id, { enabled });
  }

  return {
    rules: crud.items,
    isLoading,
    fetchRules,
    createRule: crud.create,
    updateRule: crud.update,
    deleteRule: crud.delete,
    toggleRule,
  };
}

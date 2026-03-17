import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface LlmConfig {
  id: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}

const [llmConfig, setLlmConfig] = createSignal<LlmConfig | null>(null);
const [llmLoading, setLlmLoading] = createSignal(false);
const [llmTestResult, setLlmTestResult] = createSignal<boolean | null>(null);

export function useLlmStore() {
  async function fetchConfig() {
    try {
      const data = await api.get<LlmConfig | null>("/llm/config");
      setLlmConfig(data);
    } catch (e) {
      console.error("Failed to fetch LLM config:", e);
    }
  }

  async function updateConfig(input: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKey?: string | null;
    maxTokens?: number;
    temperature?: number;
    enabled?: boolean;
  }) {
    setLlmLoading(true);
    try {
      const data = await api.put<LlmConfig>("/llm/config", input);
      setLlmConfig(data);
    } catch (e) {
      console.error("Failed to update LLM config:", e);
      throw e;
    } finally {
      setLlmLoading(false);
    }
  }

  async function testConnection() {
    setLlmTestResult(null);
    try {
      const data = await api.post<{ success: boolean }>("/llm/test", {});
      setLlmTestResult(data.success);
      return data.success;
    } catch {
      setLlmTestResult(false);
      return false;
    }
  }

  return {
    llmConfig,
    llmLoading,
    llmTestResult,
    fetchConfig,
    updateConfig,
    testConnection,
  };
}

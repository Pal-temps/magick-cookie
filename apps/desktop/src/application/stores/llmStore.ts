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
const [llmReady, setLlmReady] = createSignal(false);

/** Global read-only accessor — can be imported anywhere without useLlmStore() */
export function isLlmConfigured(): boolean {
  return llmReady();
}

export function useLlmStore() {
  async function fetchConfig() {
    try {
      const data = await api.get<LlmConfig | null>("/llm/config");
      setLlmConfig(data);
      setLlmReady(data != null && data.enabled !== false);
    } catch (e) {
      console.error("Failed to fetch LLM config:", e);
    }
  }

  /** Try to auto-detect Ollama and configure it if no LLM config exists */
  async function autoSetup() {
    try {
      const result = await api.post<{ configured: boolean; source?: string; model?: string; reason?: string }>("/llm/auto-setup", {});
      if (result.configured) {
        await fetchConfig();
        if (result.source === "ollama") {
          console.log(`[llm] Auto-configured Ollama with model ${result.model}`);
        }
      }
    } catch (e) {
      console.error("Failed to auto-setup LLM:", e);
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
      if (data) {
        setLlmConfig(data);
        setLlmReady(data.enabled !== false);
      }
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
    isLlmConfigured: llmReady,
    fetchConfig,
    autoSetup,
    updateConfig,
    testConnection,
  };
}

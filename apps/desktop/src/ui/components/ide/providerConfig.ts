export interface ProviderConfig {
  id: string;
  label: string;
  badge: string;
  defaultModels: string[];
  needsApiKey: boolean;
  defaultBaseUrl?: string;
}

export const ALL_PROVIDERS: ProviderConfig[] = [
  {
    id: "anthropic-api",
    label: "Anthropic (Claude)",
    badge: "CC",
    defaultModels: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
    needsApiKey: true,
  },
  {
    id: "openai-api",
    label: "OpenAI (GPT)",
    badge: "GPT",
    defaultModels: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    needsApiKey: true,
  },
  {
    id: "gemini-api",
    label: "Gemini",
    badge: "GEM",
    defaultModels: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"],
    needsApiKey: true,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    badge: "OL",
    defaultModels: ["llama3.2", "mistral", "codellama", "deepseek-coder"],
    needsApiKey: false,
    defaultBaseUrl: "http://localhost:11434",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    badge: "LM",
    defaultModels: ["default"],
    needsApiKey: false,
    defaultBaseUrl: "http://localhost:1234",
  },
];

const PROVIDER_MAP = new Map<string, ProviderConfig>(ALL_PROVIDERS.map((p) => [p.id, p]));

export function getDefaultModels(provider: string): string[] {
  return PROVIDER_MAP.get(provider)?.defaultModels ?? [];
}

export function needsApiKey(provider: string): boolean {
  return PROVIDER_MAP.get(provider)?.needsApiKey ?? false;
}

export function getProviderLabel(provider: string): string {
  return PROVIDER_MAP.get(provider)?.label ?? provider;
}

export function getProviderBadge(provider: string): string {
  return PROVIDER_MAP.get(provider)?.badge ?? provider.slice(0, 2).toUpperCase();
}

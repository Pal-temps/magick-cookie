import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { request, cleanDb, closeDb } from "./setup";

afterAll(async () => {
  await closeDb();
});

describe("LLM config routes", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  test("GET /api/llm/config returns null when unconfigured", async () => {
    const res = await request("GET", "/api/llm/config");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toBeNull();
  });

  test("PUT /api/llm/config persists a provider configuration", async () => {
    const res = await request("PUT", "/api/llm/config", {
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2:3b",
      enabled: true,
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.provider).toBe("ollama");
    expect(data.model).toBe("llama3.2:3b");
    expect(data.enabled).toBe(true);
  });

  test("PUT /api/llm/config round-trips via GET", async () => {
    await request("PUT", "/api/llm/config", {
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
    });
    const res = await request("GET", "/api/llm/config");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.provider).toBe("anthropic");
    expect(data.model).toBe("claude-sonnet-4-6");
  });

  test("PUT /api/llm/config returns 400 when baseUrl is not a URL", async () => {
    const res = await request("PUT", "/api/llm/config", {
      provider: "ollama",
      baseUrl: "not-a-url",
      model: "llama3.2",
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/llm/chat returns 400 when messages array is empty", async () => {
    const res = await request("POST", "/api/llm/chat", { messages: [] });
    expect(res.status).toBe(400);
  });

  test("POST /api/llm/generate-code returns 400 when title missing", async () => {
    const res = await request("POST", "/api/llm/generate-code", {});
    expect(res.status).toBe(400);
  });
});

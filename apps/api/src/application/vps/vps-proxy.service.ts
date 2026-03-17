export class VpsProxyService {
  constructor(private baseUrl: string, private token: string) {}

  // Generic proxy method
  async proxy(path: string, options?: { method?: string; query?: Record<string, string> }): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    if (options?.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    return fetch(url.toString(), {
      method: options?.method || "GET",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
  }

  // SSE proxy — returns a ReadableStream that relays SSE from VPS
  async streamProxy(path: string, query?: Record<string, string>): Promise<ReadableStream | null> {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${this.token}` },
    });
    return res.body;
  }
}

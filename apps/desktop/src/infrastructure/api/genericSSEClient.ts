export function connectGenericSSE(
  url: string,
  handlers: Record<string, (data: any) => void>,
  options?: { reconnectMs?: number }
): () => void {
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const reconnectMs = options?.reconnectMs ?? 5000;

  function connect() {
    source = new EventSource(url);

    for (const [event, handler] of Object.entries(handlers)) {
      source.addEventListener(event, (e: MessageEvent) => {
        try {
          const data = e.data ? JSON.parse(e.data) : null;
          handler(data);
        } catch {
          handler(e.data);
        }
      });
    }

    source.onerror = () => {
      source?.close();
      source = null;
      reconnectTimer = setTimeout(connect, reconnectMs);
    };
  }

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    source?.close();
    source = null;
  };
}

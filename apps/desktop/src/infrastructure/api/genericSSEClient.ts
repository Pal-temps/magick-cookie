export function connectGenericSSE(
  url: string,
  handlers: Record<string, (data: any) => void>,
  options?: { reconnectMs?: number; maxRetries?: number }
): () => void {
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  const reconnectMs = options?.reconnectMs ?? 5000;
  const maxRetries = options?.maxRetries ?? 5;

  function connect() {
    source = new EventSource(url);

    source.onopen = () => {
      retryCount = 0; // Reset on successful connection
    };

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
      retryCount++;
      if (retryCount <= maxRetries) {
        reconnectTimer = setTimeout(connect, reconnectMs);
      } else {
        handlers.error?.({});
      }
    };
  }

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    source?.close();
    source = null;
  };
}

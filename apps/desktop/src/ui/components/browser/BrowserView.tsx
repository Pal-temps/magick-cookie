import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { useBookmarkStore } from "../../../application/stores/bookmarkStore";
import { useBrowserTabStore } from "../../../application/stores/browserTabStore";
import "../../styles/cookwser.css";

const BROWSER_ID = "cookwser";
const HOME_URL = "https://www.google.com";

// Persist URL across tab switches (outside component so it survives mount/unmount)
let savedUrl = HOME_URL;

export function BrowserView() {
  const { favorites } = useBookmarkStore();
  const browser = useBrowserTabStore();
  const [inputUrl, setInputUrl] = createSignal(savedUrl);
  const [isLoading, setIsLoading] = createSignal(false);
  let contentRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;

  function normalizeUrl(raw: string): string {
    let u = raw.trim();
    if (!u) return HOME_URL;
    if (/^https?:\/\//.test(u)) return u;
    if (/^[\w-]+\.\w{2,}/.test(u) || u.includes(".")) return "https://" + u;
    return `https://www.google.com/search?q=${encodeURIComponent(u)}`;
  }

  async function syncBounds() {
    if (!contentRef) return;
    const rect = contentRef.getBoundingClientRect();
    await browser.setBounds(BROWSER_ID, {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  async function navigateTo(raw: string) {
    const url = normalizeUrl(raw);
    setInputUrl(url);
    savedUrl = url;
    setIsLoading(true);
    try {
      await browser.navigate(BROWSER_ID, url);
    } catch {
      // If webview doesn't exist yet, create it
      await browser.createWebview(BROWSER_ID, url);
      await syncBounds();
      await browser.setVisible(BROWSER_ID, true);
    }
    // Loading will be cleared by a timeout since we can't detect iframe load
    setTimeout(() => setIsLoading(false), 1500);
  }

  onMount(async () => {
    // Create browser webview with saved URL and position over the content div
    try {
      await browser.createWebview(BROWSER_ID, savedUrl);
      await new Promise((r) => setTimeout(r, 100));
      await syncBounds();
      await browser.setVisible(BROWSER_ID, true);
    } catch (e) {
      console.error("[cookwser] Failed to create browser:", e);
    }

    // Track content area resizes
    if (contentRef) {
      resizeObserver = new ResizeObserver(() => syncBounds());
      resizeObserver.observe(contentRef);
    }

    window.addEventListener("resize", syncBounds);
  });

  onCleanup(async () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", syncBounds);
    // Destroy the webview to free ~100-200 MB of WebView2 memory
    savedUrl = inputUrl();
    await browser.destroyWebview(BROWSER_ID);
  });

  async function goBack() {
    await browser.goBack(BROWSER_ID);
  }

  async function goForward() {
    await browser.goForward(BROWSER_ID);
  }

  async function reload() {
    setIsLoading(true);
    await browser.reload(BROWSER_ID);
    setTimeout(() => setIsLoading(false), 1500);
  }

  function goHome() {
    navigateTo(HOME_URL);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    navigateTo(inputUrl());
  }

  return (
    <div class="cookwser">
      {/* Toolbar */}
      <div class="cookwser-toolbar">
        <div class="cookwser-nav-buttons">
          <button class="cookwser-btn" onClick={goBack} title="Retour">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="cookwser-btn" onClick={goForward} title="Suivant">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="cookwser-btn" onClick={reload} title="Rafraichir">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0110.47-4M14 8a6 6 0 01-10.47 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="cookwser-btn" onClick={goHome} title="Accueil">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8l6-6 6 6M4 7v6a1 1 0 001 1h2V10h2v4h2a1 1 0 001-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <form class="cookwser-url-bar" onSubmit={handleSubmit}>
          <Show when={isLoading()}>
            <div class="cookwser-loading-dot" />
          </Show>
          <input
            class="cookwser-url-input"
            type="text"
            value={inputUrl()}
            onInput={(e) => setInputUrl(e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            spellcheck={false}
            placeholder="Entrer une URL ou rechercher..."
          />
        </form>
      </div>

      {/* Favorites bar */}
      <Show when={favorites().length > 0}>
        <div class="cookwser-bookmarks">
          <For each={favorites().slice(0, 12)}>
            {(bm) => (
              <button class="cookwser-bookmark" onClick={() => navigateTo(bm.url)} title={bm.url}>
                <span class="cookwser-bookmark-emoji">{bm.emoji ?? "🔗"}</span>
                <span class="cookwser-bookmark-name">{bm.name}</span>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Content area — the native webview is positioned over this div */}
      <div ref={contentRef} class="cookwser-content" />
    </div>
  );
}

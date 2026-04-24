import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { useSecretsStore } from "../../../application/stores/secretsStore";
import { useT } from "../../../i18n/context";

interface VaultUnlockProps {
  onUnlocked: () => void;
  animating?: boolean;
  inline?: boolean;
}

export function VaultUnlock(props: VaultUnlockProps) {
  const secrets = useSecretsStore();
  const { t } = useT();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  let autoSkipTimer: ReturnType<typeof setTimeout> | undefined;
  let countdownInterval: ReturnType<typeof setInterval> | undefined;
  let countdownRef: HTMLSpanElement | undefined;
  let countdown = 15;

  onMount(() => {
    if (props.inline) return;
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        countdown = 0;
      }
      if (countdownRef) countdownRef.textContent = String(countdown);
    }, 1000);
    autoSkipTimer = setTimeout(() => props.onUnlocked(), 15000);
  });

  onCleanup(() => {
    clearTimeout(autoSkipTimer);
    clearInterval(countdownInterval);
  });

  async function handleUnlock() {
    clearTimeout(autoSkipTimer);
    clearInterval(countdownInterval);
    if (!password().trim()) return;
    setError("");
    setLoading(true);
    try {
      if (isCreating() && password() !== confirmPassword()) {
        setError(t("vault.wrongPassword"));
        setLoading(false);
        return;
      }
      await secrets.unlock(password());
      props.onUnlocked();
    } catch (e: any) {
      const msg = String(e);
      if (msg.includes("Unlock error") || msg.includes("decrypt")) {
        setError(t("vault.wrongPassword"));
      } else if (msg.includes("not configured") || msg.includes("not exist")) {
        setError(t("vault.notConfigured"));
      } else if (!isCreating()) {
        setIsCreating(true);
        setError("");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function skip() {
    clearTimeout(autoSkipTimer);
    clearInterval(countdownInterval);
    props.onUnlocked();
  }

  // ─── Single render path ───
  const wrapperClass = () => props.inline
    ? ""
    : `vault-unlock-overlay ${props.animating ? "vault-unlock-overlay--animating" : ""}`;

  const wrapperStyle = () => props.inline
    ? { display: "flex", "align-items": "center", "justify-content": "center", height: "100%" }
    : {};

  return (
    <div class={wrapperClass()} style={wrapperStyle()}>
      <Show when={props.animating && !props.inline}>
        <div class="vault-fly-lock">
          <svg width="32" height="32" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3" />
            <path d="M4.5 6V4.5C4.5 3.12 5.62 2 7 2C8.38 2 9.5 3.12 9.5 4.5V6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            <circle cx="7" cy="10" r="1" fill="currentColor" />
          </svg>
        </div>
      </Show>

      <Show when={!props.animating}>
        <div class="vault-unlock-card">
          <div class="vault-unlock-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="20" width="32" height="24" rx="4" stroke="currentColor" stroke-width="2.5" />
              <path d="M16 20V14C16 9.58 19.58 6 24 6C28.42 6 32 9.58 32 14V20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
              <circle cx="24" cy="32" r="3" fill="currentColor" />
            </svg>
          </div>

          <h2 class="vault-unlock-title">
            {isCreating() ? t("vault.createMaster") : t("vault.unlock")}
          </h2>
          <p class="vault-unlock-desc">
            {isCreating() ? t("vault.protectsSecrets") : t("vault.enterMaster")}
          </p>

          <div class="vault-unlock-form">
            <input
              autofocus
              type="password"
              class="vault-unlock-input"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
              placeholder={t("vault.enterPassword")}
              disabled={loading()}
            />
            <Show when={isCreating()}>
              <input
                type="password"
                class="vault-unlock-input"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
                placeholder={t("vault.confirmPassword")}
                disabled={loading()}
              />
            </Show>
            <Show when={error()}>
              <div class="vault-unlock-error">{error()}</div>
            </Show>
            <button class="vault-unlock-btn" onClick={handleUnlock} disabled={loading() || !password().trim()}>
              {loading() ? "..." : isCreating() ? t("common.create") : t("vault.unlock")}
            </button>
            <Show when={!isCreating()}>
              <button class="vault-unlock-link" onClick={() => setIsCreating(true)}>{t("vault.firstTime")}</button>
            </Show>
            <Show when={isCreating()}>
              <button class="vault-unlock-link" onClick={() => { setIsCreating(false); setError(""); }}>{t("vault.alreadyHave")}</button>
            </Show>
          </div>

          <Show when={!props.inline}>
            <button class="vault-unlock-link" onClick={skip} style={{ "margin-top": "16px" }}>
              {t("vault.skip")} (<span ref={countdownRef}>15</span>s)
            </button>
          </Show>
          <p class="vault-unlock-hint">{t("vault.aes256Hint")}</p>
        </div>
      </Show>
    </div>
  );
}

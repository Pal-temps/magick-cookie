import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { useSecretsStore } from "../../../application/stores/secretsStore";

interface VaultUnlockProps {
  onUnlocked: () => void;
  animating?: boolean;
}

export function VaultUnlock(props: VaultUnlockProps) {
  const secrets = useSecretsStore();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [targetPos, setTargetPos] = createSignal<{ x: number; y: number } | null>(null);
  const [countdown, setCountdown] = createSignal(15);

  // Auto-skip after 15 seconds
  let autoSkipTimer: ReturnType<typeof setTimeout> | undefined;
  let countdownInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    autoSkipTimer = setTimeout(() => {
      props.onUnlocked();
    }, 15000);
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
        setError("Les mots de passe ne correspondent pas");
        setLoading(false);
        return;
      }

      await secrets.unlock(password());

      // Target position: vault tab button is pinned top-right of the header
      // The header is ~56px tall, button is ~32px wide, pinned to the right edge
      setTargetPos({
        x: window.innerWidth - 20,
        y: 72, // title bar (~30px) + header top + half button height
      });

      props.onUnlocked();
    } catch (e: any) {
      const msg = String(e);
      if (msg.includes("Unlock error") || msg.includes("decrypt")) {
        setError("Mot de passe incorrect");
      } else if (msg.includes("not configured") || msg.includes("not exist")) {
        setError("Le vault notes n'est pas configure. Configurez-le d'abord dans Notes > Parametres, ou cliquez 'Passer'.");
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

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleUnlock();
  }

  // Compute CSS custom properties for the fly target
  const animStyle = () => {
    const pos = targetPos();
    if (!pos || !props.animating) return {};
    return {
      "--vault-target-x": `${pos.x}px`,
      "--vault-target-y": `${pos.y}px`,
    } as Record<string, string>;
  };

  return (
    <div
      class={`vault-unlock-overlay ${props.animating ? "vault-unlock-overlay--animating" : ""}`}
      style={animStyle()}
    >
      {/* Animating state: show only the lock icon flying to its tab */}
      <Show when={props.animating}>
        <div class="vault-fly-lock">
          <svg width="32" height="32" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3" />
            <path d="M4.5 6V4.5C4.5 3.12 5.62 2 7 2C8.38 2 9.5 3.12 9.5 4.5V6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            <circle cx="7" cy="10" r="1" fill="currentColor" />
          </svg>
        </div>
      </Show>

      {/* Normal state: the form */}
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
            {isCreating() ? "Creer un mot de passe maitre" : "Deverrouiller le coffre"}
          </h2>

          <p class="vault-unlock-desc">
            {isCreating()
              ? "Ce mot de passe protege toutes vos cles API, tokens et mots de passe. Choisissez un mot de passe fort."
              : "Entrez votre mot de passe maitre pour acceder a vos secrets."
            }
          </p>

          <div class="vault-unlock-form">
            <input
              autofocus
              type="password"
              class="vault-unlock-input"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mot de passe maitre"
              disabled={loading()}
            />

            <Show when={isCreating()}>
              <input
                type="password"
                class="vault-unlock-input"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder="Confirmer le mot de passe"
                disabled={loading()}
              />
            </Show>

            <Show when={error()}>
              <div class="vault-unlock-error">{error()}</div>
            </Show>

            <button
              class="vault-unlock-btn"
              onClick={handleUnlock}
              disabled={loading() || !password().trim()}
            >
              {loading() ? "..." : isCreating() ? "Creer et deverrouiller" : "Deverrouiller"}
            </button>

            <Show when={!isCreating()}>
              <button
                class="vault-unlock-link"
                onClick={() => setIsCreating(true)}
              >
                Premiere fois ? Creer un coffre
              </button>
            </Show>

            <Show when={isCreating()}>
              <button
                class="vault-unlock-link"
                onClick={() => { setIsCreating(false); setError(""); }}
              >
                J'ai deja un coffre
              </button>
            </Show>
          </div>

          <button
            class="vault-unlock-link"
            onClick={() => { clearTimeout(autoSkipTimer); clearInterval(countdownInterval); props.onUnlocked(); }}
            style={{ "margin-top": "16px" }}
          >
            Passer sans coffre-fort ({countdown()}s)
          </button>

          <p class="vault-unlock-hint">
            Chiffrement AES-256 · Format KeePass (KDBX4) · Compatible KeePassXC
          </p>
        </div>
      </Show>
    </div>
  );
}

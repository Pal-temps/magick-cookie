import { createSignal } from "solid-js";
import { useSecretsStore } from "../../../application/stores/secretsStore";

interface PasswordGeneratorProps {
  onInsert?: (password: string) => void;
}

export function PasswordGenerator(props: PasswordGeneratorProps) {
  const secrets = useSecretsStore();
  const [length, setLength] = createSignal(20);
  const [uppercase, setUppercase] = createSignal(true);
  const [lowercase, setLowercase] = createSignal(true);
  const [digits, setDigits] = createSignal(true);
  const [symbols, setSymbols] = createSignal(true);
  const [generated, setGenerated] = createSignal("");

  function generate() {
    const pwd = secrets.generatePassword(length(), {
      uppercase: uppercase(),
      lowercase: lowercase(),
      digits: digits(),
      symbols: symbols(),
    });
    setGenerated(pwd);
  }

  // Generate on mount
  generate();

  async function copy() {
    await navigator.clipboard.writeText(generated());
  }

  return (
    <div class="pwd-generator">
      <div class="pwd-generator__header">Generateur de mot de passe</div>
      <div class="pwd-generator__output">
        <code class="pwd-generator__value">{generated()}</code>
        <button class="pwd-btn pwd-btn--sm" onClick={copy}>Copier</button>
        <button class="pwd-btn pwd-btn--sm" onClick={generate}>Regenerer</button>
        {props.onInsert && (
          <button class="pwd-btn pwd-btn--sm pwd-btn--primary" onClick={() => props.onInsert!(generated())}>
            Utiliser
          </button>
        )}
      </div>
      <div class="pwd-generator__options">
        <label>
          <span>Longueur: {length()}</span>
          <input type="range" min="8" max="64" value={length()} onInput={(e) => { setLength(parseInt(e.currentTarget.value)); generate(); }} />
        </label>
        <label><input type="checkbox" checked={uppercase()} onChange={(e) => { setUppercase(e.currentTarget.checked); generate(); }} /> Majuscules</label>
        <label><input type="checkbox" checked={lowercase()} onChange={(e) => { setLowercase(e.currentTarget.checked); generate(); }} /> Minuscules</label>
        <label><input type="checkbox" checked={digits()} onChange={(e) => { setDigits(e.currentTarget.checked); generate(); }} /> Chiffres</label>
        <label><input type="checkbox" checked={symbols()} onChange={(e) => { setSymbols(e.currentTarget.checked); generate(); }} /> Symboles</label>
      </div>
    </div>
  );
}

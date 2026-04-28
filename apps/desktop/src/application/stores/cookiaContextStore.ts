import { createSignal } from "solid-js";

export interface CookiaContext {
  prompt: string;
  source: string;
}

const [_cookiaContext, _setCookiaContext] = createSignal<CookiaContext | null>(null);

export function getCookiaContext(): CookiaContext | null {
  return _cookiaContext();
}

export function setCookiaContext(ctx: CookiaContext): void {
  _setCookiaContext(ctx);
}

export function clearCookiaContext(): void {
  _setCookiaContext(null);
}

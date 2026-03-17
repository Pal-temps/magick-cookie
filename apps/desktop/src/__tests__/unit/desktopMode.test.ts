import { describe, test, expect } from "bun:test";

// ─── Pure logic extracted for testing ───

// Simulates the desktop mode state machine
interface DesktopModeState {
  isDesktopMode: boolean;
  savedWindow: { x: number; y: number; width: number; height: number } | null;
}

function enterDesktopMode(
  state: DesktopModeState,
  currentWindow: { x: number; y: number; width: number; height: number },
  monitor: { width: number; height: number; x: number; y: number },
): DesktopModeState {
  return {
    isDesktopMode: true,
    savedWindow: { ...currentWindow },
  };
}

function exitDesktopMode(state: DesktopModeState): {
  newState: DesktopModeState;
  restoredWindow: { x: number; y: number; width: number; height: number };
} {
  const fallback = { x: 0, y: 0, width: 1200, height: 800 };
  const restoredWindow = state.savedWindow ?? fallback;
  return {
    newState: { isDesktopMode: false, savedWindow: null },
    restoredWindow,
  };
}

function toggleDesktopMode(
  state: DesktopModeState,
  currentWindow: { x: number; y: number; width: number; height: number },
  monitor: { width: number; height: number; x: number; y: number },
): DesktopModeState {
  if (state.isDesktopMode) {
    return exitDesktopMode(state).newState;
  }
  return enterDesktopMode(state, currentWindow, monitor);
}

// ─── Tests ───

describe("Desktop Mode State Machine", () => {
  const defaultWindow = { x: 100, y: 50, width: 1200, height: 800 };
  const monitor = { width: 1920, height: 1080, x: 0, y: 0 };

  test("initial state is not desktop mode", () => {
    const state: DesktopModeState = { isDesktopMode: false, savedWindow: null };
    expect(state.isDesktopMode).toBe(false);
    expect(state.savedWindow).toBeNull();
  });

  test("entering desktop mode saves current window state", () => {
    const state: DesktopModeState = { isDesktopMode: false, savedWindow: null };
    const newState = enterDesktopMode(state, defaultWindow, monitor);
    expect(newState.isDesktopMode).toBe(true);
    expect(newState.savedWindow).toEqual(defaultWindow);
  });

  test("exiting desktop mode restores saved window state", () => {
    const state: DesktopModeState = {
      isDesktopMode: true,
      savedWindow: { x: 100, y: 50, width: 1200, height: 800 },
    };
    const { newState, restoredWindow } = exitDesktopMode(state);
    expect(newState.isDesktopMode).toBe(false);
    expect(newState.savedWindow).toBeNull();
    expect(restoredWindow).toEqual({ x: 100, y: 50, width: 1200, height: 800 });
  });

  test("exiting without saved state falls back to default size", () => {
    const state: DesktopModeState = { isDesktopMode: true, savedWindow: null };
    const { restoredWindow } = exitDesktopMode(state);
    expect(restoredWindow).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
  });

  test("toggle from normal → desktop saves state", () => {
    const state: DesktopModeState = { isDesktopMode: false, savedWindow: null };
    const newState = toggleDesktopMode(state, defaultWindow, monitor);
    expect(newState.isDesktopMode).toBe(true);
    expect(newState.savedWindow).toEqual(defaultWindow);
  });

  test("toggle from desktop → normal clears state", () => {
    const state: DesktopModeState = {
      isDesktopMode: true,
      savedWindow: defaultWindow,
    };
    const newState = toggleDesktopMode(state, defaultWindow, monitor);
    expect(newState.isDesktopMode).toBe(false);
    expect(newState.savedWindow).toBeNull();
  });

  test("double toggle returns to normal mode", () => {
    let state: DesktopModeState = { isDesktopMode: false, savedWindow: null };
    state = toggleDesktopMode(state, defaultWindow, monitor);
    expect(state.isDesktopMode).toBe(true);
    state = toggleDesktopMode(state, defaultWindow, monitor);
    expect(state.isDesktopMode).toBe(false);
  });

  test("entering desktop mode preserves off-center window position", () => {
    const offCenterWindow = { x: 500, y: 300, width: 800, height: 600 };
    const state: DesktopModeState = { isDesktopMode: false, savedWindow: null };
    const newState = enterDesktopMode(state, offCenterWindow, monitor);
    expect(newState.savedWindow).toEqual(offCenterWindow);

    const { restoredWindow } = exitDesktopMode(newState);
    expect(restoredWindow).toEqual(offCenterWindow);
  });

  test("entering desktop mode on secondary monitor saves correct position", () => {
    const secondaryMonitor = { width: 2560, height: 1440, x: 1920, y: 0 };
    const windowOnSecondary = { x: 2100, y: 200, width: 1200, height: 800 };
    const state: DesktopModeState = { isDesktopMode: false, savedWindow: null };
    const newState = enterDesktopMode(state, windowOnSecondary, secondaryMonitor);
    expect(newState.savedWindow).toEqual(windowOnSecondary);
  });
});

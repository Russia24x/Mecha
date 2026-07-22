/**
 * DOM mock setup for Node test environment.
 * Import this BEFORE importing Phaser.
 *
 * Sets up minimal document, window, and localStorage mocks so Phaser can
 * initialize in headless mode for testing.
 */

if (typeof globalThis.document === 'undefined') {
  const listeners: Record<string, EventListener[]> = {};
  let vs = 'visible';
  const mockEl = {
    style: {},
    setAttribute: () => {},
    appendChild: () => {},
  };
  globalThis.document = {
    get visibilityState() { return vs; },
    set visibilityState(v: string) { vs = v; },
    documentElement: mockEl,
    body: mockEl,
    head: mockEl,
    createElement: () => mockEl,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (t: string, f: EventListener) => { (listeners[t] ||= []).push(f); },
    removeEventListener: (t: string, f: EventListener) => { const a = listeners[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
    dispatchEvent: (e: Event) => { const a = listeners[e.type]; if (a) a.forEach(f => f(e)); return true; },
  } as unknown as Document;
}

if (typeof globalThis.navigator === 'undefined' || !(globalThis.navigator as { maxTouchPoints?: number }).maxTouchPoints) {
  // Add maxTouchPoints to navigator (Phaser checks it)
  const nav = globalThis.navigator as { maxTouchPoints?: number; userAgent?: string };
  if (!nav.maxTouchPoints) nav.maxTouchPoints = 0;
  if (!nav.userAgent) nav.userAgent = 'node';
}

if (typeof globalThis.window === 'undefined') {
  const listeners: Record<string, EventListener[]> = {};
  const win = {
    addEventListener: (t: string, f: EventListener) => { (listeners[t] ||= []).push(f); },
    removeEventListener: (t: string, f: EventListener) => { const a = listeners[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
    dispatchEvent: (e: Event) => { const a = listeners[e.type]; if (a) a.forEach(f => f(e)); return true; },
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
    // Phaser init checks these
    cordova: undefined,
    navigator: { userAgent: 'node' },
    document: globalThis.document,
  };
  globalThis.window = win as unknown as Window & typeof globalThis;
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.has(k) ? store.get(k)! : null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  globalThis.localStorage = ls as unknown as Storage;
  if (globalThis.window) {
    (globalThis.window as unknown as { localStorage: Storage }).localStorage = ls as unknown as Storage;
  }
}

export {};

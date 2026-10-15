import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  // Node 26 自带但未启用的 localStorage 会遮盖 jsdom 的同名全局。
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, String(value)); },
    removeItem: (key: string) => { entries.delete(key); },
    clear: () => entries.clear(), key: (index: number) => [...entries.keys()][index] ?? null,
    get length() { return entries.size; },
  } satisfies Storage);
  vi.stubGlobal('fetch', vi.fn());
  HTMLElement.prototype.scrollTo = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

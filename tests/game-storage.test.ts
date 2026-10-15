import { expect, test } from 'vitest';
import { accountStorageKey, initialGame, LEGACY_STORAGE_KEY, readAccountGame, writeAccountGame } from '@/lib/game/storage';

test('不同账号隔离；原账号重新登录后仍能恢复', () => {
  const state = initialGame();
  state.messages.zhixia = [{ id: 'a1', role: 'user', content: 'A 的私密消息', createdAt: 1 }];
  expect(writeAccountGame(localStorage, 'account-A', state)).toBe(true);
  expect(readAccountGame(localStorage, 'account-B').game.messages).toEqual({});
  expect(readAccountGame(localStorage, 'account-A').game.messages.zhixia?.[0].content).toBe('A 的私密消息');
});

test('旧存档和损坏存档保留原文；不自动认领或覆盖', () => {
  localStorage.setItem(LEGACY_STORAGE_KEY, 'legacy-private-data');
  expect(readAccountGame(localStorage, 'B').game.messages).toEqual({});
  expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe('legacy-private-data');
  localStorage.setItem(accountStorageKey('B'), '{broken');
  const loaded = readAccountGame(localStorage, 'B');
  expect(loaded.canPersist).toBe(false);
  expect(loaded.warning).toContain('无法读取');
  expect(localStorage.getItem(accountStorageKey('B'))).toBe('{broken');
});

test('拒绝其他账号的存档信封，存储空间不足不会抛异常', () => {
  localStorage.setItem(accountStorageKey('B'), JSON.stringify({ version: 2, owner: 'A', game: initialGame() }));
  expect(readAccountGame(localStorage, 'B').canPersist).toBe(false);
  const full = { setItem() { throw new DOMException('Full', 'QuotaExceededError'); } };
  expect(writeAccountGame(full, 'A', initialGame())).toBe(false);
});

test('刷新中断文字请求：恢复可重试状态且额度只退一次', () => {
  const state = initialGame(); state.textRemaining = 99;
  state.messages.zhixia = [{ id: 'pending', role: 'user', content: '你好', createdAt: 1, pending: true }];
  writeAccountGame(localStorage, 'A', state);
  const restored = readAccountGame(localStorage, 'A').game;
  expect(restored.textRemaining).toBe(100);
  expect(restored.messages.zhixia?.[0]).toMatchObject({ failed: true, pending: false });
  writeAccountGame(localStorage, 'A', restored);
  expect(readAccountGame(localStorage, 'A').game.textRemaining).toBe(100);
});

test.each([{ messages: { zhixia: 'broken' } }, [], { messages: { zhixia: [null] } }, { textRemaining: 'broken' }])('合法信封内损坏结构仍保留原文 %j', (broken) => {
  const raw = JSON.stringify({ version: 2, owner: 'A', game: Array.isArray(broken) ? broken : { ...initialGame(), ...broken } });
  localStorage.setItem(accountStorageKey('A'), raw);
  expect(readAccountGame(localStorage, 'A').canPersist).toBe(false);
  expect(localStorage.getItem(accountStorageKey('A'))).toBe(raw);
});

test.each(['imageRemaining', 'voiceRemaining', 'tryOnRemaining'] as const)('刷新中断媒体请求退回对应 %s 一次', (key) => {
  const state = initialGame(); state[key] = 2;
  state.messages.zhixia = [{ id: 'pending', role: 'assistant', content: '正在生成', createdAt: 1, pending: true, mediaType: key === 'voiceRemaining' ? 'audio' : 'image', requestedQuota: key }];
  writeAccountGame(localStorage, 'A', state);
  const restored = readAccountGame(localStorage, 'A').game;
  expect(restored[key]).toBe(3);
  writeAccountGame(localStorage, 'A', restored);
  expect(readAccountGame(localStorage, 'A').game[key]).toBe(3);
});

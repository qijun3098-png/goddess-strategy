import type { ChatMessage, GameState } from '../types';

export const LEGACY_STORAGE_KEY = 'goddess-strategy-v1';
const characters = ['zhixia', 'keke', 'wanqing', 'xiaoman'] as const;

export function initialGame(): GameState {
  return { selectedCharacter: null, messages: {}, textRemaining: 100, imageRemaining: 3, voiceRemaining: 3, tryOnRemaining: 3 };
}

export function accountStorageKey(userId: string) {
  if (!userId.trim()) throw new Error('缺少存档账号');
  return `goddess-strategy-v2:${encodeURIComponent(userId)}`;
}

function quota(value: unknown, maximum: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > maximum) throw new Error('存档额度损坏');
  return value;
}

function message(value: unknown): ChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (typeof m.id !== 'string' || !m.id || m.id.length > 100 || typeof m.role !== 'string' || !['user', 'assistant'].includes(m.role)
    || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 2000
    || typeof m.createdAt !== 'number' || !Number.isFinite(m.createdAt)) return null;
  const mediaType = m.mediaType === 'image' || m.mediaType === 'audio' ? m.mediaType : undefined;
  const interrupted = m.pending === true;
  return {
    id: m.id, role: m.role as ChatMessage['role'], content: m.content, createdAt: m.createdAt,
    mediaType, mediaKey: typeof m.mediaKey === 'string' && m.mediaKey.length < 150 ? m.mediaKey : undefined,
    requestedMedia: m.requestedMedia === 'image' || m.requestedMedia === 'voice' ? m.requestedMedia : undefined,
    requestedQuota: m.requestedQuota === 'imageRemaining' || m.requestedQuota === 'voiceRemaining' || m.requestedQuota === 'tryOnRemaining' ? m.requestedQuota : undefined,
    pending: false, failed: m.failed === true || interrupted,
    error: interrupted ? '上次请求已中断，请重试' : typeof m.error === 'string' ? m.error.slice(0, 120) : undefined,
  };
}

export function decodeGame(raw: string, userId: string): GameState {
  const envelope = JSON.parse(raw);
  if (envelope?.version !== 2 || envelope.owner !== userId || !envelope.game || typeof envelope.game !== 'object' || Array.isArray(envelope.game)) throw new Error('存档格式不正确');
  const data = envelope.game;
  if (!data.messages || typeof data.messages !== 'object' || Array.isArray(data.messages)
    || Object.keys(data.messages).some((id) => !characters.includes(id as typeof characters[number]))
    || (data.selectedCharacter !== null && !characters.includes(data.selectedCharacter))) throw new Error('存档结构损坏');
  const state = initialGame();
  state.selectedCharacter = characters.includes(data.selectedCharacter) ? data.selectedCharacter : null;
  for (const character of characters) {
    if (data.messages[character] !== undefined && !Array.isArray(data.messages[character])) throw new Error('存档消息损坏');
    const values: unknown[] = data.messages[character] ?? [];
    const seen = new Set<string>();
    const restored: ChatMessage[] = [];
    for (const value of values) {
      const m = message(value);
      if (!m || seen.has(m.id)) throw new Error('存档消息损坏');
      seen.add(m.id); restored.push(m);
    }
    state.messages[character] = restored;
  }
  state.textRemaining = quota(data.textRemaining, 100);
  state.imageRemaining = quota(data.imageRemaining, 3);
  state.voiceRemaining = quota(data.voiceRemaining, 3);
  state.tryOnRemaining = quota(data.tryOnRemaining, 3);
  // 刷新打断的文字请求在恢复时退回一次额度，重存后不会再次退回。
  const interrupted = characters.flatMap((id) => Array.isArray(data.messages?.[id]) ? data.messages[id] : [])
    .filter((m: Record<string, unknown>) => m?.role === 'user' && m.pending === true && message(m)).length;
  state.textRemaining = Math.min(100, state.textRemaining + interrupted);
  for (const key of ['imageRemaining', 'voiceRemaining', 'tryOnRemaining'] as const) {
    const count = characters.flatMap((id) => data.messages[id] ?? [])
      .filter((m: Record<string, unknown>) => m?.role === 'assistant' && m.pending === true && m.requestedQuota === key).length;
    state[key] = Math.min(3, state[key] + count);
  }
  return state;
}

export function readAccountGame(storage: Pick<Storage, 'getItem'>, userId: string) {
  try {
    const raw = storage.getItem(accountStorageKey(userId));
    if (raw !== null) return { game: decodeGame(raw, userId), warning: '', canPersist: true };
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    return { game: initialGame(), warning: legacy ? '检测到旧版未归属存档，已保留；为保护隐私，本账号不会自动读取。' : '', canPersist: true };
  } catch {
    return { game: initialGame(), warning: '本地存档无法读取，已保留原数据；本次仍可聊天。', canPersist: false };
  }
}

export function writeAccountGame(storage: Pick<Storage, 'setItem'>, userId: string, game: GameState): boolean {
  try {
    const messages = Object.fromEntries(Object.entries(game.messages).map(([id, values]) => [id, values?.map((m) => ({ ...m, mediaUrl: undefined }))]));
    storage.setItem(accountStorageKey(userId), JSON.stringify({ version: 2, owner: userId, game: { ...game, messages } }));
    return true;
  } catch { return false; }
}

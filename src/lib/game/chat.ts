import type { CharacterId, ChatMessage, MediaIntent } from '../types';

const characters = new Set(['zhixia', 'keke', 'wanqing', 'xiaoman']);
export type ChatRequest = { characterId: CharacterId; messages: Array<{ role: 'user' | 'assistant'; content: string }>; forcedMedia?: MediaIntent };

export function conversationHistory(messages: ChatMessage[], userMessage: ChatMessage) {
  const index = messages.findIndex((m) => m.id === userMessage.id);
  const preceding = index < 0 ? messages : messages.slice(0, index);
  return [...preceding.filter((m) => !m.mediaType && !m.failed && !m.pending), userMessage]
    .slice(-12).map(({ role, content }) => ({ role, content }));
}

export function parseChatRequest(value: unknown): ChatRequest | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (typeof body.characterId !== 'string' || !characters.has(body.characterId)
    || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12
    || (body.forcedMedia !== undefined && (typeof body.forcedMedia !== 'string' || !['none', 'image', 'voice'].includes(body.forcedMedia)))) return null;
  const messages: ChatRequest['messages'] = [];
  for (const item of body.messages) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string'
      || !item.content.trim() || item.content.length > 2000) return null;
    messages.push({ role: item.role, content: item.content.trim() });
  }
  const last = messages.at(-1)!;
  if (last.role !== 'user' || last.content.length > 50) return null;
  return { characterId: body.characterId as CharacterId, messages, forcedMedia: body.forcedMedia as MediaIntent | undefined };
}

export function latestRetryable(messages: ChatMessage[], id: string) {
  const lastUser = messages.findLast((m) => m.role === 'user' && !m.mediaType);
  return lastUser?.id === id && lastUser.failed === true;
}

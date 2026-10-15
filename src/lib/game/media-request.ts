import type { CharacterId } from '../types';

export function parseMediaRequest(value: unknown, maxLength: number): { characterId: CharacterId; text: string } | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (typeof body.characterId !== 'string' || !['zhixia', 'keke', 'wanqing', 'xiaoman'].includes(body.characterId)
    || typeof body.text !== 'string' || !body.text.trim() || body.text.length > maxLength) return null;
  return { characterId: body.characterId as CharacterId, text: body.text.trim() };
}

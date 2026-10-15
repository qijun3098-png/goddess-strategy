import { expect, test, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';

const mocks = vi.hoisted(() => ({ user: vi.fn(async (): Promise<{ id: number } | null> => ({ id: 1 })) }));
vi.mock('@/lib/auth/user', () => ({ getAuthenticatedAppUser: mocks.user }));

test('未登录拒绝请求，不调用 AI', async () => {
  mocks.user.mockResolvedValueOnce(null);
  const response = await POST(new Request('https://game.test/api/chat', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(401); expect(fetch).not.toHaveBeenCalled();
});
test('无效 JSON 和恶意角色返回400，不调用 AI', async () => {
  for (const body of ['broken', JSON.stringify({ characterId: 'invalid', messages: [{ role: 'user', content: 'hi' }] })]) {
    const response = await POST(new Request('https://game.test/api/chat', { method: 'POST', body }));
    expect(response.status).toBe(400);
  }
  expect(fetch).not.toHaveBeenCalled();
});

import { expect, test, vi } from 'vitest';
import { POST as image } from '@/app/api/image/route';
import { POST as voice } from '@/app/api/tts/route';

vi.mock('@/lib/auth/user', () => ({ getAuthenticatedAppUser: vi.fn(async () => ({ id: 1 })) }));
vi.mock('node:fs/promises', () => {
  const readFile = vi.fn(async () => Buffer.from('reference'));
  return { readFile, default: { readFile } };
});

test('图片下载响应体阻塞时共用生成请求的超时信号', async () => {
  vi.stubEnv('ARK_API_KEY', 'fixture');
  const controller = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: 'https://image.example.test/result' }] })));
  let started!: () => void;
  const downloading = new Promise<void>((resolve) => { started = resolve; });
  vi.mocked(fetch).mockImplementationOnce(async (_input, init) => {
    expect(init?.signal).toBe(controller.signal);
    return { ok: true, headers: new Headers(), arrayBuffer: () => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
      started();
    }) } as Response;
  });
  const pending = image(new Request('https://game.test/api/image', { method: 'POST', body: JSON.stringify({ characterId: 'zhixia', text: '自拍' }) }));
  await downloading;
  controller.abort();
  expect((await pending).status).toBe(500);
});

test.each([image, voice])('媒体接口拒绝类型错误、无效角色和越界请求', async (handler) => {
  for (const body of [{ characterId: 'unknown', text: 'hi' }, { characterId: 'zhixia', text: 42 }, { characterId: 'zhixia', text: 'x'.repeat(301) }]) {
    const result = await handler(new Request('https://game.test/api/media', { method: 'POST', body: JSON.stringify(body) }));
    expect(result.status).toBe(400);
  }
  expect(fetch).not.toHaveBeenCalled();
});

test.each([image, voice])('上游诊断不会进入媒体接口响应', async (handler) => {
  vi.stubEnv('ARK_API_KEY', 'fixture'); vi.stubEnv('VOLCENGINE_TTS_API_KEY', 'fixture');
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { message: 'provider-private-marker' } }), { status: 502 }));
  const result = await handler(new Request('https://game.test/api/media', { method: 'POST', body: JSON.stringify({ characterId: 'zhixia', text: 'hi' }) }));
  expect(result.status).toBe(500);
  expect(await result.text()).not.toContain('provider-private-marker');
});

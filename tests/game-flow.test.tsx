import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { createElement, type ImgHTMLAttributes } from 'react';
import { GameApp } from '@/components/GameApp';
import { accountStorageKey, initialGame, writeAccountGame } from '@/lib/game/storage';
import { saveMedia } from '@/lib/mediaStore';

const mocks = vi.hoisted(() => ({ signOut: vi.fn(async (): Promise<{ error?: unknown }> => ({})) }));
vi.mock('next/image', () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement('img', { src: props.src, alt: props.alt ?? '', width: props.width, height: props.height }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/auth/client', () => ({ authClient: { signOut: mocks.signOut } }));
vi.mock('@/lib/mediaStore', () => ({ loadMedia: vi.fn(), saveMedia: vi.fn() }));

function enterChat() {
  return render(<GameApp userId="A" userEmail="a@example.test" />);
}

async function choose() { fireEvent.click(await screen.findByRole('button', { name: /和她相遇/ })); }
function send(text: string) {
  const input = screen.getByPlaceholderText('和她说点什么…');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}
const reply = () => new Response(JSON.stringify({ reply: '已收到', mediaIntent: 'none' }), { status: 200 });

test('切换账号立即卸载旧会话，原账号可恢复；不会显示其他账号记录', async () => {
  const state = initialGame(); state.selectedCharacter = 'zhixia';
  state.messages.zhixia = [{ id: 'private', role: 'user', content: '只有A可见', createdAt: 1 }];
  writeAccountGame(localStorage, 'A', state);
  const view = enterChat();
  expect(await screen.findByText('只有A可见', { selector: 'p' })).toBeTruthy();
  view.rerender(<GameApp userId="B" userEmail="b@example.test" />);
  expect(screen.queryByText('只有A可见')).toBeNull();
  await screen.findByRole('button', { name: /和她相遇/ });
  view.rerender(<GameApp userId="A" userEmail="a@example.test" />);
  expect(await screen.findByText('只有A可见', { selector: 'p' })).toBeTruthy();
});

test('失败后额度退回；重试复用同一条用户消息，错误不进入下一轮上下文', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('网络中断')).mockResolvedValueOnce(reply());
  enterChat(); await choose(); send('测试重试');
  fireEvent.keyDown(screen.getByPlaceholderText('和她说点什么…'), { key: 'Enter' });
  const retry = await screen.findByRole('button', { name: '重试发送' });
  expect(fetch).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game.textRemaining).toBe(100));
  fireEvent.click(retry);
  expect(await screen.findByText('已收到', { selector: 'p' })).toBeTruthy();
  const requests = vi.mocked(fetch).mock.calls;
  expect(JSON.parse(String(requests[1][1]?.body)).messages.filter((m: { content: string }) => m.content === '测试重试')).toHaveLength(1);
  expect(screen.getAllByText('测试重试')).toHaveLength(1);
  expect(screen.queryByText('网络中断')).toBeNull();
  expect(JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game.textRemaining).toBe(99);
});

test('快速重复发送仅产生一次请求；切换角色后回复仍归原角色', async () => {
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  enterChat(); await choose(); send('只发一次');
  fireEvent.keyDown(screen.getByPlaceholderText('和她说点什么…'), { key: 'Enter' });
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /唐可可.*在天台/ }));
  resolve(reply());
  await waitFor(() => expect(JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game.messages.zhixia.at(-1).content).toBe('已收到'));
  expect(screen.queryByText('已收到', { selector: 'p' })).toBeNull();
});

test.each(['{broken', ''])('损坏存档 %j 显示提示且不覆盖原文', async (raw) => {
  localStorage.setItem(accountStorageKey('A'), raw);
  enterChat();
  expect(await screen.findByText(/本地存档无法读取/)).toBeTruthy();
  await choose();
  expect(localStorage.getItem(accountStorageKey('A'))).toBe(raw);
});

test('切账号后晚到的旧请求被取消，不更新新账号', async () => {
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  const view = enterChat(); await choose(); send('A 的请求');
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  view.rerender(<GameApp userId="B" userEmail="b@example.test" />);
  expect(signal?.aborted).toBe(true);
  await act(async () => { resolve(reply()); });
  expect(screen.queryByText('已收到', { selector: 'p' })).toBeNull();
  expect(JSON.parse(localStorage.getItem(accountStorageKey('B'))!).game.messages).toEqual({});
});

test('退出成功后取消请求，晚到回复不再渲染', async () => {
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  enterChat(); await choose(); send('待完成');
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  fireEvent.click(screen.getByRole('button', { name: '退出' }));
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => { resolve(reply()); });
  expect(screen.queryByText('已收到', { selector: 'p' })).toBeNull();
});

test('退出失败仍保留原会话', async () => {
  mocks.signOut.mockResolvedValueOnce({ error: { message: 'offline' } });
  enterChat(); await choose();
  fireEvent.click(screen.getByRole('button', { name: '退出' }));
  expect(await screen.findByText('退出失败，请稍后重试')).toBeTruthy();
  expect(screen.getByPlaceholderText('和她说点什么…')).toBeTruthy();
});

test('50秒超时显示可重试状态，文字额度退回一次', async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')))));
  enterChat(); fireEvent.click(screen.getByRole('button', { name: /和她相遇/ })); send('超时测试');
  await act(async () => { await vi.advanceTimersByTimeAsync(50_001); });
  expect(screen.getByRole('button', { name: '重试发送' })).toBeTruthy();
  expect(screen.getByText('回复超时，请重试')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game.textRemaining).toBe(100);
});

test('图片请求阻塞180秒后标记失败且媒体额度只退回一次', async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ reply: '给你拍张照', mediaIntent: 'image' })));
  vi.mocked(fetch).mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')))));
  enterChat(); fireEvent.click(screen.getByRole('button', { name: /和她相遇/ }));
  await act(async () => { send('发张照片'); });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game.imageRemaining).toBe(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(180_001); });
  expect(screen.getByText('生成超时，请稍后再试', { selector: 'p' })).toBeTruthy();
  const game = JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game;
  expect(game.imageRemaining).toBe(3);
  expect(game.textRemaining).toBe(99);
  expect(game.messages.zhixia.at(-1)).toMatchObject({ failed: true, pending: false });
  await act(async () => { await vi.advanceTimersByTimeAsync(180_001); });
  expect(JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game.imageRemaining).toBe(3);
});

test('超时后晚到的有效回复不能留住 pending 或扣除额度', async () => {
  vi.useFakeTimers();
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  enterChat(); fireEvent.click(screen.getByRole('button', { name: /和她相遇/ })); send('晚到回复');
  await act(async () => { await vi.advanceTimersByTimeAsync(50_001); resolve(reply()); });
  expect(screen.getByRole('button', { name: '重试发送' })).toBeTruthy();
  expect(screen.queryByText('已收到', { selector: 'p' })).toBeNull();
  const game = JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game;
  expect(game.textRemaining).toBe(100);
  expect(game.messages.zhixia.at(-1)).toMatchObject({ role: 'user', failed: true, pending: false });
});

test.each(['image', 'voice', 'try-on'] as const)('%s 网络成功但媒体保存阻塞，超时退回一次额度并忽略晚到结果', async (kind) => {
  vi.useFakeTimers();
  let finishSave!: () => void;
  vi.mocked(saveMedia).mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  const media = () => Promise.resolve(new Response('asset', { headers: { 'Content-Type': 'image/png' } }));
  const view = enterChat(); fireEvent.click(screen.getByRole('button', { name: /和她相遇/ }));
  if (kind === 'try-on') {
    vi.mocked(fetch).mockImplementationOnce(media);
    fireEvent.click(screen.getByRole('button', { name: /给她换衣/ }));
    fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File(['shirt'], 'shirt.png', { type: 'image/png' })] } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /开始换衣/ })); });
  } else {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ reply: '给你看看', mediaIntent: kind })));
    vi.mocked(fetch).mockImplementationOnce(media);
    await act(async () => { send('测试媒体保存'); });
  }
  expect(finishSave).toBeTypeOf('function');
  const quota = kind === 'image' ? 'imageRemaining' : kind === 'voice' ? 'voiceRemaining' : 'tryOnRemaining';
  const stored = () => JSON.parse(localStorage.getItem(accountStorageKey('A'))!).game;
  expect(stored()[quota]).toBe(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(180_001); });
  expect(stored()[quota]).toBe(3);
  expect(stored().messages.zhixia.at(-1)).toMatchObject({ failed: true, pending: false });
  if (kind === 'try-on') expect((screen.getByRole('button', { name: '关闭换衣面板' }) as HTMLButtonElement).disabled).toBe(false);
  const failed = localStorage.getItem(accountStorageKey('A'));
  await act(async () => { finishSave(); });
  expect(localStorage.getItem(accountStorageKey('A'))).toBe(failed);
});

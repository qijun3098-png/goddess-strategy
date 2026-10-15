import { IDBFactory } from 'fake-indexeddb';
import { expect, test, vi } from 'vitest';
import { loadMedia, saveMedia } from '@/lib/mediaStore';

test('同名媒体键也不能跨账号读取；旧版共享数据库不被读取', async () => {
  const factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
  const asset = new Blob(['private-A'], { type: 'image/png' });
  await saveMedia('A', 'same-key', asset);
  expect(await loadMedia('B', 'same-key')).toBeUndefined();
  expect(await loadMedia('A', 'same-key')).toBeDefined();
  expect((await factory.databases()).map((db) => db.name).sort()).toEqual(['goddess-strategy-media-v2:A', 'goddess-strategy-media-v2:B']);
});

test('仅发生事务 abort 时保存拒绝并关闭数据库', async () => {
  const factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
  await saveMedia('abort-user', 'init', new Blob(['init']));
  const db = await new Promise<IDBDatabase>((resolve) => {
    const request = factory.open('goddess-strategy-media-v2:abort-user');
    request.onsuccess = () => resolve(request.result);
  });
  const close = vi.spyOn(db, 'close');
  const transaction = db.transaction('media', 'readwrite');
  vi.spyOn(db, 'transaction').mockReturnValue(transaction);
  vi.spyOn(factory, 'open').mockImplementation(() => {
    const request = {} as IDBOpenDBRequest;
    queueMicrotask(() => { Object.defineProperty(request, 'result', { value: db }); request.onsuccess?.(new Event('success')); });
    return request;
  });
  const saving = saveMedia('abort-user', 'asset', new Blob(['new']));
  queueMicrotask(() => transaction.abort());
  await expect(saving).rejects.toBeDefined();
  expect(close).toHaveBeenCalledOnce();
});

const DATABASE = 'goddess-strategy-media';
const STORE = 'media';

function openDatabase(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!userId.trim()) { reject(new Error('缺少媒体存档账号')); return; }
    const request = indexedDB.open(`${DATABASE}-v2:${encodeURIComponent(userId)}`, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMedia(userId: string, key: string, blob: Blob) {
  const db = await openDatabase(userId);
  try {
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('媒体保存已中止'));
  });
  } finally { db.close(); }
}

export async function loadMedia(userId: string, key: string) {
  const db = await openDatabase(userId);
  try {
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  return blob;
  } finally { db.close(); }
}

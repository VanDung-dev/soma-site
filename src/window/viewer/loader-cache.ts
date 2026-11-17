export interface ModelCache {
  storage: IDBDatabase;
  versions: Map<string, string>;
}

const DATABASE = 'human-atlas-site-v1';
const STORE = 'models';
const MANIFEST = 'models/z-anatomy/manifest.json';

export async function openModelCache(signal: AbortSignal): Promise<ModelCache | undefined> {
  try {
    if (!globalThis.indexedDB) return;
    const response = await fetch(`${import.meta.env.BASE_URL}${MANIFEST}`, { signal, cache: 'no-cache' });
    if (!response.ok) return;
    const manifest = await response.json() as { models: { file: string; sha256: string }[] };
    const versions = new Map(manifest.models.map(model => [`models/z-anatomy/${model.file}`, model.sha256]));
    const storage = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return { storage, versions };
  } catch {
    return;
  }
}

export async function readCachedModel(cache: ModelCache | undefined, path: string): Promise<ArrayBuffer | undefined> {
  const version = cache?.versions.get(path);
  if (!cache || !version) return;
  try {
    const saved = await new Promise<{ version: string; bytes: ArrayBuffer } | undefined>((resolve, reject) => {
      const request = cache.storage.transaction(STORE).objectStore(STORE).get(path);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (saved?.version === version) return saved.bytes;
  } catch {}
}

export async function writeCachedModel(cache: ModelCache | undefined, path: string, bytes: ArrayBuffer): Promise<void> {
  const version = cache?.versions.get(path);
  if (!cache || !version) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = cache.storage.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put({ version, bytes }, path);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  } catch {}
}

export function closeModelCache(cache: ModelCache | undefined): void {
  cache?.storage.close();
}

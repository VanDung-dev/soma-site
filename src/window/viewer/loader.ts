import type { StudyTarget } from "../catalog/types";
import type { PreparedGeometry } from "./contracts";

export async function loadModel(root: StudyTarget, signal: AbortSignal,
  ingest: (root: StudyTarget, json: string) => string[]): Promise<PreparedGeometry> {
  signal.throwIfAborted();
  const worker = new Worker(new URL("./model-worker.ts", import.meta.url), { type: "module" });
  const downloadAbort = new AbortController();
  let cache: { storage: IDBDatabase; versions: Map<string, string> } | undefined;
  const download = async (root: StudyTarget): Promise<{ bytes: Uint8Array; metadata: string } | { cause: unknown }> => {
    try {
      const model = root.model;
      const version = cache?.versions.get(model.path);
      const [response, metadataResponse] = await Promise.all([
        (async () => {
          if (version && cache) {
            try {
              const saved = await new Promise<{ version: string; bytes: ArrayBuffer } | undefined>((resolve, reject) => {
                const request = cache!.storage.transaction("models").objectStore("models").get(model.path);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              if (saved?.version === version) return saved.bytes;
            } catch {}
          }
          const fetched = await fetch(`${import.meta.env.BASE_URL}${model.path}`, { signal: downloadAbort.signal });
          if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
          const bytes = await fetched.arrayBuffer();
          if (version && cache) {
            try {
              await new Promise<void>((resolve, reject) => {
                const transaction = cache!.storage.transaction("models", "readwrite");
                transaction.objectStore("models").put({ version, bytes }, model.path);
                transaction.oncomplete = () => resolve();
                transaction.onabort = transaction.onerror = () => reject(transaction.error);
              });
            } catch {}
          }
          return bytes;
        })(),
        fetch(`${import.meta.env.BASE_URL}${model.path.replace(/\.glb(?:\.br)?$/, ".json")}`, { signal: downloadAbort.signal }),
      ]);
      if (!metadataResponse.ok) throw new Error(`HTTP ${metadataResponse.status}`);
      return { bytes: new Uint8Array(response), metadata: await metadataResponse.text() };
    } catch (cause) { return { cause }; }
  };
  let cancelPreparation: (() => void) | undefined;
  const cancel = () => { downloadAbort.abort(signal.reason); cancelPreparation?.(); };
  signal.addEventListener("abort", cancel);
  try {
    cache = await (async () => {
      try {
        if (!globalThis.indexedDB) return;
        const response = await fetch(`${import.meta.env.BASE_URL}models/z-anatomy/manifest.json`, { signal: downloadAbort.signal, cache: "no-cache" });
        if (!response.ok) return;
        const manifest = await response.json() as { models: { file: string; sha256: string }[] };
        const versions = new Map(manifest.models.map(model => [`models/z-anatomy/${model.file}`, model.sha256]));
        const storage = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("human-atlas-site-v1", 1);
          request.onupgradeneeded = () => request.result.createObjectStore("models");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return { storage, versions };
      } catch { return; }
    })();
    signal.throwIfAborted();
    const pkg = await download(root);
    signal.throwIfAborted();
    if ('cause' in pkg) throw pkg.cause;
    const ids = ingest(root, pkg.metadata);
    const prepared = await new Promise<PreparedGeometry>((resolve, reject) => {
      cancelPreparation = () => reject(new DOMException("Model loading cancelled", "AbortError"));
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data.prepared);
      worker.onerror = event => reject(new Error(event.message));
      worker.onmessageerror = () => reject(new Error("Cannot transfer prepared geometry"));
      worker.postMessage({ bytes: pkg.bytes, ids }, [pkg.bytes.buffer]);
    });
    cancelPreparation = undefined;
    signal.throwIfAborted();
    return prepared;
  } finally {
    downloadAbort.abort();
    cache?.storage.close();
    worker.terminate();
    signal.removeEventListener("abort", cancel);
  }
}

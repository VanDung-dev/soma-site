import type { StudyTarget } from '../catalog/types';
import type { PreparedGeometry } from './contracts';
import { closeModelCache, openModelCache, type ModelCache } from './loader-cache';
import { downloadModel } from './loader-download';

export async function loadModel(
  root: StudyTarget,
  signal: AbortSignal,
  ingest: (root: StudyTarget, json: string) => string[],
): Promise<PreparedGeometry> {
  signal.throwIfAborted();
  const worker = new Worker(new URL('./model-worker.ts', import.meta.url), { type: 'module' });
  const downloadAbort = new AbortController();
  let cache: ModelCache | undefined;
  let cancelPreparation: (() => void) | undefined;
  const cancel = () => {
    downloadAbort.abort(signal.reason);
    cancelPreparation?.();
  };
  signal.addEventListener('abort', cancel);
  try {
    cache = await openModelCache(downloadAbort.signal);
    signal.throwIfAborted();
    const pkg = await downloadModel(root, cache, downloadAbort.signal);
    signal.throwIfAborted();
    if ('cause' in pkg) throw pkg.cause;
    const ids = ingest(root, pkg.metadata);
    const prepared = await new Promise<PreparedGeometry>((resolve, reject) => {
      cancelPreparation = () => reject(new DOMException('Model loading cancelled', 'AbortError'));
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data.prepared);
      worker.onerror = event => reject(new Error(event.message));
      worker.onmessageerror = () => reject(new Error('Cannot transfer prepared geometry'));
      worker.postMessage({ bytes: pkg.bytes, ids }, [pkg.bytes.buffer]);
    });
    cancelPreparation = undefined;
    signal.throwIfAborted();
    return prepared;
  } finally {
    downloadAbort.abort();
    closeModelCache(cache);
    worker.terminate();
    signal.removeEventListener('abort', cancel);
  }
}

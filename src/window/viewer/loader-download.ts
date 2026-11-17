import type { StudyTarget } from '../catalog/types';
import { readCachedModel, writeCachedModel, type ModelCache } from './loader-cache';

export interface ModelPackage {
  bytes: Uint8Array;
  metadata: string;
}

export function metadataPath(modelPath: string): string {
  return modelPath.replace(/\.glb(?:\.br)?$/, '.json');
}

export async function downloadModel(
  root: StudyTarget,
  cache: ModelCache | undefined,
  signal: AbortSignal,
): Promise<ModelPackage | { cause: unknown }> {
  try {
    const model = root.model;
    const [response, metadataResponse] = await Promise.all([
      (async () => {
        const cached = await readCachedModel(cache, model.path);
        if (cached) return cached;
        const fetched = await fetch(`${import.meta.env.BASE_URL}${model.path}`, { signal });
        if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
        const bytes = await fetched.arrayBuffer();
        await writeCachedModel(cache, model.path, bytes);
        return bytes;
      })(),
      fetch(`${import.meta.env.BASE_URL}${metadataPath(model.path)}`, { signal }),
    ]);
    if (!metadataResponse.ok) throw new Error(`HTTP ${metadataResponse.status}`);
    return { bytes: new Uint8Array(response), metadata: await metadataResponse.text() };
  } catch (cause) {
    return { cause };
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import manifest from '../public/models/z-anatomy/manifest.json' with { type: 'json' };

const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

test('the compressed skeletal package preserves the original geometry and source IDs', () => {
  const model = manifest.models[0]!;
  const compressed = fs.readFileSync(new URL(`../public/models/z-anatomy/${model.file}`, import.meta.url));
  assert.equal(hash(compressed), model.sha256);
  const bytes = brotliDecompressSync(compressed);
  assert.equal(bytes.length, model.uncompressed_bytes);
  assert.equal(hash(bytes), model.uncompressed_sha256);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const metadata = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))) as {
    meshes: unknown[];
    nodes: { mesh?: number; extras?: { source_id?: string } }[];
  };
  assert.equal(metadata.meshes.length, 277);
  assert.ok(metadata.nodes.every(node => node.mesh === undefined || node.extras?.source_id));
  assert.deepEqual(new Set(metadata.nodes.filter(node => node.mesh !== undefined).map(node => node.extras!.source_id)), new Set(model.source_ids));
});

test('redistributed source assets include attribution and licenses', () => {
  for (const path of ['LICENSE', 'NOTICE', 'public/models/z-anatomy/ATTRIBUTION.md', 'public/home/ATTRIBUTION.md', 'public/icons/ATTRIBUTION.md', 'public/fonts/Lato-OFL.txt', 'public/fonts/Merriweather-OFL.txt', 'public/licenses/line-md-MIT.txt', 'public/licenses/bootstrap-icons-MIT.txt']) {
    assert.ok(fs.statSync(new URL(`../${path}`, import.meta.url)).size > 100, path);
  }
});

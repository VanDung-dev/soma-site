import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import snapshot from '../UPSTREAM.json' with { type: 'json' };
import catalog from '../content/catalog.json' with { type: 'json' };
import metadata from '../public/models/z-anatomy/skeletal-system.json' with { type: 'json' };
import regions from '../fixtures/regions.json' with { type: 'json' };

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

test('fork records removed files and preserves hashes for retained upstream sources', () => {
  const adapted = new Set(snapshot.adaptations.map(item => item.path));
  for (const [source, expected] of Object.entries(snapshot.files)) {
    const local = source.startsWith('apps/web/src/') ? `src/window/${source.slice('apps/web/src/'.length).replace(/^anatomy\//, '')}`
      : source.startsWith('apps/web/public/') ? `public/${source.slice('apps/web/public/'.length)}`
      : source === 'content/catalog.json' ? 'fixtures/upstream-catalog.json' : source;
    if (snapshot.removed.includes(local)) assert.equal(fs.existsSync(path.join(root, local)), false, local);
    else if (!adapted.has(local)) assert.equal(hash(local), expected, local);
  }
});

test('demo catalog and metadata cover the same skeletal source identities', () => {
  assert.equal(catalog.groups.length, 1);
  const roots = catalog.targets.filter(target => 'model' in target);
  assert.equal(roots.length, 1);
  const geometryIds = new Set(roots[0]!.model!.structure_ids);
  assert.equal(geometryIds.size, 277);
  assert.deepEqual(new Set(metadata.structures.map(part => part.source_id)), geometryIds);
  for (const target of catalog.targets) assert.ok(target.structure_ids.every(id => geometryIds.has(id)), target.id);
  for (const id of Object.values(regions)) assert.ok(catalog.targets.find(target => target.id === id)!.structure_ids.length > 0, id);
});

test('demo source imports stay inside the standalone site', () => {
  const walk = (folder: string): string[] => fs.readdirSync(folder, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(folder, item.name)) : /\.[cm]?[jt]sx?$/.test(item.name) ? [path.join(folder, item.name)] : []);
  for (const file of walk(path.join(root, 'src'))) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*\(|new URL\()\s*["'](\.[^"']+)["']/g)) {
      assert.ok(path.resolve(path.dirname(file), match[1]!).startsWith(`${root}${path.sep}`), `${file}: ${match[1]}`);
    }
  }
});

test('skeletal chapters use source groups and include both girdles in the limbs', () => {
  const axial = catalog.targets.find(target => target.id === regions.axial)!;
  const appendicular = catalog.targets.find(target => target.id === regions.appendicular)!;
  assert.equal(axial.source_name, 'Axial skeleton');
  assert.equal(appendicular.source_name, 'Appendicular skeleton');
  for (const part of metadata.structures.filter(part => ['Clavicle', 'Scapula', 'Hip bone'].includes(part.source_name))) {
    assert.ok(appendicular.structure_ids.includes(part.source_id), part.source_name);
  }
  for (const part of metadata.structures.filter(part => /sternum/i.test(part.source_name))) {
    assert.ok(axial.structure_ids.includes(part.source_id), part.source_name);
  }
});

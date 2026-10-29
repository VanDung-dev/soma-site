import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Group, Object3D, RawShaderMaterial, Vector4 } from 'three';
import { hideOmittedStructures, setMaterialEmphasis, skeletalGroup } from '../src/model-visibility.ts';

test('context fades without accumulating opacity and restores source material settings', () => {
  const material = new RawShaderMaterial({ uniforms: { base_color: { value: new Vector4(0.3, 0.4, 0.5, 0.8) }, alpha_cutoff: { value: 0.25 } } });
  const source = { opacity: 0.8, alphaTest: 0.25, transparent: false, depthWrite: true };
  for (let i = 0; i < 3; i++) setMaterialEmphasis(material, source, 0.12);
  assert.deepEqual(material.uniforms.base_color!.value.toArray(), [0.3, 0.4, 0.5, 0.8 * 0.12]);
  assert.equal(material.uniforms.alpha_cutoff!.value, 0.25 * 0.12);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  setMaterialEmphasis(material, source, 1);
  assert.equal(material.uniforms.base_color!.value.w, 0.8);
  assert.equal(material.uniforms.alpha_cutoff!.value, 0.25);
  assert.equal(material.transparent, false);
  assert.equal(material.depthWrite, true);
  setMaterialEmphasis(material, { ...source, transparent: true, depthWrite: false }, 1);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
});

test('skeletal groups keep source parts together without overlapping the spine and thorax', () => {
  const bytes = fs.readFileSync(new URL('../public/models/skeletal-system.glb', import.meta.url));
  const metadata = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))) as {
    nodes: { mesh?: number; extras: Record<string, unknown> & { source_name: string; source_parent?: string } }[];
  };
  const groups = metadata.nodes.filter(node => node.mesh !== undefined).map(node => ({ ...node.extras, group: skeletalGroup(node.extras) }));
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(group => groups.filter(part => part.group === group).length), [47, 70, 26, 64, 64, 6]);
  assert.ok(groups.filter(part => part.source_parent === 'Ethmoid bone').every(part => part.group === 1));
  assert.ok(groups.filter(part => /^Vertebra T/.test(String(part.source_name))).every(part => part.group === 2));
  assert.ok(groups.filter(part => ['Clavicle', 'Scapula'].includes(String(part.source_name))).every(part => part.group === 3));
  assert.ok(groups.filter(part => part.source_name === 'Hip bone').every(part => part.group === 4));
  assert.ok(groups.filter(part => part.group === 5).every(part => /cartilage/i.test(String(part.source_name))));
});

test('model hides the requested structures on both sides', () => {
  const bytes = fs.readFileSync(new URL('../public/models/skeletal-system.glb', import.meta.url));
  const metadata = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))) as {
    nodes: { mesh?: number; extras?: { source_name?: string } }[];
  };
  const model = new Group();
  for (const node of metadata.nodes.filter((item) => item.mesh !== undefined)) {
    const object = new Object3D();
    object.userData = node.extras ?? {};
    model.add(object);
  }
  hideOmittedStructures(model);
  const hidden = model.children.filter((object) => !object.visible).map((object) => object.userData.source_name).sort();
  assert.deepEqual(hidden, [
    'Cricoid cartilage', 'Hyoid bone',
    'Lateral process of nasal septal cartilage', 'Lateral process of nasal septal cartilage',
    'Major alar cartilage', 'Major alar cartilage',
    'Nasal septal cartilage', 'Thyroid cartilage',
  ]);
  assert.equal(model.children.length, 277);
});

test('public model preserves the original decompressed skeletal package', () => {
  const bytes = fs.readFileSync(new URL('../public/models/skeletal-system.glb', import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'a960d8aa584b306c0cdb2859d48d50b0f170671758a2f318ea23baa5f36b6abd');
  const metadata = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))) as {
    meshes: unknown[];
    nodes: { mesh?: number; extras?: { source_id?: string } }[];
  };
  assert.equal(metadata.meshes.length, 277);
  assert.ok(metadata.nodes.every((node) => node.mesh === undefined || node.extras?.source_id));
});

test('redistributed source assets include attribution and licenses', () => {
  for (const path of ['LICENSE', 'NOTICE', 'public/models/z-anatomy/ATTRIBUTION.md', 'public/home/ATTRIBUTION.md', 'public/icons/ATTRIBUTION.md', 'public/fonts/Lato-OFL.txt', 'public/fonts/Merriweather-OFL.txt', 'public/licenses/three-MIT.txt', 'public/licenses/line-md-MIT.txt']) {
    assert.ok(fs.statSync(new URL(`../${path}`, import.meta.url)).size > 100, path);
  }
});

test('page foundation is copied from the application stylesheet', () => {
  const data = fs.readFileSync(new URL('../pages.css', import.meta.url));
  assert.equal(createHash('sha256').update(data).digest('hex'), '8d7d369462cab54f477b6fd12fc5d0c24e86d289baf48a92b146807c0ee1b39f');
});

test('grid shaders are copied unchanged from Anatomy', () => {
  for (const [file, hash] of [
    ['sphere.vert.glsl', '9db828e81ec10a1b40f97158e7e22aad687fa86995dcefa03a9e3274af1f2ea0'],
    ['sphere.frag.glsl', '3069cccd12176a9190898d54aa74c4b0cc944bddd701fb7df60236cd247de3d7'],
  ]) {
    const data = fs.readFileSync(new URL(`../src/shaders/${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'), hash);
  }
});

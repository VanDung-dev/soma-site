import type { MeshStandardMaterial, Object3D, RawShaderMaterial } from 'three';

export function setMaterialEmphasis(material: RawShaderMaterial, source: Pick<MeshStandardMaterial, 'opacity' | 'alphaTest' | 'transparent' | 'depthWrite'>, emphasis: number): void {
  material.uniforms.base_color!.value.w = source.opacity * emphasis;
  material.uniforms.alpha_cutoff!.value = source.alphaTest * emphasis;
  material.transparent = source.transparent || emphasis < 1;
  material.depthWrite = source.depthWrite && emphasis === 1;
}

export const skeletalGroups = ['thorax', 'head', 'spine', 'upper', 'lower', 'other'] as const;

export function skeletalGroup(data: Record<string, unknown>): number {
  const collections = Array.isArray(data.collections) ? data.collections : [];
  if (collections.includes('Vertebral column')) return 2;
  if (collections.includes('Thoracic skeleton')) return 0;
  if (collections.includes('Head') || data.source_parent === 'Ethmoid bone') return 1;
  if (collections.includes('Appendicular skeleton')) {
    if (collections.some(name => typeof name === 'string' && name.includes('upper limb'))) return 3;
    if (collections.some(name => typeof name === 'string' && name.includes('lower limb'))) return 4;
  }
  return 5;
}

const omittedStructures = new Set([
  'Hyoid bone',
  'Thyroid cartilage',
  'Cricoid cartilage',
  'Arytenoid cartilage',
  'Corniculate cartilage',
  'Lateral process of nasal septal cartilage',
  'Nasal septal cartilage',
  'Major alar cartilage',
]);

export function hideOmittedStructures(model: Object3D): void {
  model.traverse((object) => {
    if (omittedStructures.has(object.userData.source_name)) object.visible = false;
  });
}


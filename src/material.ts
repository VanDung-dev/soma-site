import { GLSL3, Matrix3, Matrix4, RawShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import type { MeshStandardMaterial } from 'three';
import vertexShader from './shaders/model.vert.glsl?raw';
import fragmentShader from './shaders/model.frag.glsl?raw';

export function sourceMaterial(source: MeshStandardMaterial): RawShaderMaterial {
  return new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader: fragmentShader.replace('#version 300 es', ''),
    side: source.side,
    transparent: source.transparent,
    depthWrite: source.depthWrite,
    uniforms: {
      eye: { value: new Vector3() },
      light_basis: { value: new Matrix3() },
      base_color: { value: new Vector4(source.color.r, source.color.g, source.color.b, source.opacity) },
      roughness: { value: source.roughness },
      metallic: { value: source.metalness },
      specular: { value: source.userData.source_specular ?? 0.04 },
      subsurface: { value: source.userData.source_subsurface ?? 0 },
      alpha_cutoff: { value: source.alphaTest },
      selected: { value: false },
      picking: { value: false },
      pick_color: { value: new Vector3() },
      reveal: { value: 1 },
      shadow_pass: { value: false },
      shadow_projection: { value: new Matrix4() },
      shadow_map: { value: null },
      shadow_texel: { value: new Vector2() },
      shadow_offset: { value: 0 },
      shadow_quality: { value: 0 },
      lighting_quality: { value: 2 },
    },
  });
}

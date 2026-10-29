import { BufferGeometry, Camera, Float32BufferAttribute, GLSL3, Matrix4, Mesh, RawShaderMaterial, Scene, Vector4, WebGLRenderer } from 'three';
import type { Sphere } from 'three';
import vertexShader from './shaders/sphere.vert.glsl?raw';
import fragmentShader from './shaders/sphere.frag.glsl?raw';
import { grid_projection } from './wasm/human_atlas_site_wasm.js';

export function createGrid(canvas: HTMLCanvasElement, enclosure: Sphere) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  const camera = new Camera();
  const scene = new Scene();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const inverse = new Matrix4();
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: vertexShader.replace('#version 300 es', ''),
    fragmentShader: fragmentShader.replace('#version 300 es', ''),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      inverse_projection: { value: inverse },
      sphere_origin: { value: new Vector4(enclosure.center.x, enclosure.center.y, enclosure.center.z, enclosure.radius * 6) },
    },
  });
  const backdrop = new Mesh(geometry, material);
  backdrop.frustumCulled = false;
  scene.add(backdrop);
  let width = 0, height = 0;
  return {
    render(x: number, y: number, span: number, yaw: number, pitch: number): void {
      if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return;
      if (width !== canvas.clientWidth || height !== canvas.clientHeight) {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        renderer.setSize(width, height, false);
      }
      inverse.fromArray(grid_projection(enclosure.radius, width / height, x, y, span, yaw, pitch));
      renderer.render(scene, camera);
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

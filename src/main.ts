import "../fonts.css";
import "../theme.css";
import "../pages.css";
import "../style.css";
import { renderLandingPage } from "./page.ts";
import { initLanguage, t } from "./i18n.ts";
import type { MessageKey } from "./i18n.ts";
import { initTheme } from "./theme.ts";
import { hideOmittedStructures, setMaterialEmphasis, skeletalGroup, skeletalGroups } from './model-visibility.ts';
import type { Group, Material, Mesh, RawShaderMaterial, WebGLRenderer } from 'three';
import type { ScrollCamera } from './wasm/human_atlas_site_wasm.js';

renderLandingPage(document.querySelector<HTMLElement>("#root")!);
initLanguage();
initTheme();

const stage = document.querySelector<HTMLElement>('.stage')!;
const canvas = document.querySelector<HTMLCanvasElement>('#anatomy')!;
const status = document.querySelector<HTMLElement>('#load-status')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const specimenName = document.querySelector<HTMLElement>('#specimen-name')!;
const specimenIndex = document.querySelector<HTMLElement>('#specimen-index')!;
const journey = document.querySelector<HTMLElement>('#journey')!;
const viewport = document.querySelector<HTMLElement>('.site-scroll')!;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const labelLayers = [...document.querySelectorAll<HTMLElement>('.model-labels')];
const chapters = [...document.querySelectorAll<HTMLElement>('.chapter')];
let dispose = () => {};

function setStatus(key: MessageKey | null): void {
  if (key) status.dataset.i18n = key;
  else delete status.dataset.i18n;
  status.textContent = key ? t(key) : "";
}

async function loadScene(): Promise<void> {
  dispose();
  setStatus('site.loading');
  retry.hidden = true;
  let renderer: WebGLRenderer | undefined;
  let model: Group | undefined;
  let cameraController: ScrollCamera | undefined;
  let grid: ReturnType<typeof import('./grid.ts').createGrid> | undefined;
  let frame = 0;
  let resizeObserver: ResizeObserver | undefined;
  const abort = new AbortController();
  const cleanup = () => {
    abort.abort();
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    cameraController?.free();
    cameraController = undefined;
    grid?.dispose();
    grid = undefined;
    const materials = new Set<Material>();
    model?.traverse((object) => {
      if (!('isMesh' in object) || !object.isMesh) return;
      const mesh = object as Mesh;
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    for (const material of materials) material.dispose();
    model = undefined;
    renderer?.dispose();
    renderer = undefined;
    delete stage.dataset.ready;
    for (const layer of labelLayers) layer.hidden = true;
  };
  dispose = cleanup;
  try {
    const [THREE, { GLTFLoader }, wasm, { sourceMaterial }, { createGrid }] = await Promise.all([
      import('three'), import('three/addons/loaders/GLTFLoader.js'),
      import('./wasm/human_atlas_site_wasm.js'), import('./material.ts'),
      import('./grid.ts'),
    ]);
    await wasm.default();
    abort.signal.throwIfAborted();
    const scrollCamera = new wasm.ScrollCamera();
    cameraController = scrollCamera;
    const sceneRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer = sceneRenderer;
    sceneRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    sceneRenderer.setClearColor(0x000000, 0);
    sceneRenderer.toneMapping = THREE.NoToneMapping;
    const response = await fetch(`${import.meta.env.BASE_URL}models/skeletal-system.glb`, { signal: abort.signal });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    const skeleton = gltf.scene;
    model = skeleton;
    abort.signal.throwIfAborted();
    hideOmittedStructures(skeleton);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 12);
    scene.add(skeleton);
    const enclosure = new THREE.Box3().setFromObject(skeleton).getBoundingSphere(new THREE.Sphere());
    const groups = skeletalGroups.map(name => {
      const group = new THREE.Group();
      group.name = name;
      return group;
    });
    const parts: import('three').Object3D[] = [];
    skeleton.updateMatrixWorld(true);
    skeleton.traverse((object) => {
      if (object.userData.source_id) parts.push(object);
    });
    skeleton.add(...groups);
    for (const part of parts) groups[skeletalGroup(part.userData)]!.attach(part);
    const anchors: { object: import('three').Object3D; point: import('three').Vector3; label: HTMLElement }[] = [];
    for (const label of document.querySelectorAll<HTMLElement>('.group-labels .model-label')) {
      const group = groups[Number(label.dataset.group)]!;
      const bounds = new THREE.Box3().setFromObject(group);
      const point = bounds.getCenter(new THREE.Vector3());
      anchors.push({ object: group, point, label });
    }
    const overviewLabels = document.querySelector<HTMLElement>('.overview-labels')!;
    for (const object of parts) {
      const overviewName = object.userData.source_name === 'Frontal bone' ? 'head'
        : object.userData.source_name === 'Body of sternum' ? 'chest'
        : object.userData.source_name === 'Sacrum' ? 'pelvis' : '';
      const overviewLabel = overviewLabels.querySelector<HTMLElement>(`[data-part="${overviewName}"]`);
      if (overviewLabel) {
        const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
        anchors.push({ object, point: object.worldToLocal(center), label: overviewLabel });
      }
    }
    const backgroundGrid = createGrid(document.querySelector<HTMLCanvasElement>('.workspace-grid')!, enclosure);
    grid = backgroundGrid;
    const sourceMaterials = new Set<Material>();
    const materials: { material: RawShaderMaterial; group: number; source: Pick<import('three').MeshStandardMaterial, 'opacity' | 'alphaTest' | 'transparent' | 'depthWrite'> }[] = [];
    groups.forEach((root, group) => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
        const source = object.material;
        sourceMaterials.add(source);
        const material = sourceMaterial(source);
        object.material = material;
        materials.push({ material, group, source: {
          opacity: source.opacity, alphaTest: source.alphaTest, transparent: source.transparent, depthWrite: source.depthWrite,
        } });
      });
    });
    for (const material of sourceMaterials) material.dispose();
    const draw = () => {
      frame = 0;
      if (document.hidden) return;
      const tops = chapters.map((chapter) => chapter.offsetTop);
      const scroll = Math.max(0, viewport.scrollTop);
      let target = chapters.length - 1;
      for (let i = 0; i < tops.length - 1; i++) {
        if (scroll < tops[i + 1]!) {
          target = i + Math.max(0, (scroll - tops[i]!) / (tops[i + 1]! - tops[i]!));
          break;
        }
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;
      const pose = scrollCamera.frame(target, motion.matches, width / height);
      camera.left = pose[1]!;
      camera.right = pose[2]!;
      camera.top = pose[3]!;
      camera.bottom = pose[4]!;
      const centered = matchMedia('(max-width: 700px)').matches
        || pose[6]! >= 2 && pose[6]! <= 6 && matchMedia('(max-width: 1050px)').matches;
      const x = centered ? 0 : pose[9]! * (pose[2]! - pose[1]!);
      camera.position.set(x, pose[0]! + 4 * Math.sin(pose[8]!), 4 * Math.cos(pose[8]!));
      camera.lookAt(x, pose[0]!, 0);
      camera.updateProjectionMatrix();
      skeleton.rotation.y = pose[5]!;
      for (const layer of labelLayers) layer.hidden = !pose[7] || Number(layer.dataset.chapter) !== pose[6];
      if (labelLayers.some(layer => !layer.hidden)) {
        skeleton.updateMatrixWorld(true);
        camera.updateMatrixWorld();
        for (const anchor of anchors) {
          if (anchor.label.parentElement!.hidden) continue;
          const point = anchor.object.localToWorld(anchor.point.clone()).project(camera);
          anchor.label.style.left = `${canvas.offsetLeft + (point.x + 1) * width / 2}px`;
          anchor.label.style.top = `${canvas.offsetTop + (1 - point.y) * height / 2}px`;
        }
      }
      backgroundGrid.render(x, pose[0]!, pose[3]! - pose[4]!, pose[5]!, pose[8]!);
      for (const { material, source, group } of materials) {
        material.uniforms.eye!.value.copy(camera.position);
        setMaterialEmphasis(material, source, pose[10 + group]!);
      }
      sceneRenderer.render(scene, camera);
      const figure = String(pose[6]! + 1).padStart(2, '0');
      const key = `site.figure.${figure}` as MessageKey;
      specimenName.dataset.i18n = key;
      specimenName.textContent = t(key);
      const indexKey = `site.figure.index.${figure}` as MessageKey;
      specimenIndex.dataset.i18n = indexKey;
      specimenIndex.textContent = t(indexKey);
      stage.dataset.chapter = figure;
      if (!pose[7] && scroll < journey.offsetTop + journey.offsetHeight) requestDraw();
    };
    const requestDraw = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); };
    const resize = () => {
      sceneRenderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      requestDraw();
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    viewport.addEventListener('scroll', requestDraw, { passive: true, signal: abort.signal });
    document.addEventListener('visibilitychange', requestDraw, { signal: abort.signal });
    motion.addEventListener('change', requestDraw, { signal: abort.signal });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      cleanup();
      setStatus('site.contextLost');
      retry.hidden = false;
    }, { signal: abort.signal });
    resize();
    stage.dataset.ready = '';
    setStatus(null);
  } catch (error) {
    cleanup();
    if (error instanceof Error && error.name === 'AbortError') return;
    setStatus('site.loadError');
    retry.hidden = false;
  }
}

retry.addEventListener('click', loadScene);
window.addEventListener('pagehide', () => dispose());
window.addEventListener('pageshow', (event) => { if (event.persisted) loadScene(); });
loadScene();

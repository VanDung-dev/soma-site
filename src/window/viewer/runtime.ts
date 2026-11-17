import type { Catalog } from '../catalog/types';
import { getWasm } from '../core';
import type { AnatomyViewer } from '../../generated/viewer/wasm';
import type { Presentation, ViewerError, ViewerOptions } from './contracts';
import { loadModel } from './loader';
import { PresentationController } from './presentation-controller';
import { renderPixelSize, SurfaceMetrics } from './surface';

export class ViewerRuntime {
  private viewer: AnatomyViewer | undefined;
  private canvas = document.createElement('canvas');
  private viewport: HTMLElement;
  private surface: SurfaceMetrics;
  private presentation = new PresentationController();
  private renderLimit = 4096;
  private abort = new AbortController();
  private motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private observer: ResizeObserver;
  private disposed = false;
  private failed = false;
  private loading = true;
  private ready = false;
  private structureIds: string[] = [];
  private renderFrame = 0;
  private resizePending = false;
  private backdrop = 0;

  constructor(private host: HTMLElement, private options: ViewerOptions) {
    this.viewport = host.closest<HTMLElement>('.stage')!;
    this.surface = new SurfaceMetrics(host, this.viewport);
    this.canvas.setAttribute('role', 'img');
    this.canvas.tabIndex = -1;
    this.viewport.appendChild(this.canvas);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.observer.observe(this.viewport);
    this.motion.addEventListener('change', this.motionChanged);
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
  }

  async start(catalog: Catalog) {
    try {
      if (catalog.roots.length !== 1) throw new Error('The demo requires one model package');
      const [wasm, prepared] = await Promise.all([
        getWasm(),
        loadModel(catalog.roots[0]!, this.abort.signal, (root, json) => catalog.ingestMetadata(root, json)),
      ]);
      if (this.disposed) return;
      this.viewer = wasm.AnatomyViewer.fromPrepared(this.canvas, prepared);
      const gl = this.canvas.getContext('webgl2')!;
      this.renderLimit = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
      this.resizeCanvas();
      this.structureIds = catalog.identities();
      this.loading = false;
      this.scheduleRender();
    } catch (cause) {
      if (!this.disposed) this.fail(cause, 'loadError');
    }
  }

  private fail(cause: unknown, status: ViewerError) {
    this.failed = true;
    this.abort.abort();
    console.error(cause);
    this.options.onError(status);
  }

  scheduleRender = () => {
    if (this.renderFrame || this.disposed) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = 0;
      if (this.disposed) return;
      try {
        if (!this.loading && this.viewer && !this.failed && !this.ready) this.options.onReady(this.structureIds);
        this.options.onBeforeRender();
        if (this.loading || !this.viewer || this.failed) return;
        if (this.resizePending) this.resizeCanvas();
        this.updateRenderRegion();
        const now = performance.now();
        const cameraAnimating = this.viewer.advance_camera(now);
        this.viewer.set_backdrop(this.backdrop);
        const revealing = this.viewer.advance_reconstruction(now);
        this.viewer.render();
        this.ready = true;
        if (cameraAnimating || revealing) this.scheduleRender();
        else if (!this.renderFrame) this.options.onSettled();
      } catch (cause) { this.fail(cause, 'renderError'); }
    });
  };

  private resize = () => {
    this.resizePending = true;
    this.scheduleRender();
  };

  private resizeCanvas() {
    this.resizePending = false;
    const viewport = this.surface.measureViewport();
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const size = renderPixelSize(viewport, this.renderLimit);
    if (this.canvas.width !== size.width || this.canvas.height !== size.height) this.viewer!.resize(size.width, size.height);
    this.updateRenderRegion();
    this.presentation.reflow(this.viewer!, this.options.viewport, !this.motion.matches);
  }

  private updateRenderRegion() {
    const region = this.surface.region();
    if (!region) return;
    this.canvas.style.clipPath = region.clipPath;
    this.viewer!.set_render_region(region.left, region.top, region.width, region.height, region.aspect);
  }

  present(visible: string[], focus: string[], yaw: number, spread: boolean, viewport: Presentation['viewport']) {
    if (!this.viewer || this.failed || this.disposed) return;
    try {
      this.presentation.present(this.viewer, { visible, focus, yaw, spread, viewport }, this.ready && !this.motion.matches);
      this.scheduleRender();
    } catch (cause) { this.fail(cause, 'processError'); }
  }

  beginScrollTransition(from: Presentation, to: Presentation, progress: number) {
    if (!this.viewer || this.failed || this.disposed) return;
    try {
      this.presentation.beginScroll(this.viewer, from, to, progress);
      this.scheduleRender();
    } catch (cause) { this.fail(cause, 'processError'); }
  }

  setScrollProgress(progress: number) {
    if (!this.viewer || this.failed || this.disposed) return;
    try {
      this.presentation.setScrollProgress(this.viewer, progress);
      this.scheduleRender();
    } catch (cause) { this.fail(cause, 'processError'); }
  }

  setBackdrop(opacity: number) {
    if (this.backdrop === opacity) return;
    this.backdrop = opacity;
    this.scheduleRender();
  }

  private motionChanged = () => {
    if (this.loading || !this.motion.matches || !this.viewer || this.failed || this.disposed) return;
    try {
      this.presentation.finishScroll(this.viewer);
      this.viewer.finish_reconstruction();
      this.viewer.finish_camera_transition();
      this.scheduleRender();
    } catch (cause) { this.fail(cause, 'renderError'); }
  };

  private contextLost = (event: Event) => {
    event.preventDefault();
    if (!this.disposed) this.fail(new Error('WebGL context lost'), 'contextLost');
  };

  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.observer.disconnect();
    this.motion.removeEventListener('change', this.motionChanged);
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    cancelAnimationFrame(this.renderFrame);
    this.viewer?.free();
    this.viewer = undefined;
    this.canvas.remove();
  }
}

import type { Catalog } from '../catalog/types';
import { getWasm } from '../core';
import type { AnatomyViewer } from '../../generated/viewer/wasm';
import type { ViewerError, Viewport } from './contracts';
import { loadModel } from './loader';

type Presentation = { visible: string[]; focus: string[]; yaw: number; spread: boolean; viewport: Viewport };

export class ViewerRuntime {
  private viewer: AnatomyViewer | undefined;
  private canvas = document.createElement('canvas');
  private viewport: HTMLElement;
  private viewportBounds = new DOMRect();
  private hostWidth = 1;
  private hostRadius = 0;
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
  private presentation: Presentation | undefined;
  private scrollPresentation: { from: Presentation; to: Presentation; progress: number } | undefined;

  constructor(private host: HTMLElement, private options: {
    viewport: Viewport;
    onBeforeRender: () => void;
    onReady: (ids: string[]) => void;
    onError: (status: ViewerError) => void;
    onSettled: () => void;
  }) {
    this.viewport = host.closest<HTMLElement>('.stage')!;
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
        if (this.resizePending) {
          this.resizeCanvas();
        }
        this.updateRenderRegion();
        const now = performance.now();
        const cameraAnimating = this.viewer!.advance_camera(now);
        this.viewer!.set_backdrop(this.backdrop);
        const revealing = this.viewer!.advance_reconstruction(now);
        this.viewer!.render();
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
    this.viewportBounds = this.viewport.getBoundingClientRect();
    const { width, height } = this.viewportBounds;
    if (width > 0 && height > 0) {
      const style = getComputedStyle(this.host);
      this.hostWidth = parseFloat(style.width);
      this.hostRadius = parseFloat(style.borderTopLeftRadius);
      const ratio = Math.min(window.devicePixelRatio, 2, this.renderLimit / width, this.renderLimit / height);
      const renderWidth = Math.max(1, Math.round(width * ratio));
      const renderHeight = Math.max(1, Math.round(height * ratio));
      if (this.canvas.width !== renderWidth || this.canvas.height !== renderHeight) this.viewer!.resize(renderWidth, renderHeight);
      this.updateRenderRegion();
      if (this.scrollPresentation) {
        const { from, to, progress } = this.scrollPresentation;
        this.presentation = from;
        this.applyPresentation(false);
        this.viewer!.begin_scroll_transition(to.focus, to.viewport, to.yaw, to.spread);
        this.presentation = to;
        this.viewer!.set_scroll_progress(progress);
      } else if (this.presentation) this.applyPresentation(!this.motion.matches);
      else this.viewer!.reframe(...this.options.viewport);
    }
  }

  private updateRenderRegion() {
    const host = this.host.getBoundingClientRect();
    const viewport = this.viewportBounds;
    if (host.width <= 0 || host.height <= 0) return;
    const radius = this.hostRadius * host.width / this.hostWidth;
    this.canvas.style.clipPath = `inset(${host.top - viewport.top}px ${viewport.right - host.right}px ${viewport.bottom - host.bottom}px ${host.left - viewport.left}px round ${radius}px)`;
    this.viewer!.set_render_region((viewport.left - host.left) / host.width, (viewport.top - host.top) / host.height, viewport.width / host.width, viewport.height / host.height, host.width / host.height);
  }

  present(visible: string[], focus: string[], yaw: number, spread: boolean, viewport: Viewport) {
    if (!this.viewer || this.failed || this.disposed) return;
    this.scrollPresentation = undefined;
    this.presentation = { visible, focus, yaw, spread, viewport };
    try {
      this.applyPresentation(this.ready && !this.motion.matches);
      this.scheduleRender();
    } catch (cause) { this.fail(cause, 'processError'); }
  }

  beginScrollTransition(from: Presentation, to: Presentation, progress: number) {
    if (!this.viewer || this.failed || this.disposed) return;
    try {
      this.presentation = from;
      this.applyPresentation(false);
      this.viewer.begin_scroll_transition(to.focus, to.viewport, to.yaw, to.spread);
      this.presentation = to;
      this.scrollPresentation = { from, to, progress };
      this.viewer.set_scroll_progress(progress);
      this.scheduleRender();
    } catch (cause) { this.fail(cause, 'processError'); }
  }

  setScrollProgress(progress: number) {
    if (!this.viewer || !this.scrollPresentation || this.failed || this.disposed) return;
    try {
      this.scrollPresentation.progress = progress;
      this.viewer.set_scroll_progress(progress);
      this.scheduleRender();
    } catch (cause) { this.fail(cause, 'processError'); }
  }

  setBackdrop(opacity: number) {
    if (this.backdrop === opacity) return;
    this.backdrop = opacity;
    this.scheduleRender();
  }

  private applyPresentation(animate: boolean) {
    const { visible, focus, yaw, spread, viewport } = this.presentation!;
    const now = animate ? performance.now() : undefined;
    this.viewer!.set_visibility(visible, now);
    this.viewer!.frame_region(focus, viewport, yaw, spread, now);
  }

  private motionChanged = () => {
    if (this.loading || !this.motion.matches || !this.viewer || this.failed || this.disposed) return;
    try {
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

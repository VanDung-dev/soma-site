import type { Catalog } from '../catalog/types';
import { getWasm } from '../core';
import type { AnatomyViewer } from '../../wasm/wasm';
import type { ViewerError, Viewport } from './contracts';
import { loadModel } from './loader';

type Presentation = { visible: string[]; focus: string[]; yaw: number; spread: boolean; viewport: Viewport };

export class ViewerRuntime {
  private viewer: AnatomyViewer | undefined;
  private canvas = document.createElement('canvas');
  private abort = new AbortController();
  private motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private observer: ResizeObserver;
  private disposed = false;
  private failed = false;
  private loading = true;
  private animating = false;
  private ready = false;
  private structureIds: string[] = [];
  private renderFrame = 0;
  private resizePending = false;
  private lastRenderTime = -Infinity;
  private backdropVisible = false;
  private backdropStarted = 0;
  private presentation: Presentation | undefined;
  private scrollPresentation: { from: Presentation; to: Presentation; progress: number } | undefined;

  constructor(private host: HTMLElement, private options: {
    viewport: Viewport;
    onReady: (ids: string[]) => void;
    onError: (status: ViewerError) => void;
    onSettled: () => void;
  }) {
    this.canvas.setAttribute('role', 'img');
    this.canvas.tabIndex = -1;
    host.appendChild(this.canvas);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.motion.addEventListener('change', this.motionChanged);
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
  }

  async start(catalog: Catalog) {
    try {
      const wasm = await getWasm();
      if (this.disposed) return;
      catalog.clearMetadata();
      if (catalog.roots.length !== 1) throw new Error('The demo requires one model package');
      const prepared = await loadModel(catalog.roots[0]!, this.abort.signal, (root, json) => catalog.ingestMetadata(root, json));
      if (this.disposed) return;
      this.viewer = wasm.AnatomyViewer.fromPrepared(this.canvas, prepared);
      this.viewer.begin_reconstruction(performance.now(), true);
      const animate = !this.motion.matches;
      this.viewer.start_reconstruction(performance.now(), animate);
      this.resizeCanvas();
      this.structureIds = catalog.identities();
      this.loading = false;
      this.animating = animate;
      this.scheduleRender();
    } catch (cause) {
      if (!this.disposed) this.fail(cause, 'loadError');
    }
  }

  private fail(cause: unknown, status: ViewerError) {
    this.failed = true;
    this.animating = false;
    this.abort.abort();
    console.error(cause);
    this.options.onError(status);
  }

  private scheduleRender = () => {
    if (this.loading || !this.viewer || this.renderFrame || this.failed || this.disposed) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = 0;
      if (this.failed || this.disposed) return;
      let now = performance.now();
      const interval = 1000 / 60;
      const elapsed = now - this.lastRenderTime;
      if (elapsed + 0.5 < interval) { this.scheduleRender(); return; }
      this.lastRenderTime = elapsed < interval * 2 ? this.lastRenderTime + interval : now;
      try {
        if (this.resizePending) {
          this.resizeCanvas();
          now = performance.now();
        }
        const cameraAnimating = this.viewer!.advance_camera(now);
        const backdrop = this.backdropVisible ? this.motion.matches ? 1 : Math.min(1, (now - this.backdropStarted) / 280) : 0;
        this.viewer!.set_backdrop(backdrop);
        const revealing = !this.animating && this.viewer!.advance_reconstruction(now);
        if (this.animating) this.animating = this.viewer!.render_reconstruction(now);
        else this.viewer!.render();
        if (!this.animating && !this.ready) {
          this.ready = true;
          this.options.onReady(this.structureIds);
        }
        if (cameraAnimating || revealing || this.animating || (this.backdropVisible && backdrop < 1)) this.scheduleRender();
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
    const style = getComputedStyle(this.host);
    const width = parseFloat(style.width), height = parseFloat(style.height);
    if (width > 0 && height > 0) {
      const ratio = Math.min(window.devicePixelRatio, 2);
      const renderWidth = Math.max(1, Math.round(width * ratio));
      const renderHeight = Math.max(1, Math.round(height * ratio));
      if (this.canvas.width !== renderWidth || this.canvas.height !== renderHeight) this.viewer!.resize(renderWidth, renderHeight);
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

  present(visible: string[], focus: string[], yaw: number, spread: boolean, viewport: Viewport) {
    if (!this.viewer || this.failed || this.disposed) return;
    this.scrollPresentation = undefined;
    this.presentation = { visible, focus, yaw, spread, viewport };
    try {
      this.applyPresentation(!this.motion.matches);
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

  setBackdrop(visible: boolean) {
    if (this.backdropVisible === visible) return;
    this.backdropVisible = visible;
    this.backdropStarted = performance.now();
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
      this.animating = false;
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

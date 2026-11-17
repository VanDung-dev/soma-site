import type { AnatomyViewer } from '../../generated/viewer/wasm';
import type { Presentation, ScrollPresentation, Viewport } from './contracts';

export class PresentationController {
  private presentation: Presentation | undefined;
  private scroll: ScrollPresentation | undefined;

  present(viewer: AnatomyViewer, next: Presentation, animate: boolean): void {
    this.scroll = undefined;
    this.presentation = next;
    this.apply(viewer, next, animate);
  }

  beginScroll(viewer: AnatomyViewer, from: Presentation, to: Presentation, progress: number): void {
    this.presentation = from;
    this.apply(viewer, from, false);
    viewer.begin_scroll_transition(to.focus, to.viewport, to.yaw, to.spread);
    this.presentation = to;
    this.scroll = { from, to, progress };
    viewer.set_scroll_progress(progress);
  }

  setScrollProgress(viewer: AnatomyViewer, progress: number): boolean {
    if (!this.scroll) return false;
    this.scroll.progress = progress;
    viewer.set_scroll_progress(progress);
    return true;
  }

  finishScroll(viewer: AnatomyViewer): boolean {
    if (!this.scroll) return false;
    const target = this.scroll.to;
    this.scroll = undefined;
    this.presentation = target;
    this.apply(viewer, target, false);
    return true;
  }

  reflow(viewer: AnatomyViewer, fallbackViewport: Viewport, animate: boolean): void {
    if (this.scroll) {
      const { from, to, progress } = this.scroll;
      this.presentation = from;
      this.apply(viewer, from, false);
      viewer.begin_scroll_transition(to.focus, to.viewport, to.yaw, to.spread);
      this.presentation = to;
      viewer.set_scroll_progress(progress);
      return;
    }
    if (this.presentation) {
      this.apply(viewer, this.presentation, animate);
      return;
    }
    viewer.reframe(...fallbackViewport);
  }

  private apply(viewer: AnatomyViewer, presentation: Presentation, animate: boolean): void {
    const now = animate ? performance.now() : undefined;
    viewer.set_visibility(presentation.visible, now);
    viewer.frame_region(presentation.focus, presentation.viewport, presentation.yaw, presentation.spread, now);
  }
}

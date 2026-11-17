export interface RenderScale {
  width: number;
  height: number;
}

export interface RenderRegion {
  clipPath: string;
  left: number;
  top: number;
  width: number;
  height: number;
  aspect: number;
}

const numeric = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;

export function renderPixelSize(viewport: DOMRect, limit: number): RenderScale {
  const ratio = Math.min(window.devicePixelRatio, 2, limit / viewport.width, limit / viewport.height);
  return {
    width: Math.max(1, Math.round(viewport.width * ratio)),
    height: Math.max(1, Math.round(viewport.height * ratio)),
  };
}

export class SurfaceMetrics {
  private viewport = new DOMRect();
  private hostWidth = 1;
  private hostRadius = 0;

  constructor(private host: HTMLElement, private stage: HTMLElement) {}

  measureViewport(): DOMRect {
    this.viewport = this.stage.getBoundingClientRect();
    const style = getComputedStyle(this.host);
    const hostRect = this.host.getBoundingClientRect();
    this.hostWidth = numeric(parseFloat(style.width), hostRect.width || 1);
    this.hostRadius = numeric(parseFloat(style.borderTopLeftRadius), 0);
    return this.viewport;
  }

  region(): RenderRegion | undefined {
    const host = this.host.getBoundingClientRect();
    const viewport = this.viewport;
    if (host.width <= 0 || host.height <= 0) return;
    const radius = this.hostRadius * host.width / this.hostWidth;
    return {
      clipPath: `inset(${host.top - viewport.top}px ${viewport.right - host.right}px ${viewport.bottom - host.bottom}px ${host.left - viewport.left}px round ${radius}px)`,
      left: (viewport.left - host.left) / host.width,
      top: (viewport.top - host.top) / host.height,
      width: viewport.width / host.width,
      height: viewport.height / host.height,
      aspect: host.width / host.height,
    };
  }
}

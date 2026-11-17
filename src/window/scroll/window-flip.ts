export class WindowFlip {
  private transition: Animation | undefined;
  private key = '';

  constructor(private stage: HTMLElement, private element: HTMLElement) {}

  get active(): boolean {
    return this.key !== '';
  }

  get running(): boolean {
    return this.transition?.playState === 'running';
  }

  isNew(key: string): boolean {
    return key !== this.key;
  }

  animate(key: string, fromLayout: string, layout: string, progress: number, ready: boolean): void {
    if (key !== this.key) {
      this.transition?.cancel();
      this.transition = undefined;
      this.key = key;
      this.stage.dataset.layout = fromLayout;
      const before = ready ? this.element.getBoundingClientRect() : undefined;
      this.stage.dataset.layout = layout;
      if (before) {
        const after = this.element.getBoundingClientRect();
        const transform = this.element.style.transform;
        this.element.style.transform = 'none';
        const anchor = this.element.getBoundingClientRect();
        this.element.style.transform = transform;
        this.transition = this.element.animate([before, after].map(rect => ({
          transformOrigin: 'top left',
          transform: `translate(${rect.left - anchor.left}px,${rect.top - anchor.top}px) scale(${rect.width / anchor.width})`,
        })), { duration: 900, easing: 'linear', fill: 'both' });
        this.transition.pause();
      }
    }
    if (this.transition) this.transition.currentTime = progress * 900;
  }

  reset(): void {
    this.transition?.cancel();
    this.transition = undefined;
    this.key = '';
  }

  dispose(): void {
    this.reset();
  }
}

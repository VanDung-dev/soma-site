import { CLOSING_SPAN } from './scenes';

interface CopyState {
  page: HTMLElement;
  panel: HTMLElement;
  left: boolean;
  top: number;
  height: number;
  hold: number;
  distance: number;
  entrance: number;
}

export class CopyTrack {
  private copies: CopyState[];

  constructor(private viewport: HTMLElement, private pages: HTMLElement[]) {
    this.copies = pages.slice(1).map((page, index) => ({
      page,
      panel: page.querySelector<HTMLElement>('.product-inner')!,
      left: index === 0,
      top: 0,
      height: 1,
      hold: 0,
      distance: 0,
      entrance: 0.2,
    }));
  }

  measure(): void {
    const width = this.viewport.clientWidth;
    const compact = window.matchMedia('(max-width: 700px)').matches;
    for (const [index, copy] of this.copies.entries()) {
      copy.top = copy.page.offsetTop;
      copy.height = copy.page.offsetHeight;
      copy.hold = Math.max(0, (this.pages[index + 2]?.offsetTop ?? copy.top + copy.height) - copy.top - copy.height);
      copy.distance = copy.left ? -copy.panel.offsetLeft - copy.panel.offsetWidth : width - copy.panel.offsetLeft;
      copy.entrance = compact && (copy.left || copy.page.dataset.scene === '3') ? 0.06 : 0.2;
    }
  }

  sync(reducedMotion: boolean): void {
    const scroll = this.viewport.scrollTop;
    this.viewport.toggleAttribute('data-copy-motion', !reducedMotion);
    for (const { page, panel, top, height, hold, distance, entrance } of this.copies) {
      if (reducedMotion) {
        panel.style.removeProperty('transform');
        panel.style.removeProperty('visibility');
        page.inert = false;
        continue;
      }
      const offset = scroll - top;
      const closing = page.dataset.scene === '3';
      const exit = 0.35 * (page.dataset.scene === '2' ? CLOSING_SPAN : 1);
      const progress = Math.max(0, Math.min(1, closing
        ? 1 + (offset / height + 1 - CLOSING_SPAN) / (entrance * CLOSING_SPAN)
        : offset < 0 ? 1 + offset / (height * entrance) : 1 - Math.max(0, offset - hold) / (height * exit)));
      const visible = progress * progress * (3 - 2 * progress);
      panel.style.transform = `translate3d(${distance * (1 - visible)}px,${offset}px,0)`;
      panel.style.visibility = progress > 0 ? 'visible' : 'hidden';
      page.inert = progress === 0;
    }
  }

  reset(): void {
    this.viewport.removeAttribute('data-copy-motion');
    for (const { page, panel } of this.copies) {
      panel.style.removeProperty('transform');
      panel.style.removeProperty('visibility');
      page.inert = false;
    }
  }
}

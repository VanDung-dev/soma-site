import { getCatalog } from './core';
import { ViewerRuntime } from './viewer/runtime';
import type { Catalog } from './catalog/types';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { allowedStructures, CLOSING_SPAN, FRAME, layoutFor, presentationFor } from './scroll/scenes';
import { CopyTrack } from './scroll/copy-track';
import { WindowFlip } from './scroll/window-flip';

export function mountWindow(report: (key: MessageKey | null) => void, showRetry: () => void): () => void {
  const stage = document.querySelector<HTMLElement>('.stage')!;
  const host = document.querySelector<HTMLElement>('#window-viewer-host')!;
  const viewport = document.querySelector<HTMLElement>('.site-scroll')!;
  const windowEl = document.querySelector<HTMLElement>('.window')!;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pages = [...document.querySelectorAll<HTMLElement>('.product-section')];
  const copies = new CopyTrack(viewport, pages);
  const flip = new WindowFlip(stage, windowEl);
  const abort = new AbortController();
  let catalog: Catalog | undefined;
  let runtime: ViewerRuntime | undefined;
  let ready = false, lastPage = '', scrollDirty = true;
  let allowed: string[] = [];
  stage.dataset.chrome = 'hidden';

  const present = (scene: number) => {
    if (!runtime || !catalog) return;
    const presentation = presentationFor(scene, allowed);
    stage.dataset.settled = 'false';
    stage.dataset.scene = String(scene);
    runtime.present(presentation.visible, presentation.focus, presentation.yaw, presentation.spread, presentation.viewport);
  };
  const revealChrome = () => {
    if (!ready || abort.signal.aborted || stage.dataset.opening !== undefined || stage.dataset.chrome === 'hidden' || stage.dataset.settled !== 'true' || flip.running) return;
    stage.dataset.chrome = 'visible';
    runtime?.setBackdrop(1);
  };
  const syncDiscretePage = (active: HTMLElement) => {
    if (flip.active) {
      flip.reset();
      lastPage = '';
    }
    stage.style.removeProperty('opacity');
    stage.style.removeProperty('--window-chrome');
    if (active.id === lastPage && ready) return;
    delete stage.dataset.opening;
    lastPage = active.id;
    const scene = Number(active.dataset.scene);
    const layout = layoutFor(scene);
    const enlarged = layout === 'hero' || layout === 'closing';
    pages[0]!.style.opacity = layout === 'hero' ? '1' : '0';
    pages[0]!.inert = layout !== 'hero';
    stage.dataset.chrome = enlarged ? 'hidden' : 'pending';
    runtime?.setBackdrop(0);
    if (enlarged) stage.dataset.opening = '';
    stage.dataset.layout = layout;
    delete stage.dataset.progress;
    if (ready) present(scene);
  };
  const syncPage = () => {
    copies.sync(motion.matches);
    let fromIndex = 0;
    for (let index = 1; index < pages.length; index++) {
      if (pages[index]!.offsetTop <= viewport.scrollTop) fromIndex = index;
      else break;
    }
    const from = pages[fromIndex]!;
    const next = pages[fromIndex + 1];
    if (!motion.matches && from.dataset.scene !== undefined && next?.dataset.scene !== undefined) {
      stage.style.removeProperty('opacity');
      const fromScene = Number(from.dataset.scene), toScene = Number(next.dataset.scene);
      const progress = Math.max(0, Math.min(1, (1 - (next.offsetTop - viewport.scrollTop) / viewport.clientHeight) / (toScene === 3 ? CLOSING_SPAN : 1)));
      const closing = Math.max(0, Math.min(1, (progress - 0.35) / 0.65));
      const blend = fromScene === 0 ? progress * progress * (3 - 2 * progress) : toScene === 3 ? closing * closing * (3 - 2 * closing) : progress;
      const key = `${from.id}:${next.id}`;
      const newTransition = flip.isNew(key);
      flip.animate(key, layoutFor(fromScene), layoutFor(toScene), blend, ready);
      if (fromScene === 0 || toScene === 3) stage.dataset.opening = '';
      else delete stage.dataset.opening;
      const copy = fromScene === 0 ? Math.max(0, 1 - progress / 0.4) : 0;
      pages[0]!.style.opacity = String(copy * copy * (3 - 2 * copy));
      pages[0]!.inert = copy === 0;
      stage.dataset.scene = String(progress < 0.5 ? fromScene : toScene);
      stage.dataset.progress = String(progress);
      stage.dataset.settled = 'true';
      const reveal = fromScene === 0 ? Math.max(0, Math.min(1, (progress - 0.82) / 0.18)) : toScene === 3 ? Math.max(0, 1 - progress / 0.18) : 1;
      const chrome = reveal * reveal * (3 - 2 * reveal);
      stage.style.setProperty('--window-chrome', String(chrome));
      stage.dataset.chrome = chrome > 0 ? 'visible' : 'hidden';
      runtime?.setBackdrop(chrome);
      if (ready && runtime && catalog) {
        if (newTransition) runtime.beginScrollTransition(presentationFor(fromScene, allowed), presentationFor(toScene, allowed), blend);
        else runtime.setScrollProgress(blend);
      }
      lastPage = progress < 0.5 ? from.id : next.id;
      return;
    }
    let active = pages[0]!;
    for (const page of pages) if (Math.abs(page.offsetTop - viewport.scrollTop) < Math.abs(active.offsetTop - viewport.scrollTop)) active = page;
    syncDiscretePage(active);
  };
  const scheduleSync = () => {
    scrollDirty = true;
    if (runtime) runtime.scheduleRender();
    else syncPage();
  };
  const observer = new ResizeObserver(() => {
    flip.reset();
    lastPage = '';
    copies.measure();
    scheduleSync();
  });
  observer.observe(viewport);
  viewport.addEventListener('scroll', scheduleSync, { signal: abort.signal });
  motion.addEventListener('change', () => {
    flip.reset();
    lastPage = '';
    copies.measure();
    scheduleSync();
  }, { signal: abort.signal });
  copies.measure();
  syncPage();
  void (async () => {
    try {
      catalog = await getCatalog();
      if (abort.signal.aborted) {
        catalog.free();
        catalog = undefined;
        return;
      }
      runtime = new ViewerRuntime(host, {
        viewport: FRAME,
        onBeforeRender: () => {
          if (!scrollDirty) return;
          scrollDirty = false;
          syncPage();
        },
        onReady: ids => {
          ready = true;
          allowed = allowedStructures(catalog!, ids);
          stage.dataset.ready = '';
          report(null);
          lastPage = '';
          flip.reset();
          scheduleSync();
        },
        onError: status => {
          ready = false;
          delete stage.dataset.ready;
          report(status === 'contextLost' ? 'site.contextLost' : 'site.loadError');
          showRetry();
        },
        onSettled: () => {
          stage.dataset.settled = 'true';
          revealChrome();
        },
      });
      const canvas = stage.querySelector('canvas')!;
      canvas.dataset.i18nAriaLabel = 'window.title';
      canvas.setAttribute('aria-label', t('window.title'));
      await runtime.start(catalog);
    } catch {
      if (!abort.signal.aborted) {
        report('site.loadError');
        showRetry();
      }
    }
  })();
  return () => {
    abort.abort();
    observer.disconnect();
    flip.dispose();
    runtime?.dispose();
    catalog?.free();
    delete stage.dataset.ready;
    delete stage.dataset.scene;
    delete stage.dataset.settled;
    delete stage.dataset.chrome;
    delete stage.dataset.progress;
    delete stage.dataset.opening;
    stage.style.removeProperty('--window-chrome');
    pages[0]!.style.removeProperty('opacity');
    pages[0]!.inert = false;
    copies.reset();
  };
}

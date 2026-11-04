import { getCatalog } from './core';
import { ViewerRuntime } from './viewer/runtime';
import type { Catalog } from './catalog/types';
import type { Viewport } from './viewer/contracts';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';

export function mountWindow(report: (key: MessageKey | null) => void, showRetry: () => void): () => void {
  const stage = document.querySelector<HTMLElement>('.stage')!;
  const host = document.querySelector<HTMLElement>('#window-viewer-host')!;
  const viewport = document.querySelector<HTMLElement>('.site-scroll')!;
  const windowEl = document.querySelector<HTMLElement>('.window')!;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pages = [...document.querySelectorAll<HTMLElement>('.product-section')];
  const copies = pages.slice(1).map((page, index) => ({ page, panel: page.querySelector<HTMLElement>('.product-inner')!, left: index === 0, top: 0, height: 1, hold: 0, distance: 0, entrance: 0.2 }));
  const abort = new AbortController();
  let catalog: Catalog | undefined;
  let runtime: ViewerRuntime | undefined;
  let ready = false, lastPage = '', scrollDirty = true, transitionKey = '';
  let transition: Animation | undefined;
  let allowed: string[] = [];
  stage.dataset.chrome = 'hidden';
  const omitted = new Set(['Hyoid bone', 'Thyroid cartilage', 'Cricoid cartilage', 'Arytenoid cartilage', 'Corniculate cartilage', 'Lateral process of nasal septal cartilage', 'Nasal septal cartilage', 'Major alar cartilage']);
  const frame: Viewport = [0.03, 0.02, 0.94, 0.96];
  const closingSpan = 0.7;
  const measureCopies = () => {
    const width = viewport.clientWidth;
    const compact = window.matchMedia('(max-width: 700px)').matches;
    for (const [index, copy] of copies.entries()) {
      copy.top = copy.page.offsetTop;
      copy.height = copy.page.offsetHeight;
      copy.hold = Math.max(0, (pages[index + 2]?.offsetTop ?? copy.top + copy.height) - copy.top - copy.height);
      copy.distance = copy.left ? -copy.panel.offsetLeft - copy.panel.offsetWidth : width - copy.panel.offsetLeft;
      copy.entrance = compact && (copy.left || copy.page.dataset.scene === '3') ? 0.06 : 0.2;
    }
  };
  const syncCopies = () => {
    const scroll = viewport.scrollTop;
    viewport.toggleAttribute('data-copy-motion', !motion.matches);
    for (const { page, panel, top, height, hold, distance, entrance } of copies) {
      if (motion.matches) {
        panel.style.removeProperty('transform');
        panel.style.removeProperty('visibility');
        page.inert = false;
        continue;
      }
      const offset = scroll - top;
      const closing = page.dataset.scene === '3';
      const exit = 0.35 * (page.dataset.scene === '2' ? closingSpan : 1);
      const progress = Math.max(0, Math.min(1, closing
        ? 1 + (offset / height + 1 - closingSpan) / (entrance * closingSpan)
        : offset < 0 ? 1 + offset / (height * entrance) : 1 - Math.max(0, offset - hold) / (height * exit)));
      const visible = progress * progress * (3 - 2 * progress);
      panel.style.transform = `translate3d(${distance * (1 - visible)}px,${offset}px,0)`;
      panel.style.visibility = progress > 0 ? 'visible' : 'hidden';
      page.inert = progress === 0;
    }
  };
  const layoutFor = (scene: number) => scene === 0 ? 'hero' : scene === 1 ? 'right' : scene === 3 ? 'closing' : 'split';
  const presentationFor = (scene: number) => ({
    visible: allowed,
    focus: allowed,
    yaw: scene === 0 ? 1.1 : scene === 3 ? -1.1 : 0,
    spread: scene === 2,
    viewport: frame,
  });
  const present = (scene: number) => {
    if (!runtime || !catalog) return;
    const presentation = presentationFor(scene);
    stage.dataset.settled = 'false';
    stage.dataset.scene = String(scene);
    runtime.present(presentation.visible, presentation.focus, presentation.yaw, presentation.spread, presentation.viewport);
  };
  const revealChrome = () => {
    if (!ready || abort.signal.aborted || stage.dataset.opening !== undefined || stage.dataset.chrome === 'hidden' || stage.dataset.settled !== 'true' || transition?.playState === 'running') return;
    stage.dataset.chrome = 'visible';
    runtime?.setBackdrop(1);
  };
  const animateWindow = (key: string, fromLayout: string, layout: string, progress: number) => {
    if (key !== transitionKey) {
      transition?.cancel();
      transition = undefined;
      transitionKey = key;
      stage.dataset.layout = fromLayout;
      const before = ready ? windowEl.getBoundingClientRect() : undefined;
      stage.dataset.layout = layout;
      if (before) {
        const after = windowEl.getBoundingClientRect();
        const transform = windowEl.style.transform;
        windowEl.style.transform = 'none';
        const anchor = windowEl.getBoundingClientRect();
        windowEl.style.transform = transform;
        transition = windowEl.animate([before, after].map(rect => ({
          transformOrigin: 'top left',
          transform: `translate(${rect.left - anchor.left}px,${rect.top - anchor.top}px) scale(${rect.width / anchor.width})`,
        })), { duration: 900, easing: 'linear', fill: 'both' });
        transition.pause();
      }
    }
    if (transition) transition.currentTime = progress * 900;
  };
  const syncDiscretePage = (active: HTMLElement) => {
    if (transitionKey) {
      transition?.cancel(); transition = undefined; transitionKey = ''; lastPage = '';
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
    transition?.cancel(); transition = undefined;
    stage.dataset.layout = layout;
    delete stage.dataset.progress;
    if (ready) present(scene);
  };
  const syncPage = () => {
    syncCopies();
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
      const progress = Math.max(0, Math.min(1, (1 - (next.offsetTop - viewport.scrollTop) / viewport.clientHeight) / (toScene === 3 ? closingSpan : 1)));
      const closing = Math.max(0, Math.min(1, (progress - 0.35) / 0.65));
      const blend = fromScene === 0 ? progress * progress * (3 - 2 * progress) : toScene === 3 ? closing * closing * (3 - 2 * closing) : progress;
      const key = `${from.id}:${next.id}`;
      const newTransition = key !== transitionKey;
      animateWindow(key, layoutFor(fromScene), layoutFor(toScene), blend);
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
        if (newTransition) runtime.beginScrollTransition(presentationFor(fromScene), presentationFor(toScene), blend);
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
  const observer = new ResizeObserver(() => { transition?.cancel(); transition = undefined; transitionKey = ''; lastPage = ''; measureCopies(); scheduleSync(); });
  observer.observe(viewport);
  viewport.addEventListener('scroll', scheduleSync, { signal: abort.signal });
  motion.addEventListener('change', () => { measureCopies(); scheduleSync(); }, { signal: abort.signal });
  measureCopies();
  syncPage();
  void (async () => {
    try {
      catalog = await getCatalog();
      if (abort.signal.aborted) { catalog.free(); catalog = undefined; return; }
      runtime = new ViewerRuntime(host, {
        viewport: frame,
        onBeforeRender: () => {
          if (!scrollDirty) return;
          scrollDirty = false;
          syncPage();
        },
        onReady: ids => {
          ready = true;
          allowed = ids.filter(id => !omitted.has(catalog!.sourceName(id) || ''));
          stage.dataset.ready = '';
          report(null); lastPage = ''; transitionKey = ''; scheduleSync();
        },
        onError: status => {
          ready = false; delete stage.dataset.ready;
          report(status === 'contextLost' ? 'site.contextLost' : 'site.loadError'); showRetry();
        },
        onSettled: () => { stage.dataset.settled = 'true'; revealChrome(); },
      });
      const canvas = stage.querySelector('canvas')!;
      canvas.dataset.i18nAriaLabel = 'window.title';
      canvas.setAttribute('aria-label', t('window.title'));
      await runtime.start(catalog);
    } catch {
      if (!abort.signal.aborted) { report('site.loadError'); showRetry(); }
    }
  })();
  return () => {
    abort.abort();
    observer.disconnect();
    transition?.cancel();
    runtime?.dispose(); catalog?.free();
    delete stage.dataset.ready; delete stage.dataset.scene; delete stage.dataset.settled;
    delete stage.dataset.chrome; delete stage.dataset.progress;
    delete stage.dataset.opening;
    stage.style.removeProperty('--window-chrome');
    pages[0]!.style.removeProperty('opacity');
    pages[0]!.inert = false;
    viewport.removeAttribute('data-copy-motion');
    for (const { page, panel } of copies) {
      panel.style.removeProperty('transform');
      panel.style.removeProperty('visibility');
      page.inert = false;
    }
  };
}

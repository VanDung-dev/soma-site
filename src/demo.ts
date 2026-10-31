import { getCatalog } from '../demo/web/anatomy/core';
import { ViewerRuntime } from '../demo/web/anatomy/viewer/runtime';
import type { Catalog } from '../demo/web/anatomy/catalog/types';
import type { Viewport } from '../demo/web/anatomy/viewer/contracts';
import regions from '../demo/web/regions.json';
import { t } from './i18n.ts';
import type { MessageKey } from './i18n.ts';

export function mountDemo(report: (key: MessageKey | null) => void, showRetry: () => void): () => void {
  const stage = document.querySelector<HTMLElement>('.stage')!;
  const host = document.querySelector<HTMLElement>('#demo-viewer-host')!;
  const viewport = document.querySelector<HTMLElement>('.site-scroll')!;
  const demoWindow = document.querySelector<HTMLElement>('.demo-window')!;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pages = [...document.querySelectorAll<HTMLElement>('.product-section')];
  const abort = new AbortController();
  let catalog: Catalog | undefined;
  let runtime: ViewerRuntime | undefined;
  let ready = false, lastPage = '', scrollFrame = 0, transitionKey = '';
  let transition: Animation | undefined;
  let allowed: string[] = [];
  stage.dataset.chrome = 'hidden';
  const omitted = new Set(['Hyoid bone', 'Thyroid cartilage', 'Cricoid cartilage', 'Arytenoid cartilage', 'Corniculate cartilage', 'Lateral process of nasal septal cartilage', 'Nasal septal cartilage', 'Major alar cartilage']);
  const frame: Viewport = [0.03, 0.02, 0.94, 0.96];
  const heroFrame: Viewport = [0.02, 0.0, 0.96, 0.98];
  const layoutFor = (scene: number) => scene === 0 ? 'hero' : scene === 1 ? 'right' : 'split';
  const presentationFor = (scene: number) => ({
    visible: allowed,
    focus: scene === 0 ? [...new Set([...catalog!.members(regions.head), ...catalog!.members(regions.jaw)])].filter(id => allowed.includes(id)) : allowed,
    yaw: scene === 0 ? 1.1 : 0,
    spread: scene === 2,
    viewport: scene === 0 ? heroFrame : frame,
  });
  const present = (scene: number) => {
    if (!runtime || !catalog) return;
    const presentation = presentationFor(scene);
    stage.dataset.settled = 'false';
    stage.dataset.scene = String(scene);
    runtime.present(presentation.visible, presentation.focus, presentation.yaw, presentation.spread, presentation.viewport);
  };
  const revealChrome = () => {
    if (!ready || abort.signal.aborted || stage.dataset.chrome === 'hidden' || stage.dataset.layout === 'hero' || stage.dataset.layout === 'none' || stage.dataset.settled !== 'true' || transition?.playState === 'running') return;
    stage.dataset.chrome = 'visible';
    runtime?.setBackdrop(true);
  };
  const animateWindow = (key: string, fromLayout: string, layout: string, progress: number) => {
    if (key !== transitionKey) {
      transition?.cancel();
      transition = undefined;
      transitionKey = key;
      stage.dataset.layout = fromLayout;
      const before = ready ? demoWindow.getBoundingClientRect() : undefined;
      stage.dataset.layout = layout;
      if (before) {
        const after = demoWindow.getBoundingClientRect();
        const transform = getComputedStyle(demoWindow).transform;
        transition = demoWindow.animate([
          { transformOrigin: 'top left', transform: `translate(${before.left - after.left}px,${before.top - after.top}px) ${transform === 'none' ? '' : transform} scale(${before.width / after.width},${before.height / after.height})` },
          { transformOrigin: 'top left', transform },
        ], { duration: 900, easing: 'linear', fill: 'both' });
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
    if (active.id === lastPage && ready) return;
    lastPage = active.id;
    const scene = active.dataset.scene;
    const layout = scene === undefined ? 'none' : layoutFor(Number(scene));
    if (layout === 'hero' || layout === 'none' || stage.dataset.layout === 'hero') {
      stage.dataset.chrome = 'hidden';
      runtime?.setBackdrop(false);
    }
    transition?.cancel(); transition = undefined;
    stage.dataset.layout = layout;
    delete stage.dataset.progress;
    if (scene === undefined) {
      stage.dataset.scene = 'none';
      stage.dataset.settled = 'true';
    } else if (ready) present(Number(scene));
  };
  const syncPage = () => {
    scrollFrame = 0;
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
      const progress = Math.max(0, Math.min(1, (viewport.scrollTop - from.offsetTop) / (next.offsetTop - from.offsetTop)));
      const key = `${from.id}:${next.id}`;
      const newTransition = key !== transitionKey;
      animateWindow(key, layoutFor(fromScene), layoutFor(toScene), progress);
      stage.dataset.scene = String(progress < 0.5 ? fromScene : toScene);
      stage.dataset.progress = String(progress);
      stage.dataset.settled = 'true';
      if (progress < 0.03 && fromScene === 0) {
        stage.dataset.chrome = 'hidden';
        runtime?.setBackdrop(false);
      } else {
        stage.dataset.chrome = 'visible';
        runtime?.setBackdrop(true);
      }
      if (runtime && catalog) {
        if (newTransition) runtime.beginScrollTransition(presentationFor(fromScene), presentationFor(toScene), progress);
        else runtime.setScrollProgress(progress);
      }
      lastPage = progress < 0.5 ? from.id : next.id;
      return;
    }
    if (!motion.matches && from.dataset.scene !== undefined && next && next.dataset.scene === undefined) {
      const progress = Math.max(0, Math.min(1, (viewport.scrollTop - from.offsetTop) / (next.offsetTop - from.offsetTop)));
      const key = `${from.id}:${next.id}:exit`;
      transition?.cancel(); transition = undefined;
      transitionKey = key;
      stage.dataset.layout = progress === 1 ? 'none' : layoutFor(Number(from.dataset.scene));
      stage.dataset.scene = progress === 1 ? 'none' : from.dataset.scene;
      stage.dataset.progress = String(progress);
      stage.dataset.settled = 'true';
      stage.dataset.chrome = progress < 1 ? 'visible' : 'hidden';
      const fade = Math.max(0, Math.min(1, (progress - 0.4) / 0.2));
      stage.style.opacity = String(1 - fade * fade * (3 - 2 * fade));
      runtime?.setBackdrop(progress < 1);
      if (ready && lastPage !== from.id) present(Number(from.dataset.scene));
      lastPage = progress < 0.5 ? from.id : next.id;
      return;
    }
    let active = pages[0]!;
    for (const page of pages) if (Math.abs(page.offsetTop - viewport.scrollTop) < Math.abs(active.offsetTop - viewport.scrollTop)) active = page;
    syncDiscretePage(active);
  };
  const scheduleSync = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(syncPage); };
  const observer = new ResizeObserver(() => { transitionKey = ''; scheduleSync(); });
  observer.observe(viewport);
  viewport.addEventListener('scroll', scheduleSync, { signal: abort.signal });
  motion.addEventListener('change', scheduleSync, { signal: abort.signal });
  syncPage();
  void (async () => {
    try {
      catalog = await getCatalog();
      if (abort.signal.aborted) { catalog.free(); catalog = undefined; return; }
      runtime = new ViewerRuntime(host, {
        viewport: frame,
        onReady: ids => {
          ready = true;
          allowed = ids.filter(id => !omitted.has(catalog!.sourceName(id) || ''));
          stage.dataset.ready = '';
          report(null); lastPage = ''; transitionKey = ''; syncPage();
        },
        onError: status => {
          ready = false; delete stage.dataset.ready;
          report(status === 'contextLost' ? 'site.contextLost' : 'site.loadError'); showRetry();
        },
        onSettled: () => { stage.dataset.settled = 'true'; revealChrome(); },
      });
      const canvas = host.querySelector('canvas')!;
      canvas.tabIndex = -1;
      canvas.dataset.i18nAriaLabel = 'demo.title';
      canvas.setAttribute('aria-label', t('demo.title'));
      await runtime.start(catalog);
    } catch {
      if (!abort.signal.aborted) { report('site.loadError'); showRetry(); }
    }
  })();
  return () => {
    abort.abort(); cancelAnimationFrame(scrollFrame);
    observer.disconnect();
    transition?.cancel();
    runtime?.dispose(); catalog?.free();
    delete stage.dataset.ready; delete stage.dataset.scene; delete stage.dataset.settled;
    delete stage.dataset.chrome; delete stage.dataset.progress;
  };
}

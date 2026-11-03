import { icons } from './icons.ts';
import { t } from '../i18n/index.ts';

export type Theme = 'auto' | 'light' | 'dark';
type ThemeTransition = { finished: Promise<void>; skipTransition: () => void };
const themeStorageKey = 'human-atlas-theme';

export function getInitialTheme(): Theme {
  try {
    const theme = window.localStorage.getItem(themeStorageKey);
    return theme === 'light' || theme === 'dark' ? theme : 'auto';
  } catch { return 'auto'; }
}

export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : theme === 'dark' ? 'dark' : 'light';
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
}

export function initTheme(): void {
  let theme = getInitialTheme();
  let appliedTheme: 'light' | 'dark' | null = null;
  let activeTransition: ThemeTransition | null = null;
  let transitionTimeout = 0, removeTransitionTimeout = 0, animationFrame = 0;
  const root = document.documentElement;
  const toggle = document.querySelector<HTMLButtonElement>('.theme-toggle')!;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const clearRevealOrigin = () => {
    for (const value of ['x', 'y', 'radius']) root.style.removeProperty(`--theme-reveal-${value}`);
  };
  const resetTransition = () => {
    window.clearTimeout(transitionTimeout);
    window.clearTimeout(removeTransitionTimeout);
    activeTransition?.skipTransition();
    activeTransition = null;
    window.cancelAnimationFrame(animationFrame);
    delete root.dataset.themeTransition;
    clearRevealOrigin();
  };
  const updateControl = () => {
    const key = `appearance.mode.${nextTheme(theme)}` as const;
    toggle.dataset.theme = theme;
    toggle.dataset.i18nAriaLabel = key;
    toggle.dataset.i18nTitle = key;
    toggle.setAttribute('aria-label', t(key));
    toggle.title = t(key);
    toggle.innerHTML = `<span class="line-md-icon" aria-hidden="true">${icons[theme]}</span>`;
  };
  const applyTheme = () => {
    const effectiveTheme = getEffectiveTheme(theme);
    resetTransition();
    updateControl();
    if (appliedTheme === effectiveTheme) return;
    const update = () => {
      root.dataset.theme = effectiveTheme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effectiveTheme === 'dark' ? '#292b2a' : '#f5f2ec');
      appliedTheme = effectiveTheme;
    };
    if (appliedTheme === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
    transitionTimeout = window.setTimeout(() => {
      const rect = toggle.getBoundingClientRect();
      const x = rect.width ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect.height ? rect.top + rect.height / 2 : window.innerHeight / 2;
      root.style.setProperty('--theme-reveal-x', `${x}px`);
      root.style.setProperty('--theme-reveal-y', `${y}px`);
      root.style.setProperty('--theme-reveal-radius', `${Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))}px`);
      const startViewTransition = (document as Document & {
        startViewTransition?: (callback: () => void) => ThemeTransition;
      }).startViewTransition;
      let transition: ThemeTransition | undefined;
      try { transition = startViewTransition?.call(document, update); } catch {}
      if (transition) {
        activeTransition = transition;
        const clear = () => {
          if (activeTransition !== transition) return;
          activeTransition = null;
          clearRevealOrigin();
        };
        transition.finished.then(clear, clear);
        return;
      }
      clearRevealOrigin();
      root.dataset.themeTransition = 'true';
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        update();
        removeTransitionTimeout = window.setTimeout(() => delete root.dataset.themeTransition, 320);
      });
    }, 180);
  };
  applyTheme();
  toggle.addEventListener('click', () => {
    theme = nextTheme(theme);
    try { window.localStorage.setItem(themeStorageKey, theme); } catch {}
    applyTheme();
  });
  mediaQuery.addEventListener('change', () => { if (theme === 'auto') applyTheme(); });
  window.addEventListener('pagehide', resetTransition);
}

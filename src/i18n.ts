import application from '../content/ui-translations.json' with { type: 'json' };
import site from '../content/site-translations.json' with { type: 'json' };

export type Language = 'vi' | 'en';
const messages = { ...application.messages, ...site.messages };
export type MessageKey = keyof typeof messages;
export type MessageValues = Record<string, string | number>;
const languageStorageKey = 'human-atlas-language';
let language: Language = 'vi';

export function getInitialLanguage(): Language {
  try { return window.localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'vi'; }
  catch { return 'vi'; }
}

export function translateMessage(key: MessageKey, language: Language, values: MessageValues = {}): string {
  const template = messages[key][language];
  const pluralized = template.replace(/\{(\w+), plural, one \{([^{}]*)\} other \{([^{}]*)\}\}/g,
    (_, name: string, one: string, other: string) => {
      const count = Number(values[name] ?? 0);
      return (language === 'en' && count === 1 ? one : other).replaceAll('#', String(count));
    });
  return pluralized.replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token));
}

export function t(key: MessageKey, values?: MessageValues): string {
  return translateMessage(key, language, values);
}

export function applyTranslations(): void {
  document.documentElement.lang = language;
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (key && key in messages) element.textContent = t(key as MessageKey);
  }
  for (const attribute of ['aria-label', 'title', 'content']) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`)) {
      const key = element.getAttribute(`data-i18n-${attribute}`);
      if (key && key in messages) element.setAttribute(attribute, t(key as MessageKey));
    }
  }
  const button = document.querySelector('#language');
  if (button) button.textContent = language.toUpperCase();
}

export function setLanguage(next: Language): void {
  const viewport = document.querySelector<HTMLElement>('.site-scroll')!;
  const position = { left: viewport.scrollLeft, top: viewport.scrollTop, behavior: 'instant' as const };
  language = next;
  try { window.localStorage.setItem(languageStorageKey, language); } catch {}
  applyTranslations();
  viewport.scrollTo(position);
}

export function initLanguage(): void {
  setLanguage(getInitialLanguage());
  document.querySelector('#language')?.addEventListener('click', () => setLanguage(language === 'vi' ? 'en' : 'vi'));
}

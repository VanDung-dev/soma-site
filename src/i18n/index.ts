import { applyTranslations } from './dom.ts';
import { translateMessage } from './messages.ts';
import type { Language, MessageKey } from './messages.ts';

export type { Language, MessageKey } from './messages.ts';
export { translateMessage } from './messages.ts';

const languageStorageKey = 'human-atlas-language';
let language: Language = 'vi';

export function getInitialLanguage(): Language {
  try { return window.localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'vi'; }
  catch { return 'vi'; }
}

export function t(key: MessageKey): string {
  return translateMessage(key, language);
}

export function setLanguage(next: Language): void {
  const viewport = document.querySelector<HTMLElement>('.site-scroll')!;
  const position = { left: viewport.scrollLeft, top: viewport.scrollTop, behavior: 'instant' as const };
  language = next;
  try { window.localStorage.setItem(languageStorageKey, language); } catch {}
  applyTranslations(language);
  viewport.scrollTo(position);
}

export function initLanguage(): void {
  setLanguage(getInitialLanguage());
  document.querySelector('#language')?.addEventListener('click', () => setLanguage(language === 'vi' ? 'en' : 'vi'));
}

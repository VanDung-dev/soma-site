import { hasMessage, translateMessage } from './messages.ts';
import type { Language } from './messages.ts';

export function applyTranslations(language: Language): void {
  document.documentElement.lang = language;
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (key && hasMessage(key)) element.textContent = translateMessage(key, language);
  }
  for (const attribute of ['aria-label', 'title', 'content']) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`)) {
      const key = element.getAttribute(`data-i18n-${attribute}`);
      if (key && hasMessage(key)) element.setAttribute(attribute, translateMessage(key, language));
    }
  }
  const button = document.querySelector('#language');
  if (button) button.textContent = language.toUpperCase();
}

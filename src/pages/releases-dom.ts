import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { ReleaseInfo } from './releases.ts';

export function updateDownloadOptions(release: ReleaseInfo | null): void {
  const options = document.querySelectorAll<HTMLAnchorElement>('.download-option');
  for (const option of options) {
    if (!release) {
      option.setAttribute('aria-disabled', 'true');
      option.removeAttribute('href');
      option.removeAttribute('target');
      option.removeAttribute('rel');
      const small = option.querySelector<HTMLElement>('small');
      if (small) {
        small.dataset.i18n = 'site.download.unavailable';
        small.textContent = t('site.download.unavailable');
      }
      continue;
    }

    const platform = option.dataset.platform;
    if (platform === 'windows') {
      option.href = release.windowsUrl;
    } else if (platform === 'macos') {
      option.href = release.macosUrl;
    }
    option.removeAttribute('aria-disabled');
    option.target = '_blank';
    option.rel = 'noopener noreferrer';

    const small = option.querySelector<HTMLElement>('small');
    if (small) {
      delete small.dataset.i18n;
      const statusKey: MessageKey = release.isPrerelease ? 'site.download.prerelease' : 'site.download.latest';
      small.innerHTML = `<span class="release-status" data-i18n="${statusKey}">${t(statusKey)}</span> · <span class="release-tag">${release.tagName}</span>`;
    }
  }
}

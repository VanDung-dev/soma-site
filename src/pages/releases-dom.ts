import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { ReleaseResult } from './releases.ts';

export function updateDownloadOptions(result: ReleaseResult): void {
  const release = result.status === 'available' ? result.release : null;
  const options = document.querySelectorAll<HTMLAnchorElement>('.download-option');
  for (const option of options) {
    let statusKey: MessageKey = result.status === 'error' ? 'site.download.error' : 'site.download.unpublished';
    if (release) {
      const url = option.dataset.platform === 'windows' ? release.windowsUrl : release.macosUrl;
      option.href = url;
      option.target = '_blank';
      option.rel = 'noopener noreferrer';
      option.removeAttribute('aria-disabled');
      const downloadStatus = release.isPrerelease ? 'site.download.prerelease' : 'site.download.stable';
      statusKey = url === release.releaseUrl ? 'site.download.releasePage' : downloadStatus;
    } else {
      option.setAttribute('aria-disabled', 'true');
      option.removeAttribute('href');
      option.removeAttribute('target');
      option.removeAttribute('rel');
    }

    const status = option.querySelector<HTMLElement>('.release-status');
    if (status) {
      status.dataset.i18n = statusKey;
      status.textContent = t(statusKey);
    }
    const tag = option.querySelector<HTMLElement>('.release-tag');
    if (tag) tag.textContent = release ? ` · ${release.tagName}` : '';
  }
}

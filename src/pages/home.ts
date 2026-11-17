import '../styles/fonts.css';
import '../styles/theme.css';
import '../styles/layout.css';
import '../styles/site.css';
import { renderLandingPage } from './templates.ts';
import { fetchReleaseInfo } from './releases.ts';
import { updateDownloadOptions } from './releases-dom.ts';
import { initLanguage, t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { initTheme } from '../ui/theme.ts';
import { mountWindow } from '../window/scroll.ts';

renderLandingPage(document.querySelector<HTMLElement>('#root')!);
initLanguage();
initTheme();
fetchReleaseInfo().then(updateDownloadOptions);
const status = document.querySelector<HTMLElement>('#load-status')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
let dispose = () => {};
const desktop = window.matchMedia('(min-width: 1280px)');
function setStatus(key: MessageKey | null): void {
  if (key) status.dataset.i18n = key;
  else delete status.dataset.i18n;
  status.textContent = key ? t(key) : '';
}
function loadScene(): void {
  dispose();
  dispose = () => {};
  if (!desktop.matches) {
    setStatus(null);
    retry.hidden = true;
    return;
  }
  setStatus('site.loading'); retry.hidden = true;
  try {
    dispose = mountWindow(setStatus, () => { retry.hidden = false; });
  } catch (cause) {
    console.error(cause);
    setStatus('site.loadError');
    retry.hidden = false;
  }
}
retry.addEventListener('click', loadScene);
desktop.addEventListener('change', loadScene);
window.addEventListener('pagehide', () => dispose());
window.addEventListener('pageshow', event => { if (event.persisted) loadScene(); });
loadScene();

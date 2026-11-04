import '../styles/fonts.css';
import '../styles/theme.css';
import '../styles/layout.css';
import '../styles/site.css';
import { renderLandingPage } from './templates.ts';
import { initLanguage, t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { initTheme } from '../ui/theme.ts';
import { mountWindow } from '../window/scroll.ts';

renderLandingPage(document.querySelector<HTMLElement>('#root')!);
initLanguage();
initTheme();
const status = document.querySelector<HTMLElement>('#load-status')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
let dispose = () => {};
function setStatus(key: MessageKey | null): void {
  if (key) status.dataset.i18n = key;
  else delete status.dataset.i18n;
  status.textContent = key ? t(key) : '';
}
function loadScene(): void {
  dispose();
  setStatus('site.loading'); retry.hidden = true;
  dispose = mountWindow(setStatus, () => { retry.hidden = false; });
}
retry.addEventListener('click', loadScene);
window.addEventListener('pagehide', () => dispose());
window.addEventListener('pageshow', event => { if (event.persisted) loadScene(); });
loadScene();

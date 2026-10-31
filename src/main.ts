import '../fonts.css';
import '../theme.css';
import '../pages.css';
import '../style.css';
import { renderLandingPage } from './page.ts';
import { initLanguage, t } from './i18n.ts';
import type { MessageKey } from './i18n.ts';
import { initTheme } from './theme.ts';
import { mountDemo } from './demo.ts';

renderLandingPage(document.querySelector<HTMLElement>('#root')!);
initLanguage();
initTheme();
requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant', block: 'start' }));
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
  dispose = mountDemo(setStatus, () => { retry.hidden = false; });
}
retry.addEventListener('click', loadScene);
window.addEventListener('pagehide', () => dispose());
window.addEventListener('pageshow', event => { if (event.persisted) loadScene(); });
loadScene();

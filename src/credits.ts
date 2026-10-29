import '../fonts.css';
import '../theme.css';
import '../pages.css';
import '../style.css';
import { renderCreditsPage } from './page.ts';
import { initLanguage } from './i18n.ts';
import { initTheme } from './theme.ts';

renderCreditsPage(document.querySelector<HTMLElement>('#root')!);
initLanguage();
initTheme();

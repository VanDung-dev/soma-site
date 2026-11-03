import '../styles/fonts.css';
import '../styles/theme.css';
import '../styles/layout.css';
import '../styles/site.css';
import { renderCreditsPage } from './templates.ts';
import { initLanguage } from '../i18n/index.ts';
import { initTheme } from '../ui/theme.ts';

renderCreditsPage(document.querySelector<HTMLElement>('#root')!);
initLanguage();
initTheme();

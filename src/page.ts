import type { MessageKey } from './i18n.ts';
import { icon } from './icons.ts';

const text = (key: MessageKey, tag = 'span', attributes = '') => `<${tag} data-i18n="${key}" ${attributes}></${tag}>`;
const arrow = icon('right');
const focuses = [['head', 1], ['spine', 2], ['thorax', 0], ['upper', 3], ['lower', 4]] as const;
type FocusPart = typeof focuses[number][0];

function groupLabel(part: FocusPart, group: number, chapter: number): string {
  return `<div class="group-labels model-labels" data-chapter="${chapter}" hidden><div class="model-label" data-part="${part}" data-group="${group}"><span class="model-label-dot" aria-hidden="true"></span>${text(`site.skeleton.${part}`, 'span', 'class="model-label-card"')}</div></div>`;
}

function layout(home: string, content: string): string {
  return `<div class="module-page"><a class="skip-link" href="#journey" data-i18n="site.skip"></a>
    <header class="module-header">
      <a class="module-brand" href="${home}" data-i18n-aria-label="home.brand.label">${text('site.brand')}</a>
      <div class="module-preferences"><button id="language" class="page-toggle" type="button" data-i18n-aria-label="language.selector.label"></button><button id="theme" class="page-toggle theme-toggle" type="button"></button></div>
    </header><div class="module-content"><div class="model-space"><canvas class="workspace-grid" aria-hidden="true"></canvas>
      <div class="site-scroll">${content}</div>
    </div></div></div>`;
}

function chapter(id: 'structure' | FocusPart | 'whole', number: string): string {
  const detail = id === 'structure' ? `<div class="detail"><span class="detail-index" aria-hidden="true">I.</span><div>${text('site.structure.detailTitle', 'strong')}${text('site.structure.detail', 'p')}</div></div>` : '';
  return `<section id="${id}" class="chapter${id !== 'structure' && id !== 'whole' ? ' focus-chapter' : ''}" aria-labelledby="${id}-title"><div class="chapter-copy">${text(`site.${id}.eyebrow`, 'p', 'class="eyebrow"')}<h2 id="${id}-title">${text(`site.${id}.title1`)}<br />${text(`site.${id}.title2`, 'em')}</h2>${text(`site.${id}.description`, 'p', 'class="description"')}${detail}</div><div class="chapter-bottom"><span class="chapter-number">${number} <span>/ 08</span></span>${id === 'whole' ? `<a class="scroll-cue" href="#start">${text('site.backStart')}${icon('left')}</a>` : text(`site.${id}.bottom`, 'span', 'class="bottom-note"')}</div></section>`;
}

export function renderLandingPage(root: HTMLElement): void {
  root.innerHTML = layout('#start', `
    <main id="journey">
      <div class="stage"><canvas id="anatomy" aria-hidden="true"></canvas><div class="specimen" aria-hidden="true"><span class="specimen-cross">+</span>${text('site.figure.01', 'span', 'id="specimen-name"')}${text('site.figure.index.01', 'span', 'id="specimen-index"')}</div><div class="stage-caption" aria-hidden="true">${text('site.stage.system')}${text('site.stage.caption')}</div><div class="overview-labels model-labels" data-chapter="1" hidden>${(['head', 'chest', 'pelvis'] as const).map((part) => `<div class="model-label" data-part="${part}"><span class="model-label-dot" aria-hidden="true"></span>${text(`site.overview.${part}`, 'span', 'class="model-label-card"')}</div>`).join('')}</div>${focuses.map(([part, group], index) => groupLabel(part, group, index + 2)).join('')}</div>
      ${text('site.loading', 'p', 'id="load-status" class="load-status" role="status"')}<button id="retry" class="retry" type="button" hidden data-i18n="site.retry"></button>
      <section id="start" class="chapter hero" aria-labelledby="hero-title"><div class="chapter-copy"><p class="eyebrow"><span aria-hidden="true"></span>${text('site.hero.eyebrow')}</p><h1 id="hero-title">${text('site.hero.title1')}<br />${text('site.hero.title2')}<br />${text('site.hero.title3', 'em')}</h1>${text('site.hero.description', 'p', 'class="description"')}<a class="button primary" href="#structure">${text('site.hero.explore')}${arrow}</a><div class="hero-note"><span class="note-line" aria-hidden="true"></span>${text('site.hero.note')}</div></div><div class="chapter-bottom"><span class="chapter-number">01 <span>/ 08</span></span><a href="#structure" class="scroll-cue"><span class="mouse" aria-hidden="true"></span>${text('site.scroll')}${icon('down')}</a>${text('site.hero.bottom', 'span', 'class="bottom-note"')}</div></section>
      ${chapter('structure', '02')}${focuses.map(([part], index) => chapter(part, String(index + 3).padStart(2, '0'))).join('')}${chapter('whole', '08')}
    </main>
    <footer><a class="footer-brand" href="#start">${text('site.brand', 'strong')}${text('site.copyright')}</a><p>${text('site.modelCredit')}<br /><a href="./credits.html">${text('site.credits')}${arrow}</a></p><a class="back-top" href="#start" data-i18n-aria-label="site.top">${icon('left')}</a></footer>`);
}

export function renderCreditsPage(root: HTMLElement): void {
  const link = (key: MessageKey, href: string) => `<a href="${href}">${text(key)}</a>`;
  root.innerHTML = layout('./', `<main id="journey" class="credits-page">${link('credits.back', './')}<h1>${text('credits.heading1')}<br />${text('credits.heading2', 'em')}</h1>${text('credits.code', 'p')}${link('credits.codeLink', './LICENSE')}
    ${text('credits.models.heading', 'h2')}${text('credits.models.source', 'p')}${text('credits.models.terms', 'p')}${link('credits.models.link', './models/z-anatomy/ATTRIBUTION.md')}${text('credits.models.changes', 'p')}
    ${text('credits.images.heading', 'h2')}${text('credits.images.description', 'p')}<ul><li>${link('credits.images.preview', './home/ATTRIBUTION.md')}</li><li>${link('credits.images.icon', './icons/ATTRIBUTION.md')}</li></ul>
    ${text('credits.fonts.heading', 'h2')}${text('credits.fonts.description', 'p')}<ul><li>${link('credits.lato', './fonts/Lato-OFL.txt')}</li><li>${link('credits.merriweather', './fonts/Merriweather-OFL.txt')}</li><li>${link('credits.icons', './licenses/line-md-MIT.txt')}</li><li>${link('credits.three', './licenses/three-MIT.txt')}</li></ul>
    ${text('credits.scope.heading', 'h2')}${text('credits.scope.description', 'p')}</main>`);
}

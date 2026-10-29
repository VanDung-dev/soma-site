import type { MessageKey } from './i18n.ts';
import { icon } from './icons.ts';

const text = (key: MessageKey, tag = 'span', attributes = '') => `<${tag} data-i18n="${key}" ${attributes}></${tag}>`;
const arrow = icon('right');
const focuses = ['head', 'spine', 'thorax', 'upper', 'lower'] as const;
const sources = {
  structure: '7-1-divisions-of-the-skeletal-system',
  head: '7-2-the-skull',
  spine: '7-3-the-vertebral-column',
  thorax: '7-4-the-thoracic-cage',
  upper: '8-2-bones-of-the-upper-limb',
  lower: '8-4-bones-of-the-lower-limb',
} as const;
type Lesson = keyof typeof sources;

function studyContent(id: Lesson): string {
  return `<details class="study-content"><summary>${text('study.discover')}<span aria-hidden="true">+</span></summary><div class="study-body"><p class="learning-goal">${text('study.goal', 'strong')}${text(`site.${id}.objective`)}</p>
    <ul class="key-points"><li>${text(`site.${id}.fact1`)}</li><li>${text(`site.${id}.fact2`)}</li></ul>
    <details class="knowledge-check"><summary>${text('study.check')}<span aria-hidden="true">+</span></summary><div class="check-content">${text(`site.${id}.question`, 'p')}<details class="answer"><summary>${text('study.answer')}</summary>${text(`site.${id}.answer`, 'p')}</details></div></details>
    <a class="lesson-source" href="https://openstax.org/books/anatomy-and-physiology-2e/pages/${sources[id]}" target="_blank" rel="noopener noreferrer">${text('study.source')} <span>OpenStax · ${sources[id].split('-').slice(0, 2).join('.')}</span>${icon('right')}${text('study.newTab', 'span', 'class="sr-only"')}</a></div></details>`;
}

function layout(home: string, content: string, footer = ''): string {
  return `<div class="module-page"><a class="skip-link" href="#journey" data-i18n="site.skip"></a>
    <header class="module-header">
      <a class="module-brand" href="${home}" data-i18n-aria-label="home.brand.label">${text('site.brand')}</a>
      <div class="module-preferences"><button id="language" class="page-toggle" type="button" data-i18n-aria-label="language.selector.label"></button><button id="theme" class="page-toggle theme-toggle" type="button"></button></div>
    </header><div class="module-content"><div class="model-space${footer ? ' has-footer' : ''}"><canvas class="workspace-grid" aria-hidden="true"></canvas>
      <div class="site-scroll">${content}</div>${footer}
    </div></div></div>`;
}

function chapter(id: Lesson): string {
  const focused = id !== 'structure';
  const heading = `${text(`site.${id}.eyebrow`, 'p', 'class="eyebrow"')}<h2 id="${id}-title">${text(`site.${id}.title1`)}<br />${text(`site.${id}.title2`, 'em')}</h2>`;
  const description = `${text(`site.${id}.description`, 'p', 'class="description"')}${studyContent(id)}`;
  return `<section id="${id}" class="chapter lesson-chapter${focused ? ' focus-chapter' : ''}" aria-labelledby="${id}-title"><div class="chapter-copy">${heading}${focused ? '' : description}</div>${focused ? `<div class="chapter-info">${text(`site.${id}.fact1`, 'p', 'class="description"')}${text(`site.${id}.description`, 'p', 'class="chapter-observation"')}${studyContent(id)}</div>` : ''}</section>`;
}

function downloadChapter(): string {
  return `<section id="whole" class="chapter download-chapter" aria-labelledby="download-title"><div class="chapter-copy">${text('site.download.eyebrow', 'p', 'class="eyebrow"')}<h2 id="download-title">${text('site.download.title1')}<br />${text('site.download.title2', 'em')}</h2>${text('site.download.description', 'p', 'class="description"')}<div class="download-options"><button type="button" class="download-option" disabled><span>Windows</span>${text('site.download.unavailable', 'small')}</button><button type="button" class="download-option" disabled><span>macOS</span>${text('site.download.unavailable', 'small')}</button></div></div></section>`;
}

export function renderLandingPage(root: HTMLElement): void {
  root.innerHTML = layout('#start', `
    <main id="journey">
      <div class="stage"><canvas id="anatomy" aria-hidden="true"></canvas><div class="specimen" aria-hidden="true"><span class="specimen-cross">+</span>${text('site.figure.01', 'span', 'id="specimen-name"')}</div></div>
      ${text('site.loading', 'p', 'id="load-status" class="load-status" role="status"')}<button id="retry" class="retry" type="button" hidden data-i18n="site.retry"></button>
      <section id="start" class="chapter hero" aria-labelledby="hero-title"><div class="chapter-copy"><p class="eyebrow"><span aria-hidden="true"></span>${text('site.hero.eyebrow')}</p><h1 id="hero-title" data-i18n-aria-label="study.heroTitle">${text('site.hero.title1')}<br />${text('site.hero.title2')}<br /> ${text('site.hero.title3', 'em')}</h1>${text('site.hero.description', 'p', 'class="description"')}<a class="button primary" href="#structure">${text('site.hero.explore')}${arrow}</a><div class="hero-note"><span class="note-line" aria-hidden="true"></span>${text('site.hero.note')}</div></div><div class="chapter-bottom"><a href="#structure" class="scroll-cue">${text('site.scroll')}${icon('down')}</a></div></section>
      ${chapter('structure')}${focuses.map(part => chapter(part)).join('')}${downloadChapter()}
    </main>`, `<footer class="site-footer">${text('site.copyright')}${text('site.modelCredit', 'span', 'class="footer-credit"')}<a href="./credits.html">${text('site.credits')}${arrow}</a></footer>`);
}

export function renderCreditsPage(root: HTMLElement): void {
  const link = (key: MessageKey, href: string) => `<a href="${href}">${text(key)}</a>`;
  root.innerHTML = layout('./', `<main id="journey" class="credits-page">${link('credits.back', './')}<h1>${text('credits.heading1')}<br />${text('credits.heading2', 'em')}</h1>${text('credits.code', 'p')}${link('credits.codeLink', './LICENSE')}
    ${text('credits.models.heading', 'h2')}${text('credits.models.source', 'p')}${text('credits.models.terms', 'p')}${link('credits.models.link', './models/z-anatomy/ATTRIBUTION.md')}${text('credits.models.changes', 'p')}
    ${text('credits.images.heading', 'h2')}${text('credits.images.description', 'p')}<ul><li>${link('credits.images.preview', './home/ATTRIBUTION.md')}</li><li>${link('credits.images.icon', './icons/ATTRIBUTION.md')}</li></ul>
    ${text('credits.fonts.heading', 'h2')}${text('credits.fonts.description', 'p')}<ul><li>${link('credits.lato', './fonts/Lato-OFL.txt')}</li><li>${link('credits.merriweather', './fonts/Merriweather-OFL.txt')}</li><li>${link('credits.icons', './licenses/line-md-MIT.txt')}</li><li>${link('credits.three', './licenses/three-MIT.txt')}</li></ul>
    ${text('credits.scope.heading', 'h2')}${text('credits.scope.description', 'p')}${text('study.method.title', 'h2')}<ol class="study-steps"><li>${text('study.method.step1.title', 'h3')}${text('study.method.step1.body', 'p')}</li><li>${text('study.method.step2.title', 'h3')}${text('study.method.step2.body', 'p')}</li><li>${text('study.method.step3.title', 'h3')}${text('study.method.step3.body', 'p')}</li></ol>${text('study.scope.review', 'p')}</main>`);
}

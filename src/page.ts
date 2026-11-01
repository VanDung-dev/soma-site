import type { MessageKey } from './i18n.ts';
import { icon } from './icons.ts';

const text = (key: MessageKey, tag = 'span', attributes = '') => `<${tag} data-i18n="${key}" ${attributes}></${tag}>`;
const arrow = icon('right');

function layout(home: string, content: string, footer = ''): string {
  return `<div class="module-page"><a class="skip-link" href="#journey" data-i18n="site.skip"></a>
    <header class="module-header">
      <a class="module-brand" href="${home}" data-i18n-aria-label="home.brand.label">${text('site.brand')}</a>
      <div class="module-preferences"><button id="language" class="page-toggle" type="button" data-i18n-aria-label="language.selector.label"></button><button id="theme" class="page-toggle theme-toggle" type="button"></button></div>
    </header><div class="module-content"><div class="model-space${footer ? ' has-footer' : ''}">
      <div class="site-scroll">${content}</div>${footer}
    </div></div></div>`;
}

function introductionSection(): string {
  return `<section id="start" class="product-section intro-section" data-scene="0" aria-labelledby="hero-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="hero-title"><header class="product-header">${text('site.hero.eyebrow', 'p', 'class="eyebrow"')}<h1 id="hero-title" data-i18n-aria-label="study.heroTitle">${text('site.hero.title1')}<br />${text('site.hero.title2', 'em')}</h1>${text('site.hero.description', 'p', 'class="description"')}</header><a class="button primary" href="#learn">${text('site.hero.explore')}${arrow}</a><p class="product-link"><a href="#app-overview">${text('product.learn.action')}${arrow}</a></p>${text('site.hero.note', 'p', 'class="intro-note"')}</div></section>`;
}

function appOverviewSection(): string {
  return `<section id="learn" class="product-section feature-section overview-section" data-scene="1" aria-labelledby="overview-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="overview-title"><header class="product-header">${text('demo.scope', 'p', 'class="eyebrow"')}${text('demo.title', 'h2', 'id="overview-title"')}${text('demo.overview', 'p', 'class="description"')}</header>${text('demo.hint', 'p', 'class="feature-note"')}<p class="product-link"><a href="#app-overview">${text('demo.continue')}${arrow}</a></p></div></section>`;
}

function spreadSection(): string {
  return `<section id="app-overview" class="product-section feature-section" data-scene="2" aria-labelledby="spread-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="spread-title"><header class="product-header">${text('demo.spread.title', 'h2', 'id="spread-title"')}${text('demo.spread.body', 'p', 'class="description"')}</header><p class="product-link"><a href="#essentials">${text('demo.continue')}${arrow}</a></p></div></section>`;
}

function demoInterface(): string {
  return `<div class="demo-shell" aria-hidden="true"><header class="demo-titlebar"><span class="demo-lights"><i></i><i></i><i></i></span><strong>Human Atlas</strong></header><div class="demo-workspace"></div></div>`;
}

function essentialsSection(): string {
  const facts = ['scope', 'language', 'platform', 'network', 'requirements', 'cost'] as const;
  return `<section id="essentials" class="product-section text-section" aria-labelledby="essentials-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="essentials-title"><header class="product-header">${text('product.essentials.eyebrow', 'p', 'class="eyebrow"')}${text('product.essentials.title', 'h2', 'id="essentials-title"')}${text('product.essentials.description', 'p', 'class="description"')}</header><dl class="product-facts">${facts.map(fact => `<div>${text(`product.essentials.${fact}.title`, 'dt')}${text(`product.essentials.${fact}.body`, 'dd')}</div>`).join('')}</dl><aside class="product-note" aria-labelledby="reference-note-title">${text('product.trust.title', 'h3', 'id="reference-note-title"')}${text('product.trust.body', 'p')}<a href="./credits.html">${text('product.trust.action')}${arrow}</a></aside><p class="product-link"><a href="#download">${text('product.essentials.action')}${arrow}</a></p></div></section>`;
}

function releaseSection(): string {
  return `<section id="download" class="product-section release-section text-section" aria-labelledby="download-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="download-title"><header class="product-header">${text('product.release.eyebrow', 'p', 'class="eyebrow"')}${text('product.release.title', 'h2', 'id="download-title"')}${text('product.release.description', 'p', 'class="description"')}</header><div class="download-options" role="group" data-i18n-aria-label="product.release.platforms"><button type="button" class="download-option" disabled><span>Windows</span>${text('site.download.unavailable', 'small')}</button><button type="button" class="download-option" disabled><span>macOS</span>${text('site.download.unavailable', 'small')}</button></div><p class="product-link"><a href="#start">${text('product.release.action')}${arrow}</a></p></div></section>`;
}

export function renderLandingPage(root: HTMLElement): void {
  root.innerHTML = layout('#start', `
    <main id="journey"><div class="anatomy-journey">
      <div class="stage" data-layout="hero"><div class="demo-window">${demoInterface()}<div id="demo-viewer-host"></div></div>${text('site.loading', 'p', 'id="load-status" class="load-status" role="status"')}<button id="retry" class="retry" type="button" hidden data-i18n="site.retry"></button></div>
      ${introductionSection()}
    ${appOverviewSection()}${spreadSection()}${essentialsSection()}${releaseSection()}</div></main>`, `<footer class="site-footer">${text('site.copyright')}${text('site.modelCredit', 'span', 'class="footer-credit"')}<a href="./credits.html">${text('site.credits')}${arrow}</a></footer>`);
}

export function renderCreditsPage(root: HTMLElement): void {
  const link = (key: MessageKey, href: string) => `<a href="${href}">${text(key)}</a>`;
  root.innerHTML = layout('./', `<main id="journey" class="credits-page">${link('credits.back', './')}<h1>${text('credits.heading1')}<br />${text('credits.heading2', 'em')}</h1>${text('credits.code', 'p')}${link('credits.codeLink', './LICENSE')}
    ${text('credits.models.heading', 'h2')}${text('credits.models.source', 'p')}${text('credits.models.terms', 'p')}${link('credits.models.link', './models/z-anatomy/ATTRIBUTION.md')}${text('credits.models.changes', 'p')}
    ${text('credits.images.heading', 'h2')}${text('credits.images.description', 'p')}<ul><li>${link('credits.images.preview', './home/ATTRIBUTION.md')}</li><li>${link('credits.images.icon', './icons/ATTRIBUTION.md')}</li></ul>
    ${text('credits.fonts.heading', 'h2')}${text('credits.fonts.description', 'p')}<ul><li>${link('credits.lato', './fonts/Lato-OFL.txt')}</li><li>${link('credits.merriweather', './fonts/Merriweather-OFL.txt')}</li><li>${link('credits.icons', './licenses/line-md-MIT.txt')}</li></ul>
    ${text('credits.scope.heading', 'h2')}${text('credits.scope.description', 'p')}</main>`);
}

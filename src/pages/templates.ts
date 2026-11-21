import type { MessageKey } from '../i18n/index.ts';
import { icon } from '../ui/icons.ts';

const text = (key: MessageKey, tag = 'span', attributes = '') => `<${tag} data-i18n="${key}" ${attributes}></${tag}>`;
const arrow = icon('right');
const somaRepositoryUrl = 'https://github.com/VanDung-dev/soma';

function layout(root: HTMLElement, content: string): void {
  root.innerHTML = `<button class="skip-link" type="button" data-i18n="site.skip"></button><div class="module-page">
    <header class="module-header">
      <a class="module-brand" href="./" data-i18n-aria-label="home.brand.label">${text('site.brand')}</a>
      <div class="module-preferences">
        <a class="page-toggle github-link" href="${somaRepositoryUrl}" target="_blank" rel="noopener noreferrer" data-i18n-aria-label="site.github" data-i18n-title="site.github">${icon('github')}</a>
        <button id="language" class="page-toggle" type="button" data-i18n-aria-label="language.selector.label"></button>
        <button id="theme" class="page-toggle theme-toggle" type="button"></button>
      </div>
    </header><div class="module-content"><div class="model-space">
      <div class="site-scroll">${content}</div>
    </div></div></div>`;
  root.querySelector<HTMLButtonElement>('.skip-link')!.addEventListener('click', () => root.querySelector<HTMLElement>('main')!.focus());
}

function downloadOptions(): string {
  return `<div class="download-options" role="group" data-i18n-aria-label="product.release.platforms"><a class="download-option" data-platform="windows" aria-disabled="true"><span>${icon('windows')}Windows <span class="platform-arch" data-i18n="site.download.arch.windows">x64</span></span>${text('site.download.unavailable', 'small')}</a><a class="download-option" data-platform="macos" aria-disabled="true"><span>${icon('apple')}macOS <span class="platform-arch" data-i18n="site.download.arch.macos">Apple Silicon</span></span>${text('site.download.unavailable', 'small')}</a></div>`;
}

function demoPreview(page: 'learn' | 'spread'): string {
  return `<figure class="compact-preview" aria-hidden="true"><img class="preview-light" src="./home/preview-${page}-light.webp" width="1200" height="800" alt="" /><img class="preview-dark" src="./home/preview-${page}-dark.webp" width="1200" height="800" alt="" /></figure>`;
}

function appLogoPreview(): string {
  return '<figure class="app-logo-preview" aria-hidden="true"><img src="./icons/app-icon.png" width="1024" height="1024" alt="" loading="lazy" decoding="async" /></figure>';
}

function introductionSection(): string {
  return `<section id="start" class="product-section intro-section" data-scene="0" aria-labelledby="hero-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="hero-title">${appLogoPreview()}<header class="product-header">${text('site.hero.eyebrow', 'p', 'class="eyebrow"')}<h1 id="hero-title" data-i18n-aria-label="study.heroTitle">${text('site.hero.title1')}<br />${text('site.hero.title2', 'em')}</h1>${text('site.hero.description', 'p', 'class="description"')}</header><a class="compact-explore" href="#learn">${text('site.exploreDemo')}${arrow}</a>${downloadOptions()}</div></section>`;
}

function appOverviewSection(): string {
  return `<section id="learn" class="product-section feature-section overview-section" data-scene="1" aria-labelledby="overview-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="overview-title"><header class="product-header">${text('window.scope', 'p', 'class="eyebrow"')}${text('window.title', 'h2', 'id="overview-title"')}${text('window.overview', 'p', 'class="description"')}</header>${text('window.hint', 'p', 'class="feature-note"')}${demoPreview('learn')}</div></section>`;
}

function spreadSection(): string {
  return `<section id="app-overview" class="product-section feature-section" data-scene="2" aria-labelledby="spread-title"><div class="product-inner" tabindex="0" role="region" aria-labelledby="spread-title"><header class="product-header">${text('window.spread.title', 'h2', 'id="spread-title"')}${text('window.spread.body', 'p', 'class="description"')}</header>${demoPreview('spread')}</div></section>`;
}

function windowInterface(): string {
  return `<div class="window-shell" aria-hidden="true"><header class="window-titlebar"><span class="window-lights"><i></i><i></i><i></i></span><strong>Soma</strong></header><div class="window-workspace"></div></div>`;
}

function releaseSection(): string {
  return `<section id="download" class="product-section closing-section" data-scene="3" aria-labelledby="sources-title">
    <div class="product-inner" tabindex="0" role="region" aria-labelledby="sources-title">
      <header class="product-header">${text('product.trust.title', 'h2', 'id="sources-title"')}${text('product.trust.body', 'p', 'class="description"')}</header>
      <a class="source-link" href="./NOTICE.txt" target="_blank" rel="noopener noreferrer">${text('product.trust.action')}${arrow}</a>
      ${downloadOptions()}
      <footer class="site-footer">
        ${text('site.copyright')}${text('site.modelCredit')}
        <div class="footer-links">
          <a href="./NOTICE.txt" target="_blank" rel="noopener noreferrer">${text('site.credits')}${arrow}</a>
          <a href="${somaRepositoryUrl}" target="_blank" rel="noopener noreferrer">${text('site.github')}${arrow}</a>
        </div>
      </footer>
    </div>
  </section>`;
}

export function renderLandingPage(root: HTMLElement): void {
  layout(root, `
    <main id="journey" tabindex="-1"><div class="anatomy-journey">
      <div class="stage" data-layout="hero"><div class="window">${windowInterface()}<div id="window-viewer-host"></div></div>${text('site.loading', 'p', 'id="load-status" class="load-status" role="status"')}<button id="retry" class="retry" type="button" hidden data-i18n="site.retry"></button></div>
      ${introductionSection()}
    ${appOverviewSection()}${spreadSection()}${releaseSection()}</div></main>`);
}

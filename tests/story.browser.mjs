import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const { chromium } = await import(process.env.BENCHMARK_PLAYWRIGHT_MODULE || 'playwright');
const screenshots = process.env.SITE_SCREENSHOTS || path.join(os.tmpdir(), 'human-atlas-site-mini');
fs.mkdirSync(screenshots, { recursive: true });
const baseUrl = process.env.SITE_TEST_URL || 'http://127.0.0.1:4188/';
const server = process.env.SITE_TEST_URL ? undefined : await preview({ root: fileURLToPath(new URL('..', import.meta.url)), preview: { host: '127.0.0.1', port: 4188, strictPort: true } });
const viewports = [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844], ['short', 1280, 720], ['16-9', 1920, 1080], ['16-10', 1920, 1200]];
assert.ok(!process.argv[2] || process.argv[2] === 'resilience' || viewports.some(([name]) => name === process.argv[2]));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.BENCHMARK_BROWSER, headless: true, chromiumSandbox: true, args: ['--enable-unsafe-swiftshader'] });
  for (const [name, width, height] of viewports.filter(([name]) => !process.argv[2] || name === process.argv[2])) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: ['tablet', '16-9', '16-10'].includes(name) ? 'dark' : 'light' });
    await page.addInitScript(() => {
      window.demoCanvasResizes = 0;
      window.demoBackdropDraws = 0;
      window.demoChromeEvents = [];
      window.demoCameraFrames = [];
      const names = new WeakMap();
      const location = WebGL2RenderingContext.prototype.getUniformLocation;
      WebGL2RenderingContext.prototype.getUniformLocation = function(...args) {
        const result = location.apply(this, args);
        if (result) names.set(result, args[1]);
        return result;
      };
      const vector = WebGL2RenderingContext.prototype.uniform3f;
      WebGL2RenderingContext.prototype.uniform3f = function(location, x, y, z) {
        if (names.get(location) === 'eye') {
          const stage = document.querySelector('.stage');
          const progress = Number(stage?.dataset.progress);
          if (progress > 0 && progress < 1) window.demoCameraFrames.push({ time: performance.now(), scene: stage.dataset.scene, progress, eye: [x, y, z] });
        }
        return vector.call(this, location, x, y, z);
      };
      const matrix = WebGL2RenderingContext.prototype.uniformMatrix4fv;
      WebGL2RenderingContext.prototype.uniformMatrix4fv = function(location, transpose, values, ...rest) {
        if (names.get(location) === 'view_projection') window.demoProjectionAspect = Math.hypot(values[1], values[5], values[9]) / Math.hypot(values[0], values[4], values[8]);
        return matrix.call(this, location, transpose, values, ...rest);
      };
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function(...args) {
        window.demoBackdropDraws++;
        return draw.apply(this, args);
      };
      new MutationObserver(records => {
        for (const record of records) {
          const stage = record.target;
          if (stage.matches('.stage') && stage.dataset.chrome === 'visible') {
            window.demoChromeEvents.push({ scene: stage.dataset.scene, settled: stage.dataset.settled, moving: document.querySelector('.demo-window').getAnimations().some(animation => animation.playState === 'running') });
          }
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-chrome'] });
      for (const name of ['width', 'height']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, name);
        Object.defineProperty(HTMLCanvasElement.prototype, name, { ...descriptor, set(value) {
          window.demoCanvasResizes++;
          descriptor.set.call(this, value);
        } });
      }
    });
    page.setDefaultTimeout(10000);
    const errors = [], models = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    page.on('request', request => { if (/\.glb(?:\.br)?(?:\?|$)/.test(request.url())) models.push(request.url()); });
    const visit = async (id, scene) => {
      const previous = await page.locator('.stage').getAttribute('data-scene');
      const resizes = await page.evaluate(() => window.demoCanvasResizes);
      await page.evaluate(() => { window.demoCameraFrames = []; });
      await page.locator(`#${id}`).evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.waitForFunction(id => Math.abs(document.querySelector('.site-scroll').scrollTop - document.getElementById(id).offsetTop) < 2, id);
      await page.waitForSelector(`.stage[data-scene="${scene}"][data-settled="true"]`, { state: 'attached' });
      if (scene !== 'none') await page.waitForFunction(visible => getComputedStyle(document.querySelector('.demo-shell')).opacity === (visible ? '1' : '0'), scene !== 0);
      if (['0:1', '1:0', '1:2', '2:1'].includes(`${previous}:${scene}`)) {
        assert.ok(await page.evaluate(() => window.demoCanvasResizes) - resizes <= 2, 'A chapter transition must resize the WebGL buffer at most once');
        const frames = await page.evaluate(scene => window.demoCameraFrames.filter(frame => frame.scene === String(scene)), scene);
        assert.ok(frames.length > 1 && frames.some(frame => frame.progress > 0.05 && frame.progress < 0.95), 'The camera must follow intermediate scroll progress');
      }
    };
    await page.goto(baseUrl);
    await page.waitForSelector('.stage[data-ready][data-settled="true"]');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#demo-viewer-host canvas')).opacity === '1');
    assert.equal(await page.locator('.product-section').count(), 5);
    const frame = page.locator('.demo-window');
    const heroFrame = await frame.boundingBox();
    let initialFrame;
    const checkFrame = async (layout = 'split') => {
      const bounds = await frame.boundingBox();
      if (layout === 'hero') {
        const viewport = await page.locator('.site-scroll').boundingBox();
        const expected = width > 700
          ? { x: viewport.x + viewport.width * 0.41, y: viewport.y, width: viewport.width * 0.59, height: viewport.height }
          : { x: viewport.x + viewport.width * 0.3, y: viewport.y, width: viewport.width * 0.7, height: viewport.height * 0.42 };
        for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(bounds[key] - expected[key]) < 2, `Hero ${key} must return to its fixed layout after scrolling`);
      }
      if (layout !== 'hero') assert.ok(Math.abs(bounds.width / bounds.height - 1.5) < 0.01, 'App window must keep its 3:2 aspect ratio');
      if (['split', 'right'].includes(layout) && initialFrame) for (const key of ['y', 'width', 'height']) assert.ok(Math.abs(bounds[key] - initialFrame[key]) < 2, 'Split app window must keep its size and height');
      const canvas = page.locator('#demo-viewer-host canvas');
      assert.equal(await canvas.count(), 1);
      assert.equal(await canvas.getAttribute('tabindex'), '-1');
      assert.equal(await canvas.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      const model = await canvas.boundingBox();
      const projectionAspect = await page.evaluate(() => window.demoProjectionAspect);
      assert.ok(Math.abs(projectionAspect - model.width / model.height) < 0.005, `The camera projection must match the displayed canvas aspect ratio without stretching anatomy: ${projectionAspect} vs ${model.width / model.height}`);
      assert.ok(model.x >= bounds.x - 0.5 && model.y >= bounds.y - 0.5 && model.x + model.width <= bounds.x + bounds.width + 0.5 && model.y + model.height <= bounds.y + bounds.height + 0.5, `Canvas must remain inside the app window: ${JSON.stringify({ bounds, model, layout })}`);
      assert.equal(await frame.evaluate(el => getComputedStyle(el).overflow), 'hidden');
      assert.equal(await frame.locator('button:not([hidden]),input,a').count(), 0);
      assert.equal(await frame.locator('nav,.demo-active,.demo-language,.demo-axis,.demo-model-status,.demo-search-preview,.demo-info').count(), 0);
      assert.equal(await frame.locator('.demo-shell').evaluate(el => getComputedStyle(el).opacity), layout === 'hero' ? '0' : '1');
      assert.equal(await frame.evaluate(el => getComputedStyle(el, '::before').opacity), layout === 'hero' ? '0' : '1');
      if (width > 700 && ['split', 'right'].includes(layout)) {
        const viewport = await page.locator('.site-scroll').boundingBox();
        const expectedLeft = layout === 'right' ? viewport.x + viewport.width * 0.975 - bounds.width : viewport.x + viewport.width * 0.025;
        assert.ok(Math.abs(bounds.x - expectedLeft) < 2, 'Chapter two must place the app on the right; all later demo chapters share the same left position');
      }
    };
    await checkFrame('hero');
    if (['16-9', '16-10'].includes(name)) {
      assert.ok(await page.locator('#hero-title').evaluate(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) * 2 + 1), 'The wide-screen hero title must stay on two lines');
    }
    assert.equal(await page.evaluate(() => window.demoBackdropDraws), 0, 'The opening chapter must not draw the app grid');
    const canvasBefore = await page.locator('#demo-viewer-host').screenshot();
    const drag = { x: heroFrame.x + heroFrame.width * 0.75, y: heroFrame.y + heroFrame.height * 0.25 };
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.x + 30, drag.y + 15, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.ok((await page.locator('#demo-viewer-host').screenshot()).equals(canvasBefore), 'Dragging the preview must not rotate the model');
    if (name === '16-9') {
      await page.evaluate(() => {
        window.demoScrollSamples = [];
        document.querySelector('.site-scroll').addEventListener('scroll', event => window.demoScrollSamples.push(event.target.scrollTop));
      });
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, 24);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(200);
      const positions = await page.evaluate(() => window.demoScrollSamples);
      assert.ok(positions.at(-1) >= 450, 'Small downward wheel inputs must accumulate instead of snapping back');
      assert.ok(positions.every((position, i) => !i || position >= positions[i - 1] - 0.5), 'Downward wheel input must not move the page backwards');
      await visit('start', 0);
    }
    await page.mouse.wheel(0, height * 0.6);
    await page.waitForSelector('.stage[data-scene="1"][data-settled="true"]');
    await visit('learn', 1);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.demo-shell')).opacity === '1');
    initialFrame = await frame.boundingBox();
    await checkFrame('right');
    const reveals = await page.evaluate(() => window.demoChromeEvents.filter(event => event.scene === '1'));
    assert.ok(reveals.length > 0 && reveals.every(event => event.settled === 'true' && !event.moving), 'The app frame must appear after both the model and its window settle');
    assert.ok(await page.evaluate(() => window.demoBackdropDraws) > 0);
    await page.locator('.site-scroll').evaluate(el => el.scrollTo({ top: document.querySelector('#app-overview').offsetTop + el.clientHeight * 0.75, behavior: 'instant' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.stage')).opacity === '0');
    await visit('learn', 1);
    assert.equal(await page.locator('.stage').evaluate(el => getComputedStyle(el).opacity), '1', 'Returning from the text chapters must restore the demo opacity');
    for (const [id, scene] of [['start', 0], ['learn', 1], ['app-overview', 2], ['essentials', 'none'], ['download', 'none'], ['app-overview', 2], ['learn', 1], ['start', 0]]) {
      await visit(id, scene);
      const layout = scene === 'none' ? 'none' : scene === 0 ? 'hero' : scene === 1 ? 'right' : 'split';
      assert.equal(await page.locator('.stage').getAttribute('data-layout'), scene === 0 ? 'right' : scene === 1 ? 'split' : layout);
      if (layout === 'none') assert.equal(await page.locator('.stage').evaluate(el => getComputedStyle(el).visibility), 'hidden');
      else await checkFrame(layout);
      assert.equal(await page.locator('#' + id).evaluate(el => Math.abs(el.clientHeight - document.querySelector('.site-scroll').clientHeight) < 2), true);
      const textBounds = await page.locator('#' + id + ' .product-inner').boundingBox();
      if (['split', 'right', 'hero'].includes(layout)) {
        const app = await frame.boundingBox();
        assert.ok(width > 700 ? textBounds.x >= app.x + app.width - 1 || textBounds.x + textBounds.width <= app.x + 1 : textBounds.y >= app.y + app.height - 1, 'Copy must not overlap the app window');
      }
      await page.screenshot({ path: path.join(screenshots, name + '-' + id + '.png') });
      const panel = page.locator('#' + id + ' .product-inner');
      if (await panel.evaluate(el => el.scrollHeight > el.clientHeight + 2)) {
        const position = await page.locator('.site-scroll').evaluate(el => el.scrollTop);
        await panel.press('End');
        await page.waitForFunction(id => document.querySelector('#' + id + ' .product-inner').scrollTop > 0, id);
        assert.ok(Math.abs(await page.locator('.site-scroll').evaluate(el => el.scrollTop) - position) < 2);
      }
    }
    await page.locator('#language').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await visit('learn', 1);
    await page.screenshot({ path: path.join(screenshots, name + '-english.png') });
    await visit('app-overview', 2);
    assert.equal(await page.locator('#demo-viewer-host canvas').getAttribute('aria-label'), 'One window. Many ways to explore.');
    assert.equal(await page.locator('#download .download-option:disabled').count(), 2);
    assert.equal(models.length, 1);
    assert.ok(models[0].endsWith('/models/z-anatomy/skeletal-system.glb.br'));
    assert.equal(await page.locator('.site-scroll').evaluate(el => el.scrollWidth > el.clientWidth), false);
    await visit('learn', 1);
    assert.deepEqual(errors, []);
    console.log(`${name}: scroll scenes, fixed 3:2 app window, clipped noninteractive viewer, language and navigation passed`);
    await page.close();
  }
  if (!process.argv[2] || process.argv[2] === 'resilience') {
  const failed = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  failed.setDefaultTimeout(10000);
  await failed.route('**/models/z-anatomy/skeletal-system.glb.br', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await failed.goto(new URL('#app-overview', baseUrl).href);
  await failed.waitForSelector('#retry:not([hidden])');
  assert.equal(await failed.locator('.product-section').count(), 5);
  await failed.unroute('**/models/z-anatomy/skeletal-system.glb.br');
  await failed.locator('#retry').click();
  await failed.waitForSelector('.stage[data-ready][data-scene="2"][data-settled="true"]');
  await failed.locator('#learn').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await failed.waitForSelector('.stage[data-scene="1"][data-settled="true"]');
  await failed.setViewportSize({ width: 620, height: 760 });
  await failed.waitForFunction(() => {
    const canvas = document.querySelector('#demo-viewer-host canvas');
    const host = document.querySelector('#demo-viewer-host').getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio, 2);
    return canvas.width === Math.round(host.width * ratio) && canvas.height === Math.round(host.height * ratio);
  });
  await failed.evaluate(() => document.querySelector('#demo-viewer-host canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await failed.waitForSelector('#retry:not([hidden])');
  const retryPosition = await failed.locator('.site-scroll').evaluate(el => el.scrollTop);
  const retryBounds = await failed.locator('#retry').boundingBox();
  assert.ok(retryBounds && retryBounds.y >= 0 && retryBounds.y + retryBounds.height <= 760);
  await failed.mouse.click(retryBounds.x + retryBounds.width / 2, retryBounds.y + retryBounds.height / 2);
  await failed.waitForSelector('.stage[data-ready][data-scene="1"][data-settled="true"]');
  assert.ok(Math.abs(await failed.locator('.site-scroll').evaluate(el => el.scrollTop) - retryPosition) < 2);
  await failed.goto(new URL('credits.html', baseUrl).href);
  assert.equal(await failed.locator('.credits-page h1').count(), 1);
  await failed.close();
  const wasmFailure = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  wasmFailure.setDefaultTimeout(10000);
  await wasmFailure.route('**/*content_bg*.wasm', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await wasmFailure.goto(new URL('#learn', baseUrl).href);
  await wasmFailure.waitForSelector('#retry:not([hidden])');
  await wasmFailure.unroute('**/*content_bg*.wasm');
  await wasmFailure.locator('#retry').click();
  await wasmFailure.waitForSelector('.stage[data-ready][data-scene="1"][data-settled="true"]');
  await wasmFailure.close();
  const motion = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await motion.goto(baseUrl);
  await motion.waitForSelector('.stage[data-ready][data-settled="true"]');
  await motion.setViewportSize({ width: 1440, height: 1000 });
  await motion.waitForFunction(() => {
    const viewport = document.querySelector('.site-scroll').getBoundingClientRect();
    const frame = document.querySelector('.demo-window').getBoundingClientRect();
    return Math.abs(frame.x - viewport.x - viewport.width * 0.41) < 2 && Math.abs(frame.height - viewport.height) < 2;
  });
  for (const [id, scene] of [['learn', 1], ['start', 0], ['learn', 1], ['start', 0]]) {
    await motion.locator(`#${id}`).evaluate(el => el.scrollIntoView({ block: 'start' }));
    await motion.waitForSelector(`.stage[data-scene="${scene}"]`);
    await motion.waitForTimeout(70);
  }
  await motion.locator('#app-overview').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await motion.waitForSelector('.stage[data-scene="2"]');
  await motion.emulateMedia({ reducedMotion: 'reduce' });
  await motion.waitForSelector('.stage[data-scene="2"][data-settled="true"]');
  await motion.waitForFunction(() => !document.querySelector('.demo-window').getAnimations().some(animation => animation.playState === 'running'), null, { timeout: 250 });
  assert.equal(await motion.locator('#demo-viewer-host canvas').count(), 1);
  await motion.close();
  console.log('Direct links, reduced motion including live changes, resize, model/WASM/WebGL failure and retry, and credits passed');
  }
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}

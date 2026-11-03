import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const { chromium } = await import(process.env.BENCHMARK_PLAYWRIGHT_MODULE || 'playwright');
const screenshots = process.env.SITE_SCREENSHOTS || path.join(os.tmpdir(), 'soma-site-mini');
fs.mkdirSync(screenshots, { recursive: true });
const baseUrl = process.env.SITE_TEST_URL || 'http://127.0.0.1:4188/';
const server = process.env.SITE_TEST_URL ? undefined : await preview({ root: fileURLToPath(new URL('..', import.meta.url)), preview: { host: '127.0.0.1', port: 4188, strictPort: true } });
const viewports = [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844], ['short', 1280, 720], ['16-9', 1920, 1080], ['16-10', 1920, 1200]];
assert.ok(!process.argv[2] || process.argv[2] === 'resilience' || viewports.some(([name]) => name === process.argv[2]));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.BENCHMARK_BROWSER, headless: true, chromiumSandbox: true, args: ['--enable-unsafe-swiftshader'] });
  for (const [name, width, height] of viewports.filter(([name]) => !process.argv[2] || name === process.argv[2])) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: name === '16-9' ? 2 : 1, colorScheme: ['tablet', '16-9', '16-10'].includes(name) ? 'dark' : 'light' });
    await page.addInitScript(() => {
      window.demoCanvasResizes = 0;
      window.demoBackdropDraws = 0;
      window.demoChromeEvents = [];
      window.demoCameraFrames = [];
      window.demoFrame = 0;
      window.demoProgressFrames = 0;
      window.demoFrameMismatches = [];
      let frameTime = -1, lastDraw = {};
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => raf(time => {
        if (time !== frameTime) { frameTime = time; window.demoFrame++; }
        callback(time);
      });
      const clear = WebGL2RenderingContext.prototype.clear;
      WebGL2RenderingContext.prototype.clear = function(...args) {
        lastDraw = { frame: window.demoFrame, progress: document.querySelector('.stage')?.dataset.progress };
        return clear.apply(this, args);
      };
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
          window.demoCameraEye = [x, y, z];
          const stage = document.querySelector('.stage');
          const progress = Number(stage?.dataset.progress);
          if (progress > 0 && progress < 1) window.demoCameraFrames.push({ time: performance.now(), scene: stage.dataset.scene, progress, eye: [x, y, z] });
        }
        return vector.call(this, location, x, y, z);
      };
      const matrix = WebGL2RenderingContext.prototype.uniformMatrix4fv;
      WebGL2RenderingContext.prototype.uniformMatrix4fv = function(location, transpose, values, ...rest) {
        if (names.get(location) === 'view_projection') {
          const forward = [values[3], values[7], values[11]];
          const length = Math.hypot(...forward) ** 2;
          const rowLength = index => {
            const row = [values[index], values[index + 4], values[index + 8]];
            const shift = row.reduce((sum, value, i) => sum + value * forward[i], 0) / length;
            return Math.hypot(...row.map((value, i) => value - shift * forward[i]));
          };
          window.demoProjectionAspect = rowLength(1) / rowLength(0);
        }
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
          if (record.attributeName === 'data-progress' && stage.matches('.stage[data-ready]') && Number(stage.dataset.progress) > 0 && Number(stage.dataset.progress) < 1) {
            window.demoProgressFrames++;
            if (lastDraw.frame !== window.demoFrame || lastDraw.progress !== stage.dataset.progress) window.demoFrameMismatches.push({ frame: window.demoFrame, progress: stage.dataset.progress, draw: lastDraw });
          }
          if (record.attributeName === 'data-chrome' && stage.matches('.stage') && stage.dataset.chrome === 'visible') {
            window.demoChromeEvents.push({ scene: stage.dataset.scene, settled: stage.dataset.settled, moving: document.querySelector('.demo-window').getAnimations().some(animation => animation.playState === 'running') });
          }
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-chrome', 'data-progress'] });
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
      await page.waitForFunction(visible => getComputedStyle(document.querySelector('.demo-shell')).opacity === (visible ? '1' : '0'), scene === 1 || scene === 2);
      if (['0:1', '1:0', '1:2', '2:1', '2:3', '3:2'].includes(`${previous}:${scene}`)) {
        assert.ok(await page.evaluate(() => window.demoCanvasResizes) - resizes <= 2, 'A chapter transition must resize the WebGL buffer at most once');
        const frames = await page.evaluate(scene => window.demoCameraFrames.filter(frame => frame.scene === String(scene)), scene);
        assert.ok(frames.length > 1 && frames.some(frame => frame.progress > 0.05 && frame.progress < 0.95), 'The camera must follow intermediate scroll progress');
      }
    };
    await page.goto(baseUrl);
    assert.equal(await page.locator('a[href^="#"]').count(), 0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#journey').evaluate(el => el === document.activeElement), true);
    assert.equal(new URL(page.url()).hash, '');
    await page.waitForSelector('.stage[data-ready][data-settled="true"]');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.stage>canvas')).opacity === '1');
    assert.equal(await page.locator('.product-section').count(), 4);
    assert.equal(await page.locator('.intro-note,.release-note,a[href$="credits.html"]').count(), 0);
    const corners = await page.locator('.has-footer .site-scroll').evaluate(viewport => {
      const frame = viewport.closest('.module-content');
      const box = frame.getBoundingClientRect();
      const parent = getComputedStyle(frame), child = getComputedStyle(viewport);
      return { matched: child.borderBottomLeftRadius === parent.borderBottomLeftRadius && child.borderBottomRightRadius === parent.borderBottomRightRadius, radius: parseFloat(child.borderBottomLeftRadius), background: child.backgroundImage, outerBackground: getComputedStyle(viewport.parentElement).backgroundImage, footerShadow: getComputedStyle(document.querySelector('.site-footer')).boxShadow, insets: [box.left, innerWidth - box.right, innerHeight - box.bottom] };
    });
    assert.ok(corners.matched && corners.radius === 24 && corners.background !== 'none' && corners.outerBackground === 'none' && corners.footerShadow === 'none', 'Round the content viewport above the footer and keep its outside corners clear');
    assert.ok(corners.insets.every(inset => Math.abs(inset - 6) < 1), 'The workspace frame must keep its 6px outer spacing');
    assert.equal(await page.locator('#start .download-option:disabled').count(), 2);
    assert.equal(await page.locator('#start .download-option [aria-hidden="true"] svg').count(), 2);
    const frame = page.locator('.demo-window');
    const heroFrame = await frame.boundingBox();
    let initialFrame;
    const checkResolution = async () => {
      const raster = await page.locator('.stage>canvas').evaluate(canvas => {
        const display = canvas.getBoundingClientRect();
        const viewport = canvas.closest('.stage').getBoundingClientRect();
        const gl = canvas.getContext('webgl2');
        const limit = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
        const density = Math.min(devicePixelRatio, 2, limit / viewport.width, limit / viewport.height);
        const host = document.querySelector('#demo-viewer-host').getBoundingClientRect();
        const [top, right = top, bottom = top, left = right] = getComputedStyle(canvas).clipPath.split('round')[0].match(/-?[\d.]+px/g)?.map(parseFloat) || [];
        const clip = [top, right, bottom, left];
        const expected = [host.top - viewport.top, viewport.right - host.right, viewport.bottom - host.bottom, host.left - viewport.left];
        return { sharp: canvas.width >= Math.round(display.width * density) - 1 && canvas.height >= Math.round(display.height * density) - 1,
          clipped: expected.every((value, i) => Math.abs(value - clip[i]) < 0.1),
          fixed: Math.abs(display.x - viewport.x) < 1 && Math.abs(display.y - viewport.y) < 1 && Math.abs(display.width - viewport.width) < 1 && Math.abs(display.height - viewport.height) < 1 };
      });
      assert.ok(raster.sharp, 'Visible anatomy must render at screen pixel density even when the app is enlarged');
      assert.ok(raster.clipped, 'The fixed canvas must clip anatomy to the rounded app workspace');
      assert.ok(raster.fixed, 'Canvas position and CSS dimensions must stay fixed throughout scroll');
    };
    const checkFrame = async (layout = 'split') => {
      await checkResolution();
      const bounds = await frame.boundingBox();
      if (layout === 'hero' || layout === 'closing') {
        const viewport = await page.locator('.site-scroll').boundingBox();
        assert.ok(bounds.width > viewport.width && bounds.height > viewport.height && bounds.y < viewport.y, 'The opening window must be enlarged beyond the viewport');
        for (const key of layout === 'hero' ? ['x', 'y', 'width', 'height'] : ['y', 'width', 'height']) assert.ok(Math.abs(bounds[key] - heroFrame[key]) < 2, `Enlarged ${key} must match its fixed layout`);
        if (layout === 'closing') assert.ok(Math.abs(bounds.x + bounds.width / 2 + heroFrame.x + heroFrame.width / 2 - 2 * viewport.x - viewport.width) < 2, 'The closing model must sit opposite the opening model');
      }
      assert.ok(Math.abs(bounds.width / bounds.height - 1.5) < 0.01, 'App window must keep its 3:2 aspect ratio');
      if (['split', 'right'].includes(layout) && initialFrame) for (const key of ['y', 'width', 'height']) assert.ok(Math.abs(bounds[key] - initialFrame[key]) < 2, 'Split app window must keep its size and height');
      const canvas = page.locator('.stage>canvas');
      assert.equal(await canvas.count(), 1);
      assert.equal(await canvas.getAttribute('tabindex'), '-1');
      assert.equal(await canvas.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      const model = await canvas.boundingBox();
      const projectionAspect = await page.evaluate(() => window.demoProjectionAspect);
      assert.ok(Math.abs(projectionAspect - model.width / model.height) < 0.005, `The camera projection must match the displayed canvas aspect ratio without stretching anatomy: ${projectionAspect} vs ${model.width / model.height}`);
      assert.equal(await canvas.evaluate(el => el.parentElement.matches('.stage')), true, 'The WebGL canvas must stay outside the scaled app window');
      assert.equal(await frame.evaluate(el => getComputedStyle(el).overflow), 'hidden');
      assert.equal(await frame.locator('button:not([hidden]),input,a').count(), 0);
      assert.equal(await frame.locator('nav,.demo-active,.demo-language,.demo-axis,.demo-model-status,.demo-search-preview,.demo-info').count(), 0);
      assert.equal(await frame.locator('.demo-shell').evaluate(el => getComputedStyle(el).opacity), ['hero', 'closing'].includes(layout) ? '0' : '1');
      assert.equal(await frame.evaluate(el => getComputedStyle(el, '::before').opacity), ['hero', 'closing'].includes(layout) ? '0' : '1');
      if (width > 700 && ['split', 'right'].includes(layout)) {
        const viewport = await page.locator('.site-scroll').boundingBox();
        const copy = await page.locator(layout === 'right' ? '#learn .product-inner' : '#app-overview .product-inner').boundingBox();
        const [left, right] = layout === 'right' ? [copy, bounds] : [bounds, copy];
        const leftMargin = left.x - viewport.x;
        const rightMargin = viewport.x + viewport.width - right.x - right.width;
        assert.ok(Math.abs(leftMargin - rightMargin) < 2, 'Text and demo must be centered as a group');
        assert.ok(right.x > left.x + left.width, 'Text and demo must have a visible gap');
      }
    };
    await checkFrame('hero');
    if (['16-9', '16-10'].includes(name)) {
      assert.ok(await page.locator('#hero-title').evaluate(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) * 2 + 1), 'The wide-screen hero title must stay on two lines');
    }
    assert.equal(await page.evaluate(() => window.demoBackdropDraws), 0, 'The opening chapter must not draw the app grid');
    const cameraBefore = await page.evaluate(() => [window.demoCameraEye, window.demoProjectionAspect]);
    const viewport = await page.locator('.site-scroll').boundingBox();
    const drag = { x: viewport.x + viewport.width * 0.75, y: viewport.y + viewport.height * (width > 700 ? 0.4 : 0.2) };
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.x + 30, drag.y + 15, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => [window.demoCameraEye, window.demoProjectionAspect]), cameraBefore, 'Dragging the preview must not rotate the model');
    const openingSamples = new Map();
    const openingResizes = await page.evaluate(() => window.demoCanvasResizes);
    for (const progress of [0, 0.25, 0.5, 0.75, 0.9, 0.99, 0.9, 0.75, 0.5, 0.25, 0]) {
      await page.locator('.site-scroll').evaluate((el, progress) => el.scrollTo({ top: document.querySelector('#learn').offsetTop * progress, behavior: 'instant' }), progress);
      await page.waitForFunction(progress => Math.abs(Number(document.querySelector('.stage').dataset.progress) - progress) < 0.002, progress);
      await page.waitForTimeout(40);
      await checkResolution();
      const bounds = await frame.boundingBox();
      assert.ok(Math.abs(bounds.width / bounds.height - 1.5) < 0.01, 'Every intermediate opening frame must remain 3:2');
      const previous = openingSamples.get(progress);
      if (previous) for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(bounds[key] - previous[key]) < 2, 'Reversing scroll must restore the same intermediate frame');
      else openingSamples.set(progress, bounds);
      const chrome = Number(await page.locator('.demo-shell').evaluate(el => getComputedStyle(el).opacity));
      assert.ok(progress < 0.82 ? chrome === 0 : chrome > 0 && chrome < 1, 'The frame must fade in only near the end of the opening transition');
      if (progress >= 0.5) assert.equal(await page.locator('#start').evaluate(el => el.inert && getComputedStyle(el).opacity === '0'), true, 'Outgoing intro text must not overlap the model');
    }
    assert.equal(await page.evaluate(() => window.demoCanvasResizes), openingResizes, 'Uniform zoom must not resize the drawing buffer during scroll');
    assert.ok(openingSamples.get(0).width > openingSamples.get(0.5).width && openingSamples.get(0.5).width > openingSamples.get(0.99).width, 'The opening window must shrink continuously');
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
    await visit('download', 3);
    await checkFrame('closing');
    const completedClosing = await frame.boundingBox();
    await page.locator('.site-scroll').evaluate(el => el.scrollTo({ top: document.querySelector('#download').offsetTop - el.clientHeight * 0.25, behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.stage').getAttribute('data-progress'), '1', 'The closing scene must finish before reaching the final section anchor');
    const earlyClosing = await frame.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(earlyClosing[key] - completedClosing[key]) < 1, 'The final model must already be at its reading position');
    assert.equal(await page.locator('#download .product-inner').evaluate(panel => getComputedStyle(panel).visibility === 'visible' && Math.abs(panel.getBoundingClientRect().left - document.querySelector('.site-scroll').getBoundingClientRect().left - panel.offsetLeft) < 1), true, 'The final text must arrive with the model and remain visible');
    assert.equal(await page.locator('#sources-title').textContent(), 'Nguồn dữ liệu và giới hạn');
    assert.equal(await page.locator('#essentials,.product-facts').count(), 0);
    assert.equal(await page.getByText('Soma đang được hoàn thiện.', { exact: true }).count(), 0);
    const closingEye = await page.evaluate(() => window.demoCameraEye);
    assert.ok(closingEye[0] * cameraBefore[0][0] < 0, 'The closing camera must face the model from the opposite side');
    await visit('learn', 1);
    for (const [id, scene] of [['start', 0], ['learn', 1], ['app-overview', 2], ['download', 3], ['app-overview', 2], ['learn', 1], ['start', 0]]) {
      await visit(id, scene);
      const layout = scene === 0 ? 'hero' : scene === 1 ? 'right' : scene === 2 ? 'split' : 'closing';
      assert.equal(await page.locator('.stage').getAttribute('data-layout'), scene === 0 ? 'right' : scene === 1 ? 'split' : scene === 2 ? 'closing' : layout);
      await checkFrame(layout);
      assert.equal(await page.locator('#' + id).evaluate(el => Math.abs(el.clientHeight - document.querySelector('.site-scroll').clientHeight) < 2), true);
      const textBounds = await page.locator('#' + id + ' .product-inner').boundingBox();
      if (['split', 'right'].includes(layout)) {
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
    for (const id of ['learn', 'app-overview']) {
      let resting;
      for (const progress of [0, 0.5, 0.9, 0.5, 0]) {
        const sample = await page.evaluate(async ({ id, progress }) => {
          const viewport = document.querySelector('.site-scroll');
          const section = document.getElementById(id);
          const hold = section.nextElementSibling.offsetTop - section.offsetTop - viewport.clientHeight;
          viewport.scrollTo({ top: section.offsetTop + hold * progress, behavior: 'instant' });
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const bounds = element => {
            const rect = element.getBoundingClientRect();
            return [rect.x, rect.y, rect.width, rect.height];
          };
          return { hold, viewport: viewport.clientHeight, copy: bounds(section.querySelector('.product-inner')), app: bounds(document.querySelector('.demo-window')), progress: Number(document.querySelector('.stage').dataset.progress) };
        }, { id, progress });
        assert.ok(sample.hold >= sample.viewport * 0.24, 'Chapters two and three must reserve extra reading scroll distance');
        assert.equal(sample.progress, 0, 'The demo must wait during the reading hold');
        if (resting) for (const target of ['copy', 'app']) for (let i = 0; i < 4; i++) assert.ok(Math.abs(sample[target][i] - resting[target][i]) < 1, 'Text and demo must stay still while scrolling through the reading hold');
        else resting = sample;
      }
    }
    const copySamples = new Map();
    for (const index of [0, 1, 2, 2, 1, 0]) {
      for (const progress of [0, 0.025, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.75, 0.8, 0.85, 0.9, 0.925, 0.94, 0.95, 0.975, 1]) {
        const sample = await page.evaluate(async ({ index, progress }) => {
          const viewport = document.querySelector('.site-scroll');
          const sections = [...document.querySelectorAll('.product-section')];
          viewport.scrollTo({ top: sections[index].offsetTop + (sections[index + 1].offsetTop - sections[index].offsetTop) * progress, behavior: 'instant' });
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const app = document.querySelector('.demo-window').getBoundingClientRect();
          const stage = document.querySelector('.stage');
          const appVisible = getComputedStyle(stage).visibility !== 'hidden' && Number(getComputedStyle(stage).opacity) > 0.01 && Number(getComputedStyle(document.querySelector('.demo-shell')).opacity) > 0.05;
          const copies = sections.slice(1).map(section => {
            const panel = section.querySelector('.product-inner');
            const rect = panel.getBoundingClientRect();
            const visible = getComputedStyle(panel).visibility !== 'hidden' && rect.right > 0 && rect.left < viewport.getBoundingClientRect().right && rect.bottom > viewport.getBoundingClientRect().top && rect.top < viewport.getBoundingClientRect().bottom;
            return { id: section.id, x: rect.x, y: rect.y, restX: viewport.getBoundingClientRect().left + panel.offsetLeft, visible, pinned: Math.abs(rect.top - viewport.getBoundingClientRect().top - parseFloat(getComputedStyle(section).paddingTop)) < 1, overlap: appVisible && rect.left < app.right - 1 && rect.right > app.left + 1 && rect.top < app.bottom - 1 && rect.bottom > app.top + 1 };
          });
          return copies;
        }, { index, progress });
        for (const copy of sample.filter(copy => copy.visible)) {
          assert.ok(copy.pinned, 'Text must stay at its reading height while sliding horizontally: ' + JSON.stringify({ index, progress, copy }));
          assert.ok(!copy.overlap, 'Sliding text must stay outside the demo window: ' + JSON.stringify({ index, progress, copy }));
        }
        for (const copy of sample) assert.ok(copy.id === 'learn' ? copy.x <= copy.restX + 1 : copy.x >= copy.restX - 1, 'Text must enter and leave through its outer edge');
        if (progress === 0.975) assert.ok(sample[index].visible && (index === 2 ? Math.abs(sample[index].x - sample[index].restX) < 1 : Math.abs(sample[index].x - sample[index].restX) > 1), 'Incoming text must slide inward; the faster closing text must already be settled');
        if (progress === 0.3 && index > 0) assert.ok(Math.abs(sample[index - 1].x - sample[index - 1].restX) > 1 && sample[index - 1].visible, 'Outgoing text must slide back toward the same edge');
        if (index === 1 && progress === 0.3 || index === 0 && progress === 0.975) await page.screenshot({ path: path.join(screenshots, name + '-copy-' + index + '-' + progress + '.png') });
        const key = index + ':' + progress;
        const previous = copySamples.get(key);
        if (previous) for (let i = 0; i < sample.length; i++) for (const axis of ['x', 'y']) assert.ok(Math.abs(sample[i][axis] - previous[i][axis]) < 1, 'Reverse scroll must restore the same text positions');
        else copySamples.set(key, sample);
      }
    }
    await page.locator('#language').click();
    await visit('download', 3);
    assert.equal(await page.locator('#sources-title').textContent(), 'Sources and limitations');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await visit('learn', 1);
    await page.screenshot({ path: path.join(screenshots, name + '-english.png') });
    await visit('app-overview', 2);
    assert.equal(await page.locator('.stage>canvas').getAttribute('aria-label'), 'Explore 3D anatomy');
    assert.equal(await page.locator('#download .download-option:disabled').count(), 2);
    assert.equal(await page.locator('#download .download-option [aria-hidden="true"] svg').count(), 2);
    assert.equal(models.length, 1);
    assert.ok(models[0].endsWith('/models/z-anatomy/skeletal-system.glb.br'));
    assert.equal(await page.locator('.site-scroll').evaluate(el => el.scrollWidth > el.clientWidth), false);
    await visit('learn', 1);
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => window.demoProgressFrames) > 20, 'Frame synchronization must be checked during moving scroll transitions');
    assert.deepEqual(await page.evaluate(() => window.demoFrameMismatches), [], 'Window transforms, canvas crop and model draws must update in the same animation frame');
    console.log(`${name}: scroll scenes, fixed 3:2 app window, clipped noninteractive viewer, language and navigation passed`);
    await page.close();
  }
  if (!process.argv[2] || process.argv[2] === 'resilience') {
  const failed = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  failed.setDefaultTimeout(10000);
  await failed.route('**/models/z-anatomy/skeletal-system.glb.br', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await failed.goto(baseUrl);
  await failed.waitForSelector('#retry:not([hidden])');
  const openingRetry = await failed.locator('#retry').boundingBox();
  assert.ok(openingRetry && openingRetry.y >= 0 && openingRetry.y + openingRetry.height < 844 * 0.42, 'Retry must remain accessible outside the enlarged app window');
  assert.equal(await failed.locator('.product-section').count(), 4);
  await failed.unroute('**/models/z-anatomy/skeletal-system.glb.br');
  await failed.locator('#retry').click();
  await failed.waitForSelector('.stage[data-ready][data-scene="0"][data-settled="true"]');
  await failed.setViewportSize({ width: 410, height: 844 });
  await failed.waitForTimeout(100);
  assert.equal(await failed.locator('.stage').getAttribute('data-opening'), '', 'Resizing the reduced-motion hero must preserve the crop above the intro text');
  await failed.locator('#app-overview').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await failed.waitForSelector('.stage[data-ready][data-scene="2"][data-settled="true"]');
  await failed.locator('#learn').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await failed.waitForSelector('.stage[data-scene="1"][data-settled="true"]');
  await failed.setViewportSize({ width: 620, height: 760 });
  await failed.waitForFunction(() => {
    const canvas = document.querySelector('.stage>canvas');
    const viewport = document.querySelector('.stage').getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio, 2, 4096 / viewport.width, 4096 / viewport.height);
    return canvas.width === Math.round(viewport.width * ratio) && canvas.height === Math.round(viewport.height * ratio);
  });
  await failed.evaluate(() => document.querySelector('.stage>canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await failed.waitForSelector('#retry:not([hidden])');
  const retryPosition = await failed.locator('.site-scroll').evaluate(el => el.scrollTop);
  const retryBounds = await failed.locator('#retry').boundingBox();
  assert.ok(retryBounds && retryBounds.y >= 0 && retryBounds.y + retryBounds.height <= 760);
  await failed.mouse.click(retryBounds.x + retryBounds.width / 2, retryBounds.y + retryBounds.height / 2);
  await failed.waitForSelector('.stage[data-ready][data-scene="1"][data-settled="true"]');
  assert.ok(Math.abs(await failed.locator('.site-scroll').evaluate(el => el.scrollTop) - retryPosition) < 2);
  await failed.locator('.site-footer a').click();
  assert.equal(new URL(failed.url()).pathname, '/credits');
  await failed.reload();
  assert.equal(await failed.locator('.credits-page h1').count(), 1);
  assert.equal(await failed.locator('.site-footer').count(), 1);
  const creditsFooter = await failed.locator('.site-footer').boundingBox();
  await failed.locator('.site-scroll').evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
  assert.deepEqual(await failed.locator('.site-footer').boundingBox(), creditsFooter, 'The credits footer must stay visible while its content scrolls');
  assert.ok(creditsFooter.y + creditsFooter.height <= 760 - 5);

  await failed.keyboard.press('Tab');
  await failed.keyboard.press('Enter');
  assert.equal(await failed.locator('#journey').evaluate(el => el === document.activeElement), true);
  assert.equal(new URL(failed.url()).hash, '');
  await failed.close();
  const wasmFailure = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  wasmFailure.setDefaultTimeout(10000);
  await wasmFailure.route('**/*content_bg*.wasm', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await wasmFailure.goto(baseUrl);
  await wasmFailure.waitForSelector('#retry:not([hidden])');
  await wasmFailure.locator('#learn').evaluate(el => el.scrollIntoView({ block: 'start' }));
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
    return frame.width > viewport.width && frame.height > viewport.height && Math.abs(frame.width / frame.height - 1.5) < 0.01;
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
  await motion.waitForFunction(() => !document.querySelector('.site-scroll').hasAttribute('data-copy-motion'));
  assert.equal(await motion.locator('.product-section:not(.intro-section)').evaluateAll(sections => sections.every(section => !section.inert && section.querySelector('.product-inner').style.transform === '' && section.querySelector('.product-inner').style.visibility === '')), true, 'Reduced motion must restore normal text scrolling');
  assert.equal(await motion.locator('.stage>canvas').count(), 1);
  await motion.close();
  console.log('Keyboard skip, reduced motion including live changes, resize, model/WASM/WebGL failure and retry, and credits passed');
  }
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}

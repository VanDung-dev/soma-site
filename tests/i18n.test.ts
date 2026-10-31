import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { getInitialLanguage, translateMessage } from '../src/i18n.ts';
import type { MessageKey } from '../src/i18n.ts';
import site from '../content/site-translations.json' with { type: 'json' };

test('application translation JSON is copied unchanged', () => {
  const data = fs.readFileSync(new URL('../content/ui-translations.json', import.meta.url));
  assert.equal(createHash('sha256').update(data).digest('hex'), '4a1a8198a683691af5d4599995dd91f125527d212cf3eb7c4752554d0a3f61b4');
});

test('every website message has complete Vietnamese and English text', () => {
  for (const [key, messages] of Object.entries(site.messages)) {
    for (const language of ['vi', 'en'] as const) {
      assert.ok(messages[language].trim(), `${key}.${language}`);
      assert.equal(translateMessage(key as MessageKey, language), messages[language]);
    }
  }
});

test('shared preference labels and English landing content use the selected language', () => {
  assert.equal(translateMessage('language.selector.label', 'vi'), 'Ngôn ngữ');
  assert.equal(translateMessage('language.selector.label', 'en'), 'Language');
  assert.equal(translateMessage('appearance.mode.auto', 'en'), 'Auto');
  assert.equal(translateMessage('site.hero.explore', 'en'), 'Explore the features');
  assert.notEqual(translateMessage('site.loadError', 'en'), translateMessage('site.loadError', 'vi'));
  assert.equal(translateMessage('credits.models.heading', 'en'), 'Anatomy models');
});

test('initial language defaults safely when storage is unavailable', () => {
  assert.equal(getInitialLanguage(), 'vi');
});

test('keeps the application interpolation and plural formatting contract', () => {
  assert.equal(translateMessage('catalog.systemCount', 'en', { count: 1 }), '1 system');
  assert.equal(translateMessage('catalog.systemCount', 'en', { count: 2 }), '2 systems');
  assert.equal(translateMessage('catalog.systemCount', 'vi', { count: 1 }), '1 hệ');
  assert.equal(translateMessage('panels.show', 'en', { name: 'Catalog' }), 'Show Catalog sidebar');
});

test('HTML metadata uses available translations', () => {
  for (const file of ['index.html', 'credits.html']) {
    const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    for (const match of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
      assert.ok(translateMessage(match[1] as MessageKey, 'vi').trim(), match[1]);
      assert.ok(translateMessage(match[1] as MessageKey, 'en').trim(), match[1]);
    }
  }
});

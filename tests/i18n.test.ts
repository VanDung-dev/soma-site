import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getInitialLanguage, translateMessage } from '../src/i18n/index.ts';
import type { MessageKey } from '../src/i18n/index.ts';
import site from '../src/i18n/messages.json' with { type: 'json' };

test('every website message has complete Vietnamese and English text', () => {
  for (const [key, messages] of Object.entries(site.messages)) {
    for (const language of ['vi', 'en'] as const) {
      assert.ok(messages[language].trim(), `${key}.${language}`);
      assert.doesNotMatch(messages[language], /\{\w/, `${key}.${language}`);
      assert.equal(translateMessage(key as MessageKey, language), messages[language]);
    }
  }
});

test('shared preference labels and English landing content use the selected language', () => {
  assert.equal(translateMessage('language.selector.label', 'vi'), 'Ngôn ngữ');
  assert.equal(translateMessage('language.selector.label', 'en'), 'Language');
  assert.equal(translateMessage('appearance.mode.auto', 'en'), 'Auto');
  assert.equal(translateMessage('site.hero.title1', 'en'), 'Study anatomy.');
  assert.notEqual(translateMessage('site.loadError', 'en'), translateMessage('site.loadError', 'vi'));
});

test('initial language defaults safely when storage is unavailable', () => {
  assert.equal(getInitialLanguage(), 'vi');
});

test('HTML metadata uses available translations', () => {
  for (const file of ['index.html']) {
    const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    for (const match of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
      assert.ok(translateMessage(match[1] as MessageKey, 'vi').trim(), match[1]);
      assert.ok(translateMessage(match[1] as MessageKey, 'en').trim(), match[1]);
    }
  }
});

import site from './messages.json' with { type: 'json' };

export type Language = 'vi' | 'en';
export type MessageKey = keyof typeof site.messages;

export function translateMessage(key: MessageKey, language: Language): string {
  return site.messages[key][language];
}

export function hasMessage(key: string): key is MessageKey {
  return key in site.messages;
}

import { defineI18n } from 'fumadocs-core/i18n';

export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'tr'],
  // English stays at the root (`/memory`) and other languages get a prefix (`/tr/memory`). A page that isn't
  // translated yet shows the English one.
  hideLocale: 'default-locale',
});

export type Language = (typeof i18n.languages)[number];

export function homeUrl(lang: string): string {
  return lang === i18n.defaultLanguage ? '/' : `/${lang}`;
}

import { createGetUrl } from 'fumadocs-core/source';
import { i18n } from './i18n';

export const appName = 'Jinion';
// The site is served at docs.jinion.co, so the docs sit at the root rather than under /docs.
export const docsRoute = '/';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'itsemirhanengin',
  repo: 'jinion',
  branch: 'main',
};

// Like page URLs, these carry no prefix for English and `/tr` for Turkish, so their routes live under `app/[lang]`.
const getContentUrl = createGetUrl(docsContentRoute, i18n);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute, i18n);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}

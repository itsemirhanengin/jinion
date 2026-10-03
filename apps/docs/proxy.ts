import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';
import { createI18nMiddleware } from 'fumadocs-core/i18n/middleware';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { i18n } from '@/lib/i18n';
import { docsContentRoute } from '@/lib/shared';

// Serves `/memory` from `app/[lang]` as English and redirects `/en/memory` to `/memory`; `/tr/memory` passes through.
const languages = createI18nMiddleware(i18n);

const { rewrite: rewriteDocs } = rewritePath('{/*path}', `${docsContentRoute}{/*path}/content.md`);
const { rewrite: rewriteSuffix } = rewritePath('{/*path}.md', `${docsContentRoute}{/*path}/content.md`);

// The docs sit at the root, so every path is a page except these, which come after the language prefix.
const notPages = /^\/(llms\.mdx|og)\/|^\/(llms\.txt|llms-full\.txt)$/;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const { lang, path } = splitLanguage(request.nextUrl.pathname);

  // A page's Markdown, for `/memory.md` or a request that prefers `text/markdown`. A rewrite from here skips the
  // proxy, so it goes straight to the route under `app/[lang]`.
  if (!notPages.test(path)) {
    // The root page has no name of its own, so its Markdown is at `/index.md`.
    const suffixed = path === '/index.md' ? `${docsContentRoute}/content.md` : rewriteSuffix(path);
    if (suffixed) {
      return NextResponse.rewrite(new URL(`/${lang}${suffixed}`, request.nextUrl));
    }

    const negotiated = isMarkdownPreferred(request) && rewriteDocs(path);
    if (negotiated) {
      return NextResponse.rewrite(new URL(`/${lang}${negotiated}`, request.nextUrl), {
        // this URL has two representations, selected by `Accept`
        headers: { Vary: 'Accept' },
      });
    }
  }

  return languages(request, event);
}

function splitLanguage(pathname: string): { lang: string; path: string } {
  const [, first = '', ...rest] = pathname.split('/');
  if ((i18n.languages as readonly string[]).includes(first)) {
    return { lang: first, path: `/${rest.join('/')}` };
  }
  return { lang: i18n.defaultLanguage, path: pathname };
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon\\.ico$|icon\\.svg$).*)'],
};

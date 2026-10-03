import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { generateOGImage } from 'fumadocs-ui/og';
import { appName, getPageImageUrl } from '@/lib/shared';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/[lang]/og/docs/[...slug]'>) {
  const { lang, slug } = await params;
  const page = source.getPage(slug.slice(0, -1), lang);

  if (!page) notFound();

  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: appName,
    // The site's icon, app/icon.svg, in the TUI's accent.
    icon: (
      <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M8 10.5 13.5 16 8 21.5"
          fill="none"
          stroke="#61afef"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M16.5 22h7.5" stroke="#61afef" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    primaryColor: 'rgba(97, 175, 239, 0.25)',
    primaryTextColor: '#61afef',
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImageUrl(page).segments,
  }));
}

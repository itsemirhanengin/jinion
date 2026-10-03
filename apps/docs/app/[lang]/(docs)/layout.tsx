import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { ExternalLink } from 'lucide-react';
import { Wordmark } from '@/components/layout/wordmark';
import { homeUrl } from '@/lib/i18n';
import { gitConfig } from '@/lib/shared';
import { source } from '@/lib/source';

export default async function Layout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;

  return (
    <DocsLayout
      tree={source.getPageTree(lang)}
      nav={{ title: <Wordmark />, url: homeUrl(lang) }}
      links={[
        {
          text: 'GitHub',
          url: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
          icon: <ExternalLink />,
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}

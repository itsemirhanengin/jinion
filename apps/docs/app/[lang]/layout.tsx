import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18nProvider } from 'fumadocs-ui/i18n';
import type { Metadata } from 'next';
import '../global.css';
import { Geist, Geist_Mono } from 'next/font/google';
import { cn } from '@/lib/cn';
import { i18n } from '@/lib/i18n';
import { appName } from '@/lib/shared';
import { translations } from '@/lib/translations';

// latin-ext has Turkish letters such as ş, ğ and İ.
const sans = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist' });
const mono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  // Open Graph image URLs are relative, and resolve against this.
  metadataBase: new URL('https://docs.jinion.co'),
  title: { template: `%s · ${appName}`, default: appName },
  openGraph: { siteName: appName },
};

export default async function Layout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;

  return (
    <html lang={lang} className={cn(sans.variable, mono.variable)} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider i18n={i18nProvider(translations, lang)}>{children}</RootProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

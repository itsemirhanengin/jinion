import Link from 'next/link';
import { lang } from 'next/root-params';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { homeUrl } from '@/lib/i18n';
import { translations } from '@/lib/translations';

// Fumadocs' default 404 always links to `/`, which is the English home page.
export default async function NotFound() {
  const locale = await lang();
  const t = translations.get(locale) ?? {};

  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4 px-8 py-24 text-center">
      <h1 className="text-6xl font-bold text-fd-muted-foreground">404</h1>
      <h2 className="text-2xl font-semibold">{t['Page Not Found(404 not found page)'] ?? 'Page Not Found'}</h2>
      <p className="max-w-md text-fd-muted-foreground">
        {t[
          'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 not found page)'
        ] ??
          'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.'}
      </p>
      <Link href={homeUrl(locale)} className={buttonVariants({ variant: 'primary', className: 'mt-4' })}>
        {t['Back to Home(404 not found page)'] ?? 'Back to Home'}
      </Link>
    </div>
  );
}

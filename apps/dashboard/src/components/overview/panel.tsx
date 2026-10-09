import Link from 'next/link';
import { card } from '@/components/data-table/buttons';

/** A card on the overview: a title, what it shows in a line, and a link to the page with more. */
export function Panel({
  title,
  description,
  more,
  className = '',
  children,
}: {
  title: string;
  description?: string;
  more?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${card} flex flex-col gap-4 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          {description && <p className="text-neutral-500">{description}</p>}
        </div>
        {more && (
          <Link href={more.href} className="shrink-0 text-neutral-600 hover:text-neutral-950 hover:underline">
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

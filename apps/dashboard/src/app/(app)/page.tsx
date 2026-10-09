import { House } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/page';

export default function OverviewPage() {
  return (
    <>
      <PageHeader>
        <h1 className="flex items-center gap-1.5 text-sm/6 font-medium">
          <House className="size-4 shrink-0 stroke-neutral-600" />
          Overview
        </h1>
      </PageHeader>
      <PageBody className="pb-24">
        <p className="py-12 text-center text-neutral-500">The overview comes once the other screens are in place.</p>
      </PageBody>
    </>
  );
}

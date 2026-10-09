import { GoalsView } from '@/components/goals/goals-view';
import { PageTransition } from '@/components/page-transition';
import { goalCards } from '@/lib/goal-cards';

export default async function GoalsPage() {
  const { cards, daily } = await goalCards();

  return (
    <PageTransition>
      <GoalsView cards={cards} daily={daily} />
    </PageTransition>
  );
}

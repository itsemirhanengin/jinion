import { FeedbackView } from '@/components/feedback/feedback-view';
import { PageTransition } from '@/components/page-transition';
import { listFeedback, listUsers } from '@/lib/data';

export default async function FeedbackPage() {
  const [items, users] = await Promise.all([listFeedback(), listUsers()]);

  return (
    <PageTransition>
      <FeedbackView items={items} people={users.map((user) => [user.id, user.name])} />
    </PageTransition>
  );
}

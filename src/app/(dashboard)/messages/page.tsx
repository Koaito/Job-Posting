import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getConversations, getPendingRequests } from '@/app/actions/messages';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { MessagesInbox } from '@/components/features/MessagesInbox';

/**
 * Messages Inbox Page
 * Corresponds to Flask: blueprints/messages.py::inbox() (templates/messages.html)
 * Route: /messages
 *
 * Trước đây là placeholder "TODO: Implement in Phase 6" — dựng đủ theo
 * layout Flask gốc: mục "Yêu cầu đang chờ" CHỈ hiện với staff (ss_team/
 * admin), danh sách hội thoại chung cho mọi role.
 */
export default async function MessagesPage() {
  const t = await getTranslations('messagesPage');
  const currentUser = await getCurrentUser();
  const isStaff = isStaffRole(currentUser?.role);

  const [conversations, pendingRequests] = await Promise.all([
    getConversations(),
    isStaff ? getPendingRequests() : Promise.resolve([]),
  ]);

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo — main.content
    // (root layout.tsx) đã lo container rồi.
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">
            {isStaff ? t('ledeStaff') : t('ledeStudent')}
          </p>
        </div>
        <Link className="btn btn-primary" href="/messages/new">
          {t('newMessage')}
        </Link>
      </header>

      <MessagesInbox
        initialConversations={conversations}
        initialPendingRequests={pendingRequests}
        isStaff={isStaff}
      />
    </>
  );
}

import Link from 'next/link';
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
          <span className="eyebrow">Career Hub / Nhắn tin</span>
          <h1>Tin nhắn</h1>
          <p className="lede">
            {isStaff
              ? 'Hội thoại với học viên và team SS khác. Yêu cầu nhắn tin mới từ học viên sẽ hiện ở mục riêng bên dưới.'
              : 'Hội thoại với team SS. Gửi yêu cầu nhắn tin mới nếu chưa từng liên hệ với ai đó.'}
          </p>
        </div>
        <Link className="btn btn-primary" href="/messages/new">
          ✎ Nhắn tin mới
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

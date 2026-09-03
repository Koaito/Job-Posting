import { notFound } from 'next/navigation';
import {
  getMessageHistory,
  getConversations,
  markMessagesRead,
} from '@/app/actions/messages';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { MessageThread } from '@/components/features/MessageThread';

/**
 * Khung chat 1 hội thoại cụ thể
 * Corresponds to Flask: blueprints/messages.py::thread() (templates/messages_thread.html)
 * Route: /messages/[partnerId]
 *
 * SSR sẵn lịch sử (đọc được ngay, không cần chờ JS) — MessageThread.tsx
 * (client) chỉ lo phần tin ĐẾN SAU lúc trang đã tải xong (polling) +
 * gửi tin + chặn/bỏ chặn + huỷ yêu cầu, giống chia việc SSR/JS bên
 * Flask gốc (public/app.js chỉ lo phần polling).
 */
interface SearchParams {
  name?: string;
  role?: string;
}

export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { partnerId } = await params;
  const { name = '', role = '' } = await searchParams;

  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  // Khớp `if partner_id == current_user.id: abort(400)` bên Flask —
  // không tự nhắn với chính mình.
  if (partnerId === currentUser.ss_user_id) notFound();

  const isStaff = isStaffRole(currentUser.role);
  const isStudent = currentUser.role === 'user';

  const [history, conversations] = await Promise.all([
    getMessageHistory(partnerId, 50),
    // Staff LUÔN dò lại (kể cả khi đã có name/role từ query string) để
    // lấy relationship_status/relationship_id mới nhất — cần 2 giá trị
    // này để hiện đúng nút Chặn/Bỏ chặn. Non-staff chỉ dò khi thiếu
    // name (link cũ mất query string / gõ thẳng URL).
    !name.trim() || isStaff ? getConversations() : Promise.resolve([]),
  ]);

  let partnerName = name.trim();
  let partnerRole = role.trim();
  let relationshipStatus: string | null = null;
  let relationshipId: string | null = null;

  const matchedConv = conversations.find((c) => c.partner_id === partnerId);
  if (matchedConv) {
    partnerName = partnerName || matchedConv.partner_name;
    partnerRole = partnerRole || matchedConv.partner_role;
    relationshipStatus = matchedConv.relationship_status ?? null;
    relationshipId = matchedConv.relationship_id ?? null;
  }
  partnerName = partnerName || 'Người dùng';

  // Không đáng làm hỏng cả trang chỉ vì đánh dấu đã đọc thất bại —
  // markMessagesRead() đã tự nuốt lỗi bên trong action.
  await markMessagesRead(partnerId);

  const lastId = history.length > 0 ? history[history.length - 1].id : 0;

  return (
    <MessageThread
      partnerId={partnerId}
      partnerName={partnerName}
      partnerRole={partnerRole}
      relationshipStatus={relationshipStatus}
      relationshipId={relationshipId}
      initialHistory={history}
      lastId={lastId}
      currentUserId={currentUser.ss_user_id}
      isStaff={isStaff}
      isStudent={isStudent}
      maxContentLength={2000}
    />
  );
}

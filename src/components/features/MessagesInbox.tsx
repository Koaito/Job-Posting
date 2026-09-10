'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  acceptMessageRequest,
  declineMessageRequest,
  blockStudent,
  unblockRelationship,
} from '@/app/actions/messages';
import { roleLabel } from '@/lib/auth/roles';
import type { Conversation, PendingRequest } from '@/types/messages';
import { useToast } from '@/components/ui/toast/ToastProvider';

/**
 * Phần tương tác của trang /messages (inbox) — page.tsx chỉ fetch dữ
 * liệu (server component), component này lo accept/decline/chặn/bỏ
 * chặn (đều cần confirm hoặc optimistic remove khỏi list, giống pattern
 * StaffAccountsManager.tsx/DeleteCompanyButton.tsx).
 *
 * Đối chiếu templates/messages.html gốc: 3 nút form riêng (accept,
 * decline, block/unblock) — gộp lại đây thành 1 component vì cùng
 * chung state danh sách hội thoại/pending cần cập nhật lại sau mỗi
 * thao tác.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch label/tiêu đề/nút bấm qua
 * `useTranslations('messagesInbox')`. roleLabel() (lib/auth/roles.ts)
 * giờ đã dịch theo `t` namespace `roles` (đợt sau, xem ghi chú
 * StaffActivityList.tsx).
 *
 * B.1 Polish (09/2026): cả 4 hành động (accept/decline/block/unblock)
 * đều là bấm-nút-xong-liền, KHÔNG mixed với form submit nào trong file
 * này (khác StaffAccountsManager.tsx/CompanyContactsManager.tsx/
 * MessageThread.tsx — cố ý CHƯA đụng, còn lẫn lỗi validate form) — đổi
 * thẳng flash inline sang `toast.error()`.
 */

interface MessagesInboxProps {
  initialConversations: Conversation[];
  initialPendingRequests: PendingRequest[];
  isStaff: boolean;
}

function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (!withTime) return datePart;
  return `${datePart} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MessagesInbox({
  initialConversations,
  initialPendingRequests,
  isStaff,
}: MessagesInboxProps) {
  const t = useTranslations('messagesInbox');
  const tRole = useTranslations('roles');
  const router = useRouter();
  const toast = useToast();
  const [conversations, setConversations] = useState(initialConversations);
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests);
  const [isPending, startTransition] = useTransition();

  const STATUS_LABELS: Record<string, string> = {
    pending: t('statusPending'),
    declined: t('statusDeclined'),
    blocked: t('statusBlocked'),
  };

  const handleAccept = (relationshipId: string) => {
    startTransition(async () => {
      const result = await acceptMessageRequest(relationshipId);
      if (result.success) {
        setPendingRequests((prev) => prev.filter((r) => r.relationship_id !== relationshipId));
        router.refresh();
      } else {
        toast.error(result.error || t('acceptFailed'));
      }
    });
  };

  const handleDecline = (relationshipId: string) => {
    startTransition(async () => {
      const result = await declineMessageRequest(relationshipId);
      if (result.success) {
        setPendingRequests((prev) => prev.filter((r) => r.relationship_id !== relationshipId));
        router.refresh();
      } else {
        toast.error(result.error || t('declineFailed'));
      }
    });
  };

  const handleBlock = (studentId: string, partnerName: string) => {
    if (!confirm(t('confirmBlock', { name: partnerName }))) return;
    startTransition(async () => {
      const result = await blockStudent(studentId);
      if (result.success) {
        setConversations((prev) =>
          prev.map((c) => (c.partner_id === studentId ? { ...c, relationship_status: 'blocked' } : c))
        );
        router.refresh();
      } else {
        toast.error(result.error || t('blockFailed'));
      }
    });
  };

  const handleUnblock = (relationshipId: string) => {
    startTransition(async () => {
      const result = await unblockRelationship(relationshipId);
      if (result.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.relationship_id === relationshipId ? { ...c, relationship_status: 'accepted' } : c
          )
        );
        router.refresh();
      } else {
        toast.error(result.error || t('unblockFailed'));
      }
    });
  };

  const hasPendingSection = isStaff && pendingRequests.length > 0;

  return (
    <>

      {hasPendingSection && (
        <section className="msg-section">
          <h2 className="msg-section-title">
            {t('pendingSectionTitle')} ({pendingRequests.length})
          </h2>
          <div className="pending-list">
            {pendingRequests.map((req) => (
              <div className="pending-row" key={req.relationship_id}>
                <div className="pending-info">
                  <strong>{req.student_name}</strong>
                  <span className="muted">
                    {t('sentAt')} {formatDate(req.requested_at)}
                  </span>
                </div>
                <div className="pending-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isPending}
                    onClick={() => handleAccept(req.relationship_id)}
                  >
                    {t('accept')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={isPending}
                    onClick={() => handleDecline(req.relationship_id)}
                  >
                    {t('decline')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="msg-section">
        {hasPendingSection && <h2 className="msg-section-title">{t('conversationsTitle')}</h2>}

        {conversations.length > 0 ? (
          <div className="conversation-list">
            {conversations.map((conv) => (
              <div className="conversation-item" key={conv.partner_id}>
                <Link
                  className={`conversation-row ${conv.unread_count ? 'unread' : ''}`}
                  href={`/messages/${conv.partner_id}?name=${encodeURIComponent(
                    conv.partner_name
                  )}&role=${encodeURIComponent(conv.partner_role)}`}
                >
                  <div className="conversation-avatar">{conv.partner_name?.[0]?.toUpperCase() || '?'}</div>
                  <div className="conversation-main">
                    <div className="conversation-top">
                      <strong>{conv.partner_name}</strong>
                      <span className="role-chip">{roleLabel(conv.partner_role, tRole)}</span>
                      {conv.relationship_status && conv.relationship_status !== 'accepted' && (
                        <span className={`status-chip status-${conv.relationship_status}`}>
                          {STATUS_LABELS[conv.relationship_status] || conv.relationship_status}
                        </span>
                      )}
                    </div>
                    <p className="conversation-preview">{conv.last_message_preview || '—'}</p>
                  </div>
                  <div className="conversation-side">
                    <span className="conversation-time">{formatDate(conv.last_message_at)}</span>
                    {conv.unread_count > 0 && (
                      <span className="conversation-unread">
                        {conv.unread_count <= 99 ? conv.unread_count : '99+'}
                      </span>
                    )}
                  </div>
                </Link>

                {isStaff && conv.partner_role === 'user' && (
                  <div className="conversation-block-form">
                    {conv.relationship_status === 'blocked' && conv.relationship_id ? (
                      <button
                        type="button"
                        className="btn btn-text"
                        disabled={isPending}
                        onClick={() => handleUnblock(conv.relationship_id!)}
                      >
                        {t('unblock')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-text btn-danger-text"
                        disabled={isPending}
                        onClick={() => handleBlock(conv.partner_id, conv.partner_name)}
                      >
                        {t('block')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          !hasPendingSection && (
            <div className="empty-state">
              <p>{t('emptyState')}</p>
              <Link className="btn btn-primary" href="/messages/new">
                {t('startNewMessage')}
              </Link>
            </div>
          )
        )}
      </section>
    </>
  );
}

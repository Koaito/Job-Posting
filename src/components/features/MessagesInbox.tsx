'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  acceptMessageRequest,
  declineMessageRequest,
  blockStudent,
  unblockRelationship,
} from '@/app/actions/messages';
import { roleLabel } from '@/lib/auth/roles';
import type { Conversation, PendingRequest } from '@/types/messages';

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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Đang chờ',
  declined: 'Đã từ chối',
  blocked: 'Đã chặn',
};

export function MessagesInbox({
  initialConversations,
  initialPendingRequests,
  isStaff,
}: MessagesInboxProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleAccept = (relationshipId: string) => {
    setError('');
    startTransition(async () => {
      const result = await acceptMessageRequest(relationshipId);
      if (result.success) {
        setPendingRequests((prev) => prev.filter((r) => r.relationship_id !== relationshipId));
        router.refresh();
      } else {
        setError(result.error || 'Không thể chấp nhận yêu cầu');
      }
    });
  };

  const handleDecline = (relationshipId: string) => {
    setError('');
    startTransition(async () => {
      const result = await declineMessageRequest(relationshipId);
      if (result.success) {
        setPendingRequests((prev) => prev.filter((r) => r.relationship_id !== relationshipId));
        router.refresh();
      } else {
        setError(result.error || 'Không thể từ chối yêu cầu');
      }
    });
  };

  const handleBlock = (studentId: string, partnerName: string) => {
    if (!confirm(`Chặn ${partnerName}? Học viên này sẽ không nhắn tin được cho bạn nữa.`)) return;
    setError('');
    startTransition(async () => {
      const result = await blockStudent(studentId);
      if (result.success) {
        setConversations((prev) =>
          prev.map((c) => (c.partner_id === studentId ? { ...c, relationship_status: 'blocked' } : c))
        );
        router.refresh();
      } else {
        setError(result.error || 'Không thể chặn học viên');
      }
    });
  };

  const handleUnblock = (relationshipId: string) => {
    setError('');
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
        setError(result.error || 'Không thể bỏ chặn');
      }
    });
  };

  const hasPendingSection = isStaff && pendingRequests.length > 0;

  return (
    <>
      {error && (
        <div className="flash flash-error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {hasPendingSection && (
        <section className="msg-section">
          <h2 className="msg-section-title">Yêu cầu đang chờ ({pendingRequests.length})</h2>
          <div className="pending-list">
            {pendingRequests.map((req) => (
              <div className="pending-row" key={req.relationship_id}>
                <div className="pending-info">
                  <strong>{req.student_name}</strong>
                  <span className="muted">Gửi lúc {formatDate(req.requested_at)}</span>
                </div>
                <div className="pending-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isPending}
                    onClick={() => handleAccept(req.relationship_id)}
                  >
                    Chấp nhận
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={isPending}
                    onClick={() => handleDecline(req.relationship_id)}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="msg-section">
        {hasPendingSection && <h2 className="msg-section-title">Hội thoại</h2>}

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
                      <span className="role-chip">{roleLabel(conv.partner_role)}</span>
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
                        Bỏ chặn
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-text btn-danger-text"
                        disabled={isPending}
                        onClick={() => handleBlock(conv.partner_id, conv.partner_name)}
                      >
                        Chặn
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
              <p>Chưa có hội thoại nào.</p>
              <Link className="btn btn-primary" href="/messages/new">
                Bắt đầu nhắn tin mới
              </Link>
            </div>
          )
        )}
      </section>
    </>
  );
}

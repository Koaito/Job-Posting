'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  sendMessage,
  getMessagesSince,
  cancelPendingRequest,
  blockStudent,
  unblockRelationship,
} from '@/app/actions/messages';
import { roleLabel } from '@/lib/auth/roles';
import type { ChatMessage } from '@/types/messages';

/**
 * Khung chat (client) — phần đảm nhiệm bởi public/app.js bên Flask gốc:
 * polling ~5s/lần cho tin mới (getMessagesSince), gửi tin không cần
 * reload trang, huỷ yêu cầu pending, chặn/bỏ chặn học viên.
 *
 * page.tsx (server) đã SSR sẵn initialHistory nên khung chat có nội
 * dung đọc được ngay cả khi JS chưa kịp chạy — polling chỉ lo phần tin
 * đến SAU đó, giống đúng chia việc SSR/JS bên Flask.
 */

const POLL_INTERVAL_MS = 5000;

interface MessageThreadProps {
  partnerId: string;
  partnerName: string;
  partnerRole: string;
  relationshipStatus: string | null;
  relationshipId: string | null;
  initialHistory: ChatMessage[];
  lastId: number;
  currentUserId: string;
  isStaff: boolean;
  isStudent: boolean;
  maxContentLength: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function MessageThread({
  partnerId,
  partnerName,
  partnerRole,
  relationshipStatus,
  relationshipId,
  initialHistory,
  lastId,
  currentUserId,
  isStaff,
  isStudent,
  maxContentLength,
}: MessageThreadProps) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [lastMessageId, setLastMessageId] = useState(lastId);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(lastId);

  useEffect(() => {
    lastIdRef.current = lastMessageId;
  }, [lastMessageId]);

  // Cuộn xuống cuối mỗi khi có tin mới (gửi hoặc nhận qua polling).
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Polling nhẹ ~5s/lần cho tin ĐẾN trong lúc đang mở khung chat.
  useEffect(() => {
    const interval = setInterval(async () => {
      const newMessages = await getMessagesSince(partnerId, lastIdRef.current);
      if (newMessages.length > 0) {
        setHistory((prev) => [...prev, ...newMessages]);
        setLastMessageId(newMessages[newMessages.length - 1].id);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [partnerId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Vui lòng nhập nội dung tin nhắn.');
      return;
    }
    setError('');
    setIsSending(true);
    const result = await sendMessage(partnerId, trimmed);
    setIsSending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setContent('');
    if (result.status === 'sent') {
      setHistory((prev) => [...prev, result.message]);
      setLastMessageId(result.message.id);
    } else {
      // status === 'pending': chưa có tin nhắn thật nào được lưu —
      // chỉ hiện thông báo, giữ nguyên lịch sử (khớp flash message bên
      // Flask, không tự chèn tin giả vào khung chat).
      router.refresh();
      alert(result.message);
    }
  };

  const handleCancel = () => {
    if (!confirm(`Huỷ yêu cầu nhắn tin đang chờ tới ${partnerName}?`)) return;
    setError('');
    startTransition(async () => {
      const result = await cancelPendingRequest(partnerId);
      if (result.success) {
        router.push('/messages');
      } else {
        setError(result.error || 'Không thể huỷ yêu cầu');
      }
    });
  };

  const handleBlock = () => {
    if (!confirm(`Chặn ${partnerName}? Học viên này sẽ không nhắn tin được cho bạn nữa.`)) return;
    setError('');
    startTransition(async () => {
      const result = await blockStudent(partnerId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Không thể chặn học viên');
      }
    });
  };

  const handleUnblock = () => {
    if (!relationshipId) return;
    setError('');
    startTransition(async () => {
      const result = await unblockRelationship(relationshipId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Không thể bỏ chặn');
      }
    });
  };

  const showBlockControls = isStaff && partnerRole === 'user';
  const showCancelControl =
    isStudent && history.length === 0 && (partnerRole === 'ss_team' || partnerRole === 'admin');

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo — Flask gốc
    // (messages_thread.html) không có div bọc nào ngoài {% block content %},
    // main.content (root layout.tsx) đã lo container rồi.
    <>
      <header className="page-head chat-head">
        <div>
          <Link className="back-link" href="/messages">
            ← Tin nhắn
          </Link>
          <h1>
            {partnerName}
            {partnerRole && <span className="role-chip">{roleLabel(partnerRole)}</span>}
          </h1>
        </div>
        {showBlockControls &&
          (relationshipStatus === 'blocked' && relationshipId ? (
            <button type="button" className="btn btn-ghost" disabled={isPending} onClick={handleUnblock}>
              Bỏ chặn học viên
            </button>
          ) : relationshipStatus !== 'blocked' ? (
            <button
              type="button"
              className="btn btn-ghost btn-danger-text"
              disabled={isPending}
              onClick={handleBlock}
            >
              Chặn học viên
            </button>
          ) : null)}
      </header>

      {error && (
        <div className="flash flash-error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div className="chat-shell">
        <div className="chat-messages" ref={scrollRef}>
          {history.length > 0 ? (
            history.map((msg) => (
              <div
                key={msg.id}
                className={`msg ${msg.sender_id === currentUserId ? 'msg-out' : 'msg-in'}`}
              >
                <div className="msg-bubble">{msg.content}</div>
                <div className="msg-time">{formatTime(msg.created_at)}</div>
              </div>
            ))
          ) : (
            <div className="empty-state chat-empty">
              <p>
                {isStudent
                  ? `Chưa có tin nhắn nào. Gửi tin đầu tiên bên dưới để tạo yêu cầu nhắn tin tới ${partnerName}.`
                  : `Chưa có tin nhắn nào. Nhắn trước cho ${partnerName} — hội thoại sẽ tự mở, không cần chờ chấp nhận.`}
              </p>
            </div>
          )}
        </div>

        <form className="composer" onSubmit={handleSend}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={maxContentLength}
            rows={2}
            placeholder="Nhập tin nhắn..."
            required
          />
          <button type="submit" className="btn btn-primary" disabled={isSending}>
            {isSending ? 'Đang gửi...' : 'Gửi'}
          </button>
        </form>

        {showCancelControl && (
          <div className="cancel-request-form">
            <button type="button" className="btn btn-text" disabled={isPending} onClick={handleCancel}>
              Đã gửi nhầm? Huỷ yêu cầu đang chờ (nếu có)
            </button>
          </div>
        )}
      </div>
    </>
  );
}

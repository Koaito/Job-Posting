'use server';

import { apiFetch, apiFetchRaw, formatErrorDetail } from '@/lib/api/client';
import type {
  ChatMessage,
  Conversation,
  PendingRequest,
  PersonSearchResult,
} from '@/types/messages';

/**
 * Server Actions for Messages
 * Corresponds to Flask blueprint: blueprints/messages.py
 * Backend thật: api/routers/messages.py (qua backend_auth.py, KHÔNG
 * phải crawler_client.py — router /messages/... của backend bắt buộc
 * Authorization: Bearer <access_token>, không chỉ X-API-Key, giống mọi
 * hàm khác trong backend_auth.py có tiền tố tương tự).
 *
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): dùng chung apiFetch()/
 * apiFetchRaw() (lib/api/client.ts) thay vì tự lặp fetch()/header/error-
 * parsing 14 lần trong file này — formatErrorDetail() bản riêng (thiếu
 * xử lý "loc") đã bị xoá, dùng thẳng bản đầy đủ nhất từ lib/api/client.ts.
 * Có auto-refresh access_token khi 401 token_expired cho MỌI thao tác
 * ghi (sendMessage, accept/decline, cancel, block/unblock...) — trước
 * đây các hàm này còn không có cả timeout (không dùng AbortController),
 * apiFetch()/apiFetchRaw() tự thêm timeout 30s mặc định cho tất cả.
 */

/**
 * GET /messages/conversations — hội thoại ĐÃ CÓ ít nhất 1 tin nhắn
 * (backend suy trực tiếp từ bảng messages), kèm last_message_preview/
 * last_message_at/unread_count/relationship_status (null nếu là cặp
 * SS-SS, không qua state machine chat_relationships).
 */
export async function getConversations(): Promise<Conversation[]> {
  const result = await apiFetch<Conversation[]>('/messages/conversations', { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch conversations:', result.status, result.error);
    return [];
  }
  return result.data;
}

/**
 * GET /messages/pending-requests — CHỈ SS/admin gọi được (backend tự
 * 403 nếu không phải, ở đây trả mảng rỗng thay vì hiện lỗi cho student
 * — trang inbox chỉ hiện mục này khi currentUser là staff). Học viên
 * đang 'pending' nhưng CHƯA từng nhắn không nằm trong getConversations()
 * ở trên — đây là mục "Yêu cầu đang chờ" riêng cho SS.
 */
export async function getPendingRequests(): Promise<PendingRequest[]> {
  const result = await apiFetch<PendingRequest[]>('/messages/pending-requests', { cache: 'no-store' });

  if (!result.success) {
    // 403 hợp lệ khi caller là student — không log như lỗi thật.
    if (result.status !== 403) {
      console.error('Failed to fetch pending requests:', result.status, result.error);
    }
    return [];
  }
  return result.data;
}

/**
 * GET /messages/unread-count — dùng cho badge sidebar (poll ~25-30s,
 * xem Sidebar.tsx) và số hiện ngay lúc tải trang lần đầu.
 */
export async function getUnreadCount(): Promise<number> {
  const result = await apiFetch<{ count?: number }>('/messages/unread-count', { cache: 'no-store' });

  if (!result.success) {
    console.error('Error fetching unread count:', result.status, result.error);
    return 0;
  }
  return result.data.count ?? 0;
}

/**
 * GET /messages/search-people?q=... — CHỈ trả id/full_name/role,
 * KHÔNG email/phone (backend tự lọc theo role người tìm: học viên chỉ
 * thấy ss_team/admin, SS/admin thấy mọi role). q rỗng thì không gọi
 * API, tránh round-trip thừa cho trang tìm người lúc mới mở.
 */
export async function searchPeople(q: string): Promise<PersonSearchResult[]> {
  const query = q.trim();
  if (!query) return [];

  const params = new URLSearchParams({ q: query });
  const result = await apiFetch<PersonSearchResult[]>(`/messages/search-people?${params}`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to search people:', result.status, result.error);
    return [];
  }
  return result.data;
}

/**
 * GET /messages/with/{partner_id} — lịch sử đầy đủ, backend trả MỚI
 * NHẤT TRƯỚC (ORDER BY id DESC) — đảo lại ở đây để khớp chiều đọc
 * trên->dưới (cũ->mới) trong khung chat, giống thread() bên Flask.
 * Cho xem được kể cả khi quan hệ đang declined/blocked (backend chỉ
 * chặn GỬI, không chặn XEM).
 */
export async function getMessageHistory(
  partnerId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const result = await apiFetch<ChatMessage[]>(`/messages/with/${partnerId}?${params}`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch message history:', result.status, result.error);
    return [];
  }
  return result.data.slice().reverse();
}

/**
 * GET /messages/since/{partner_id}?after_id=... — polling nhẹ trong
 * lúc mở khung chat (~5s/lần, xem MessageThread.tsx). Backend trả CŨ
 * NHẤT TRƯỚC (ORDER BY id ASC), khớp đúng thứ tự append vào cuối khung
 * chat — KHÔNG đảo lại (khác getMessageHistory() ở trên).
 */
export async function getMessagesSince(
  partnerId: string,
  afterId: number
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ after_id: String(afterId) });
  const result = await apiFetch<ChatMessage[]>(`/messages/since/${partnerId}?${params}`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Error polling new messages:', result.status, result.error);
    return [];
  }
  return result.data;
}

/**
 * POST /messages/read/{partner_id} — đánh dấu đã đọc mọi tin partner_id
 * gửi cho current user. Gọi mỗi lần mở khung chat — lỗi ở đây bị NUỐT
 * (không throw) vì không đáng làm hỏng cả trang chỉ vì đánh dấu đã đọc
 * thất bại, người dùng vẫn cần xem được lịch sử tin nhắn.
 */
export async function markMessagesRead(partnerId: string): Promise<number> {
  const result = await apiFetch<{ marked_read?: number }>(`/messages/read/${partnerId}`, { method: 'POST' });

  if (!result.success) {
    console.error('Error marking messages read:', result.status, result.error);
    return 0;
  }
  return result.data.marked_read ?? 0;
}

/**
 * POST /messages — gửi 1 tin nhắn. Response backend KHÔNG đồng nhất 1
 * shape (xem docstring backend_auth.send_message()):
 *   - 201: tin nhắn thật đã được lưu -> { status: 'sent', ...tin nhắn }.
 *   - 202: học viên vừa TẠO/GỬI LẠI request pending tới 1 SS lần đầu —
 *     CHƯA có tin nhắn nào được lưu -> { status: 'pending', message }.
 * Cả 2 mã đều nằm trong response.ok (2xx) của fetch nên phân biệt được
 * ngay qua response.status.
 *
 * Dùng apiFetchRaw() thô (không phải apiFetch()) vì cần đọc trực tiếp
 * response.status để phân biệt 201/202, và fallback lỗi khác nhau theo
 * từng status code (429/409/403/404) — apiFetch() chỉ hỗ trợ 1
 * fallbackError chung. Vẫn hưởng auto-refresh + timeout dùng chung qua
 * apiFetchRaw().
 */
export async function sendMessage(
  partnerId: string,
  content: string
): Promise<
  | { success: true; status: 'sent'; message: ChatMessage }
  | { success: true; status: 'pending'; message: string }
  | { success: false; error: string }
> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { success: false, error: 'Vui lòng nhập nội dung tin nhắn.' };
  }
  if (trimmed.length > 2000) {
    return { success: false, error: 'Tin nhắn không được vượt quá 2000 ký tự.' };
  }

  try {
    const response = await apiFetchRaw('/messages', {
      method: 'POST',
      body: { receiver_id: partnerId, content: trimmed },
    });

    if (response.status === 201) {
      const data = await response.json();
      return { success: true, status: 'sent', message: data };
    }
    if (response.status === 202) {
      const data = await response.json();
      return { success: true, status: 'pending', message: data.message || 'Đã gửi yêu cầu nhắn tin.' };
    }

    const error = await response.json().catch(() => ({ detail: response.statusText }));
    let fallback = 'Không thể gửi tin nhắn';
    if (response.status === 429) fallback = 'Bạn đang gửi quá nhanh, vui lòng thử lại sau ít phút.';
    if (response.status === 409) fallback = 'Trạng thái hội thoại vừa thay đổi, tải lại trang để xem mới nhất.';
    if (response.status === 403) fallback = 'Bạn không có quyền nhắn tin với người này.';
    if (response.status === 404) fallback = 'Không tìm thấy người nhận.';
    return {
      success: false,
      error: error.detail != null ? formatErrorDetail(error.detail) : fallback,
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * POST /messages/cancel/{ss_id} — CHỈ role 'user' gọi được. Học viên tự
 * huỷ request 'pending' do CHÍNH MÌNH tạo (gửi nhầm SS / đổi ý) — XOÁ
 * HẲN row, KHÔNG áp cooldown 7 ngày (khác decline do SS làm).
 */
export async function cancelPendingRequest(
  ssId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<void>(`/messages/cancel/${ssId}`, {
    method: 'POST',
    fallbackError: 'Không thể huỷ yêu cầu',
  });

  if (!result.success) {
    console.error('Error cancelling pending request:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/**
 * POST /messages/relationships/{id}/accept — CHỈ SS/admin sở hữu
 * request đó gọi được (backend tự 403/409 nếu không đúng).
 */
export async function acceptMessageRequest(
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<void>(`/messages/relationships/${relationshipId}/accept`, {
    method: 'POST',
    fallbackError: 'Không thể chấp nhận yêu cầu',
  });

  if (!result.success) {
    console.error('Error accepting message request:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/** POST /messages/relationships/{id}/decline — cùng điều kiện như accept. */
export async function declineMessageRequest(
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<void>(`/messages/relationships/${relationshipId}/decline`, {
    method: 'POST',
    fallbackError: 'Không thể từ chối yêu cầu',
  });

  if (!result.success) {
    console.error('Error declining message request:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/**
 * POST /messages/block/{student_id} — SS/admin tự chặn 1 học viên,
 * nhận THẲNG student_id (không cần biết relationship_id trước) nên
 * dùng được cả khi chưa từng có quan hệ nào lẫn giữa chừng hội thoại
 * đã 'accepted'.
 */
export async function blockStudent(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<void>(`/messages/block/${studentId}`, {
    method: 'POST',
    fallbackError: 'Không thể chặn học viên',
  });

  if (!result.success) {
    console.error('Error blocking student:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/**
 * POST /messages/relationships/{id}/unblock — CẦN relationship_id (lấy
 * từ Conversation.relationship_id, CHỈ có khi đã từng nhắn qua lại —
 * SS chặn 1 học viên TRƯỚC KHI từng chat sẽ không có relationship_id
 * để gọi hàm này, residual edge case hiếm, giống bên Flask gốc).
 */
export async function unblockRelationship(
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<void>(`/messages/relationships/${relationshipId}/unblock`, {
    method: 'POST',
    fallbackError: 'Không thể bỏ chặn',
  });

  if (!result.success) {
    console.error('Error unblocking relationship:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

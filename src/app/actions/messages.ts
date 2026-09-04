'use server';

import { getAuthHeaders } from '@/lib/api/client';
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
 * Trước đây file này là stub `throw new Error('Not implemented')` cho
 * cả 3 hàm (Phase 6 chưa làm) — viết lại đủ theo types/messages.ts
 * (đã đúng sẵn từ đợt audit trước, chỉ chưa ai dùng) + đúng theo
 * backend_auth.py (list_conversations, list_pending_requests,
 * get_unread_count, search_people, get_message_history,
 * get_messages_since, mark_messages_read, send_message,
 * accept/decline_message_request, cancel_pending_request,
 * block_student_in_chat, unblock_message_relationship).
 */

const API_BASE = process.env.FASTAPI_URL;

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        item && typeof item === 'object' && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join('; ');
  }
  return 'Có lỗi xảy ra';
}

/**
 * GET /messages/conversations — hội thoại ĐÃ CÓ ít nhất 1 tin nhắn
 * (backend suy trực tiếp từ bảng messages), kèm last_message_preview/
 * last_message_at/unread_count/relationship_status (null nếu là cặp
 * SS-SS, không qua state machine chat_relationships).
 */
export async function getConversations(): Promise<Conversation[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/messages/conversations`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch conversations:', response.status, response.statusText);
        return [];
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
}

/**
 * GET /messages/pending-requests — CHỈ SS/admin gọi được (backend tự
 * 403 nếu không phải, ở đây trả mảng rỗng thay vì hiện lỗi cho student
 * — trang inbox chỉ hiện mục này khi currentUser là staff). Học viên
 * đang 'pending' nhưng CHƯA từng nhắn không nằm trong getConversations()
 * ở trên — đây là mục "Yêu cầu đang chờ" riêng cho SS.
 */
export async function getPendingRequests(): Promise<PendingRequest[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/messages/pending-requests`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // 403 hợp lệ khi caller là student — không log như lỗi thật.
        if (response.status !== 403) {
          console.error('Failed to fetch pending requests:', response.status, response.statusText);
        }
        return [];
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    return [];
  }
}

/**
 * GET /messages/unread-count — dùng cho badge sidebar (poll ~25-30s,
 * xem Sidebar.tsx) và số hiện ngay lúc tải trang lần đầu.
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE}/messages/unread-count`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count ?? 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`${API_BASE}/messages/search-people?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to search people:', response.status, response.statusText);
        return [];
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error searching people:', error);
    return [];
  }
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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const response = await fetch(`${API_BASE}/messages/with/${partnerId}?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch message history:', response.status, response.statusText);
        return [];
      }
      const history: ChatMessage[] = await response.json();
      return history.slice().reverse();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching message history:', error);
    return [];
  }
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
  try {
    const params = new URLSearchParams({ after_id: String(afterId) });
    const response = await fetch(`${API_BASE}/messages/since/${partnerId}?${params}`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error polling new messages:', error);
    return [];
  }
}

/**
 * POST /messages/read/{partner_id} — đánh dấu đã đọc mọi tin partner_id
 * gửi cho current user. Gọi mỗi lần mở khung chat — lỗi ở đây bị NUỐT
 * (không throw) vì không đáng làm hỏng cả trang chỉ vì đánh dấu đã đọc
 * thất bại, người dùng vẫn cần xem được lịch sử tin nhắn.
 */
export async function markMessagesRead(partnerId: string): Promise<number> {
  try {
    const response = await fetch(`${API_BASE}/messages/read/${partnerId}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.marked_read ?? 0;
  } catch (error) {
    console.error('Error marking messages read:', error);
    return 0;
  }
}

/**
 * POST /messages — gửi 1 tin nhắn. Response backend KHÔNG đồng nhất 1
 * shape (xem docstring backend_auth.send_message()):
 *   - 201: tin nhắn thật đã được lưu -> { status: 'sent', ...tin nhắn }.
 *   - 202: học viên vừa TẠO/GỬI LẠI request pending tới 1 SS lần đầu —
 *     CHƯA có tin nhắn nào được lưu -> { status: 'pending', message }.
 * Cả 2 mã đều nằm trong response.ok (2xx) của fetch nên phân biệt được
 * ngay qua response.status, không cần tự gọi thư viện HTTP khác như
 * bản Flask (đó là vì requests.post() ở Python coi 202 là "không phải
 * lỗi nhưng không map sẵn field .ok cho từng status" — fetch() JS thì
 * .ok đã true cho mọi 2xx nên không vướng vấn đề tương tự).
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
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ receiver_id: partnerId, content: trimmed }),
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
    // BUG FIX (phát hiện lúc viết test): formatErrorDetail(undefined)
    // KHÔNG trả falsy — nhánh cuối của nó trả cứng 'Có lỗi xảy ra' (string
    // luôn truthy), nên `formatErrorDetail(error.detail) || fallback`
    // không bao giờ rơi vào fallback dù backend không trả detail gì cả,
    // 4 thông báo tiếng Việt cụ thể ở trên (429/409/403/404) im lặng
    // không bao giờ hiện ra được. Chỉ gọi formatErrorDetail khi THỰC SỰ
    // có detail, còn không thì dùng thẳng fallback theo status code.
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
  try {
    const response = await fetch(`${API_BASE}/messages/cancel/${ssId}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return {
        success: false,
        error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể huỷ yêu cầu',
      };
    }
    return { success: true };
  } catch (error) {
    console.error('Error cancelling pending request:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * POST /messages/relationships/{id}/accept — CHỈ SS/admin sở hữu
 * request đó gọi được (backend tự 403/409 nếu không đúng).
 */
export async function acceptMessageRequest(
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/messages/relationships/${relationshipId}/accept`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return {
        success: false,
        error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể chấp nhận yêu cầu',
      };
    }
    return { success: true };
  } catch (error) {
    console.error('Error accepting message request:', error);
    return { success: false, error: 'Network error' };
  }
}

/** POST /messages/relationships/{id}/decline — cùng điều kiện như accept. */
export async function declineMessageRequest(
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/messages/relationships/${relationshipId}/decline`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return {
        success: false,
        error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể từ chối yêu cầu',
      };
    }
    return { success: true };
  } catch (error) {
    console.error('Error declining message request:', error);
    return { success: false, error: 'Network error' };
  }
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
  try {
    const response = await fetch(`${API_BASE}/messages/block/${studentId}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return {
        success: false,
        error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể chặn học viên',
      };
    }
    return { success: true };
  } catch (error) {
    console.error('Error blocking student:', error);
    return { success: false, error: 'Network error' };
  }
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
  try {
    const response = await fetch(`${API_BASE}/messages/relationships/${relationshipId}/unblock`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return {
        success: false,
        error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể bỏ chặn',
      };
    }
    return { success: true };
  } catch (error) {
    console.error('Error unblocking relationship:', error);
    return { success: false, error: 'Network error' };
  }
}

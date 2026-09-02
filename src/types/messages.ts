/**
 * Messaging types — bám đúng api/schemas/messages.py (backend FastAPI thật).
 *
 * BUG FIX (audit 09/2026): file này trước đây tự bịa field (id: number,
 * sender_id/recipient_id: number, MessageThread lồng object user riêng)
 * không khớp response thật — chưa gây lỗi runtime vì actions/messages.ts
 * còn là stub. Viết lại đúng theo ChatMessageOut/ConversationOut/
 * PendingRequestOut trước khi code module này (Phase 6).
 */

/** Khớp ChatMessageOut — 1 tin nhắn (GET lịch sử chat, gửi mới). */
export interface ChatMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
}

/** Khớp ConversationOut — GET /messages/conversations (danh sách hội thoại). */
export interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_role: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  /** null = cặp SS-SS, không qua state machine chat_relationships. */
  relationship_status?: string | null;
  relationship_id?: string | null;
}

/** Khớp PendingRequestOut — học viên đã xin kết nối nhưng SS chưa phản hồi. */
export interface PendingRequest {
  relationship_id: string;
  student_id: string;
  student_name: string;
  requested_at: string;
}

/** Khớp UnreadCountOut — GET /messages/unread-count. */
export interface UnreadCount {
  count: number;
}

/** Khớp PersonSearchResult — GET /messages/search-people?q=... (CHỈ 3 field, không email/phone). */
export interface PersonSearchResult {
  id: string;
  full_name: string;
  role: string;
}

/** Khớp MessageCreate — POST gửi tin nhắn mới. */
export interface MessageCreatePayload {
  receiver_id: string;
  content: string;
}

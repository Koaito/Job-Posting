/**
 * Message types
 */

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  other_user_id: number;
  other_user_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface MessageThread {
  id: number;
  other_user: {
    id: number;
    name: string;
    email: string;
  };
  messages: Message[];
}

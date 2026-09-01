'use server';

/**
 * Server Actions for Messages
 * Corresponds to Flask blueprint: blueprints/messages.py
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export async function getMessages() {
  throw new Error('Not implemented');
}

export async function getMessageThread(id: number) {
  throw new Error('Not implemented');
}

export async function sendMessage(recipientId: number, content: string) {
  throw new Error('Not implemented');
}

'use server';

/**
 * Server Actions for Contacts
 * Corresponds to Flask blueprint: blueprints/contacts.py
 *
 * TODO (chưa làm trong đợt sửa 09/2026 này — mới xong Companies, xem
 * commit "feat(companies)..."): viết lại đầy đủ theo types/contacts.ts
 * (đã đúng sẵn, khớp api/routers/contacts.py, chỉ chưa ai dùng — cùng
 * pattern "dead type file" đã sửa ở companies.ts/jobs.ts).
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export async function getContacts(filters?: any) {
  throw new Error('Not implemented');
}

export async function getContactById(id: number) {
  throw new Error('Not implemented');
}

export async function createContact(data: any) {
  throw new Error('Not implemented');
}

export async function updateContact(id: number, data: any) {
  throw new Error('Not implemented');
}

export async function deleteContact(id: number) {
  throw new Error('Not implemented');
}

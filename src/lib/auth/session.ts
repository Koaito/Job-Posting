/**
 * Session management utilities
 * Handles JWT cookie management
 */

import { cookies } from 'next/headers';

const TOKEN_KEY = 'access_token';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function setSessionToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_KEY, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_KEY)?.value;
}

export async function clearSessionToken() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_KEY);
}

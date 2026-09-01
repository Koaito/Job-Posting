'use server';

import { cookies } from 'next/headers';

/**
 * Server Actions for Authentication
 * Corresponds to Flask blueprint: blueprints/auth.py
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export async function login(email: string, password: string) {
  // TODO: Call FastAPI /token endpoint
  // TODO: Set HTTP-only cookie
  // TODO: Return user data
  throw new Error('Not implemented');
}

export async function logout() {
  // TODO: Clear HTTP-only cookie
  throw new Error('Not implemented');
}

export async function getCurrentUser() {
  // TODO: Get token from cookie
  // TODO: Call FastAPI /users/me
  // TODO: Return user data
  throw new Error('Not implemented');
}

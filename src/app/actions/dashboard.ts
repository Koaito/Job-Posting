'use server';

/**
 * Server Actions for Dashboard
 * Corresponds to Flask blueprint: blueprints/dashboard.py
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export async function getDashboardStats() {
  // TODO: Fetch stats like total jobs, companies, contacts, etc.
  throw new Error('Not implemented');
}

export async function getRecentActivity() {
  throw new Error('Not implemented');
}

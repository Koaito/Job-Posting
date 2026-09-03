'use server';

import { getApiKey } from '@/lib/api/client';

/**
 * Server Actions for Dashboard
 * Corresponds to Flask blueprint: blueprints/dashboard.py
 */

const API_BASE = process.env.FASTAPI_URL;

interface DashboardStats {
  total_jobs: number;
  total_companies: number;
  jobs_open: number; // Job đang còn tuyển (status = OPEN)
  total_students: number | null;
  total_applications: number;
  total_saved_jobs: number;
}

/**
 * Get dashboard statistics
 * Calls FastAPI /stats endpoint which returns aggregated data
 * Backend bổ sung jobs_by_status và total_students từ 09/2026
 * Matches Flask dashboard.py KPI cards (6 cards)
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: { 'X-API-Key': getApiKey() },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000), // 30s timeout cho cold start
    });

    if (!response.ok) {
      console.error('Failed to fetch stats:', response.status, response.statusText);
      return getEmptyStats();
    }

    const stats = await response.json();

    // Backend trả jobs_by_status với enum values từ DB: "OPEN", "CLOSED"
    // KHÔNG phải text hiển thị tiếng Việt "Đang tuyển"
    const jobsOpen = stats.jobs_by_status?.['OPEN'] || 0;

    return {
      total_jobs: stats.total_jobs || 0,
      total_companies: stats.total_companies || 0,
      jobs_open: jobsOpen,
      total_students: stats.total_students ?? null,
      total_applications: stats.total_applications || 0,
      total_saved_jobs: stats.total_saved_jobs || 0,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return empty stats thay vì crash
    return getEmptyStats();
  }
}

/**
 * Fallback empty stats when API fails
 */
function getEmptyStats(): DashboardStats {
  return {
    total_jobs: 0,
    total_companies: 0,
    jobs_open: 0,
    total_students: null,
    total_applications: 0,
    total_saved_jobs: 0,
  };
}

export async function getRecentActivity() {
  // TODO: Implement when activity logs endpoint is available
  throw new Error('Not implemented');
}

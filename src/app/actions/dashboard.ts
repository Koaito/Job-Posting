'use server';

import { apiFetch } from '@/lib/api/client';
import { getAuditLogs } from '@/app/actions/audit';
import type { AuditLog } from '@/types/audit';
import type { DashboardStats, DashboardStatsRaw } from '@/types/dashboard';

/**
 * Server Actions for Dashboard
 * Corresponds to Flask blueprint: blueprints/dashboard.py
 *
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #5): getDashboardStats()
 * trước đây là ngoại lệ DUY NHẤT trong toàn bộ app/actions/ tự gọi
 * fetch() trực tiếp (tự set header X-API-Key, tự AbortSignal.timeout())
 * thay vì đi qua apiFetch() dùng chung như MỌI action khác (audit.ts,
 * companies.ts, contacts.ts, crawl.ts, import-export.ts, jobs.ts, me.ts,
 * messages.ts, email-templates.ts). Hệ quả: getDashboardStats() KHÔNG
 * được auto-refresh access_token khi 401 (khác mọi action khác) — GET
 * /stats là route CÔNG KHAI (chỉ cần X-API-Key, không cần Authorization)
 * nên thực ra không cần Bearer token, nhưng route public ở apiFetch()
 * vẫn nghĩa là `auth: false`, không phải "tự viết fetch() riêng". Đổi
 * sang apiFetch(path, { auth: false, cache: 'no-store' }) — cùng 1 nguồn
 * logic (timeout/error-format) với mọi action khác, không còn code
 * đường riêng cho đúng 1 hàm.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const result = await apiFetch<DashboardStatsRaw>('/stats', {
    auth: false,
    cache: 'no-store',
    timeoutMs: 30000, // cold start backend có thể chậm, giữ nguyên 30s như bản cũ
  });

  if (!result.success) {
    console.error('Failed to fetch stats:', result.status, result.error);
    return getEmptyStats();
  }

  const stats = result.data;

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

/**
 * Lấy N thao tác gần nhất để hiện widget "Hoạt động gần đây" trên
 * dashboard. TRƯỚC ĐÂY: luôn throw 'Not implemented' với TODO "chờ
 * endpoint activity logs có sẵn" — nhưng endpoint đó (GET /audit-logs)
 * đã có và đang dùng ở trang /activity từ lâu (xem actions/audit.ts).
 * Chỉ cần gọi lại getAuditLogs với view='auto' (mọi thao tác, không
 * lọc) + limit nhỏ, không cần gọi API riêng.
 */
export async function getRecentActivity(limit = 8): Promise<AuditLog[]> {
  const { items } = await getAuditLogs({ view: 'auto', limit, offset: 0 });
  return items;
}

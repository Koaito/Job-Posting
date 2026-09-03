'use server';

import { cookies } from 'next/headers';
import { getApiKey } from '@/lib/api/client';
import type {
  CrawlTriggerPayload,
  CrawlAccepted,
  CrawlStatus,
  CrawlHistoryFilters,
  PaginatedCrawlRuns,
  CrawlLogsResponse,
  CrawlBatchTriggerPayload,
  CrawlBatchAccepted,
  CrawlBatchStatus,
  PaginatedCrawlBatches,
} from '@/types/crawl';

/**
 * Server Actions for Crawl
 * Corresponds to Flask blueprint: blueprints/crawl.py, crawl_status.py,
 * crawl_history.py, crawl_maintenance.py
 * Backend thật: api/routers/crawl.py.
 *
 * Trước đây file này là stub `throw new Error('Not implemented')` với
 * shape sai hoàn toàn: getCrawlStatus() không nhận run_id (route thật
 * LUÔN cần 1 run_id/batch_id cụ thể, không có "trạng thái chung"),
 * getCrawlHistory(page) bỏ qua toàn bộ filter thật (source/status/
 * triggered_by). Viết lại theo đúng api/routers/crawl.py + types/crawl.ts
 * (đã đúng sẵn).
 *
 * QUYỀN: POST /crawl và POST /crawl/batch yêu cầu role 'admin' (chặt
 * hơn mọi route ghi khác — tốn tài nguyên server thật). GET (status/
 * logs/history/sources) chỉ cần 'ss_team' trở lên, trừ GET /sources
 * (chỉ cần API key, không cần JWT — dùng để render dropdown ngay cả
 * trước khi biết role).
 */

const API_BASE = process.env.FASTAPI_URL;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

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
 * Danh sách source/category có sẵn để crawl — GET /sources, dùng để
 * render dropdown ở form kích hoạt crawl. Response thật là
 * {source: {category_key: label}} (xem api/routers/meta.py::get_sources),
 * KHÔNG có shape "list" — luôn khớp sources_registry.py hiện hành,
 * không hardcode phía frontend.
 */
export async function getCrawlSources(): Promise<Record<string, Record<string, string>>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/sources`, {
        headers: { 'X-API-Key': getApiKey() },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch crawl sources:', response.status, response.statusText);
        return {};
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching crawl sources:', error);
    return {};
  }
}

/**
 * Kích hoạt 1 lượt crawl đơn lẻ — CHẠY NỀN, trả run_id ngay. Yêu cầu
 * role 'admin'. Backend trả 409 nếu source này đang có lượt
 * 'queued'/'running' chưa xong (unique index, không chỉ disable UI).
 */
export async function startCrawl(
  data: CrawlTriggerPayload
): Promise<{ success: boolean; result?: CrawlAccepted; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/crawl`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        // BUG FIX (cùng lỗi đã sửa ở messages.ts/audit.ts): formatErrorDetail()
        // luôn trả string truthy nên `|| fallback` không bao giờ chạy.
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể kích hoạt crawl',
        };
      }
      const result = await response.json();
      return { success: true, result };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error starting crawl:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Kích hoạt crawl NHIỀU category liên tục cho 1 nguồn (tick nhiều ô,
 * bấm 1 lần) — chỉ category đầu tiên chạy ngay trong request này, các
 * category còn lại tự nối tiếp ở backend. Cùng quyền 'admin' như crawl
 * đơn lẻ, cùng giới hạn 409 nếu nguồn đang crawl dở.
 */
export async function startCrawlBatch(
  data: CrawlBatchTriggerPayload
): Promise<{ success: boolean; result?: CrawlBatchAccepted; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/crawl/batch`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể kích hoạt crawl batch',
        };
      }
      const result = await response.json();
      return { success: true, result };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error starting crawl batch:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Poll tiến độ/kết quả 1 lượt crawl đơn lẻ — GET /crawl/{run_id}. */
export async function getCrawlStatus(runId: string): Promise<CrawlStatus | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_BASE}/crawl/${runId}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status !== 404) {
          console.error('Failed to fetch crawl status:', response.status, response.statusText);
        }
        return null;
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching crawl status:', error);
    return null;
  }
}

/**
 * Lượt crawl GẦN NHẤT (bất kể status) — dùng cho khung "Log live" luôn
 * hiện cố định trên trang /crawl, kể cả khi không có lượt nào đang
 * chạy. Trả null nếu chưa từng crawl lần nào (hợp lệ, không phải lỗi).
 */
export async function getLatestCrawlRun(): Promise<CrawlStatus | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_BASE}/crawl/latest-log-run`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch latest crawl run:', response.status, response.statusText);
        return null;
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching latest crawl run:', error);
    return null;
  }
}

/**
 * Log live của 1 run — poll lặp lại (vd mỗi 2 giây) với afterId =
 * last_id của lần gọi trước, để chỉ tải dòng MỚI. Dùng đúng last_id
 * trả về, KHÔNG tự cộng dồn phía client (tránh lệch nếu có dòng bị bỏ
 * sót do limit).
 */
export async function getCrawlLogs(runId: string, afterId: number = 0): Promise<CrawlLogsResponse> {
  try {
    const params = new URLSearchParams({ after_id: String(afterId) });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_BASE}/crawl/${runId}/logs?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch crawl logs:', response.status, response.statusText);
        return { last_id: afterId, items: [] };
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching crawl logs:', error);
    return { last_id: afterId, items: [] };
  }
}

/** Lịch sử crawl (run đơn lẻ) — GET /crawl, filter + phân trang. */
export async function getCrawlHistory(filters?: CrawlHistoryFilters): Promise<PaginatedCrawlRuns> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  try {
    const params = new URLSearchParams();
    if (filters?.source) params.append('source', filters.source);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.triggered_by) params.append('triggered_by', filters.triggered_by);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/crawl?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch crawl history:', response.status, response.statusText);
        return { total: 0, limit, offset, items: [] };
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching crawl history:', error);
    return { total: 0, limit, offset, items: [] };
  }
}

/** Poll tiến độ TỔNG của 1 batch — GET /crawl/batch/{batch_id}, kèm items (run con). */
export async function getCrawlBatchStatus(batchId: string): Promise<CrawlBatchStatus | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_BASE}/crawl/batch/${batchId}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status !== 404) {
          console.error('Failed to fetch crawl batch status:', response.status, response.statusText);
        }
        return null;
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching crawl batch status:', error);
    return null;
  }
}

/** Lịch sử batch — GET /crawl/batch, đối xứng getCrawlHistory() ở trên. */
export async function getCrawlBatchHistory(filters?: CrawlHistoryFilters): Promise<PaginatedCrawlBatches> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  try {
    const params = new URLSearchParams();
    if (filters?.source) params.append('source', filters.source);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.triggered_by) params.append('triggered_by', filters.triggered_by);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/crawl/batch?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch crawl batch history:', response.status, response.statusText);
        return { total: 0, limit, offset, items: [] };
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching crawl batch history:', error);
    return { total: 0, limit, offset, items: [] };
  }
}

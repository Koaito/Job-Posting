'use server';

import { apiFetch } from '@/lib/api/client';
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
 * QUYỀN: POST /crawl và POST /crawl/batch yêu cầu role 'admin' (chặt
 * hơn mọi route ghi khác — tốn tài nguyên server thật). GET (status/
 * logs/history/sources) chỉ cần 'ss_team' trở lên, trừ GET /sources
 * (chỉ cần API key, không cần JWT — dùng để render dropdown ngay cả
 * trước khi biết role).
 *
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): dùng chung apiFetch()
 * (lib/api/client.ts) thay vì tự lặp AbortController/timeout(15000/30000)/
 * error-parsing 9 lần trong file này — formatErrorDetail() bản riêng
 * (thiếu xử lý "loc") đã bị xoá, dùng thẳng bản đầy đủ nhất từ
 * lib/api/client.ts. Có auto-refresh access_token khi 401 token_expired
 * cho startCrawl/startCrawlBatch.
 */

/**
 * Danh sách source/category có sẵn để crawl — GET /sources, dùng để
 * render dropdown ở form kích hoạt crawl. Response thật là
 * {source: {category_key: label}} (xem api/routers/meta.py::get_sources),
 * KHÔNG có shape "list" — luôn khớp sources_registry.py hiện hành,
 * không hardcode phía frontend. Route public (chỉ cần X-API-Key).
 */
export async function getCrawlSources(): Promise<Record<string, Record<string, string>>> {
  const result = await apiFetch<Record<string, Record<string, string>>>('/sources', {
    auth: false,
    cache: 'no-store',
  });

  if (!result.success) {
    console.error('Failed to fetch crawl sources:', result.status, result.error);
    return {};
  }
  return result.data;
}

/**
 * Kích hoạt 1 lượt crawl đơn lẻ — CHẠY NỀN, trả run_id ngay. Yêu cầu
 * role 'admin'. Backend trả 409 nếu source này đang có lượt
 * 'queued'/'running' chưa xong (unique index, không chỉ disable UI).
 */
export async function startCrawl(
  data: CrawlTriggerPayload
): Promise<{ success: boolean; result?: CrawlAccepted; error?: string }> {
  const result = await apiFetch<CrawlAccepted>('/crawl', {
    method: 'POST',
    body: data,
    fallbackError: 'Không thể kích hoạt crawl',
  });

  if (!result.success) {
    console.error('Error starting crawl:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, result: result.data };
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
  const result = await apiFetch<CrawlBatchAccepted>('/crawl/batch', {
    method: 'POST',
    body: data,
    fallbackError: 'Không thể kích hoạt crawl batch',
  });

  if (!result.success) {
    console.error('Error starting crawl batch:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, result: result.data };
}

/**
 * Poll tiến độ/kết quả 1 lượt crawl đơn lẻ — GET /crawl/{run_id}.
 * Dùng timeout ngắn hơn (15s thay vì 30s mặc định) vì đây là poll lặp
 * lại liên tục (vd mỗi 2 giây) — giữ đúng hành vi gốc.
 */
export async function getCrawlStatus(runId: string): Promise<CrawlStatus | null> {
  const result = await apiFetch<CrawlStatus>(`/crawl/${runId}`, { cache: 'no-store', timeoutMs: 15000 });

  if (!result.success) {
    if (result.status !== 404) {
      console.error('Failed to fetch crawl status:', result.status, result.error);
    }
    return null;
  }
  return result.data;
}

/**
 * Lượt crawl GẦN NHẤT (bất kể status) — dùng cho khung "Log live" luôn
 * hiện cố định trên trang /crawl, kể cả khi không có lượt nào đang
 * chạy. Trả null nếu chưa từng crawl lần nào (hợp lệ, không phải lỗi).
 */
export async function getLatestCrawlRun(): Promise<CrawlStatus | null> {
  const result = await apiFetch<CrawlStatus>('/crawl/latest-log-run', { cache: 'no-store', timeoutMs: 15000 });

  if (!result.success) {
    console.error('Failed to fetch latest crawl run:', result.status, result.error);
    return null;
  }
  return result.data;
}

/**
 * Log live của 1 run — poll lặp lại (vd mỗi 2 giây) với afterId =
 * last_id của lần gọi trước, để chỉ tải dòng MỚI. Dùng đúng last_id
 * trả về, KHÔNG tự cộng dồn phía client (tránh lệch nếu có dòng bị bỏ
 * sót do limit).
 */
export async function getCrawlLogs(runId: string, afterId: number = 0): Promise<CrawlLogsResponse> {
  const params = new URLSearchParams({ after_id: String(afterId) });
  const result = await apiFetch<CrawlLogsResponse>(`/crawl/${runId}/logs?${params}`, {
    cache: 'no-store',
    timeoutMs: 15000,
  });

  if (!result.success) {
    console.error('Failed to fetch crawl logs:', result.status, result.error);
    return { last_id: afterId, items: [] };
  }
  return result.data;
}

/** Lịch sử crawl (run đơn lẻ) — GET /crawl, filter + phân trang. */
export async function getCrawlHistory(filters?: CrawlHistoryFilters): Promise<PaginatedCrawlRuns> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const params = new URLSearchParams();
  if (filters?.source) params.append('source', filters.source);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.triggered_by) params.append('triggered_by', filters.triggered_by);
  params.append('limit', String(limit));
  params.append('offset', String(offset));

  const result = await apiFetch<PaginatedCrawlRuns>(`/crawl?${params}`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch crawl history:', result.status, result.error);
    return { total: 0, limit, offset, items: [] };
  }
  return result.data;
}

/** Poll tiến độ TỔNG của 1 batch — GET /crawl/batch/{batch_id}, kèm items (run con). */
export async function getCrawlBatchStatus(batchId: string): Promise<CrawlBatchStatus | null> {
  const result = await apiFetch<CrawlBatchStatus>(`/crawl/batch/${batchId}`, {
    cache: 'no-store',
    timeoutMs: 15000,
  });

  if (!result.success) {
    if (result.status !== 404) {
      console.error('Failed to fetch crawl batch status:', result.status, result.error);
    }
    return null;
  }
  return result.data;
}

/** Lịch sử batch — GET /crawl/batch, đối xứng getCrawlHistory() ở trên. */
export async function getCrawlBatchHistory(filters?: CrawlHistoryFilters): Promise<PaginatedCrawlBatches> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const params = new URLSearchParams();
  if (filters?.source) params.append('source', filters.source);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.triggered_by) params.append('triggered_by', filters.triggered_by);
  params.append('limit', String(limit));
  params.append('offset', String(offset));

  const result = await apiFetch<PaginatedCrawlBatches>(`/crawl/batch?${params}`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch crawl batch history:', result.status, result.error);
    return { total: 0, limit, offset, items: [] };
  }
  return result.data;
}

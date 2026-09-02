/**
 * Company types — bám đúng api/schemas/companies.py (backend FastAPI thật).
 *
 * BUG FIX (audit 09/2026): file này trước đây tự bịa field (id: number,
 * name, size, description) không khớp response thật — chưa gây lỗi
 * runtime vì actions/companies.ts còn là stub (throw 'Not implemented'),
 * nhưng nếu code tiếp module Companies (Phase 4) mà dựa vào type cũ sẽ
 * lặp lại đúng lỗi job_id/company đã sửa ở Jobs. Viết lại đúng theo
 * CompanyOut/CompanyCreate/CompanyUpdate trước khi bắt đầu code module
 * này.
 */

import type { Job } from './jobs';

/** Khớp CompanyOut — dùng cho GET /companies (list/detail cơ bản). */
export interface Company {
  company_id: string;
  company_name: string;
  tax_id?: string | null;
  website?: string | null;
  industry?: string | null;
  company_size?: string | null;
  address?: string | null;
  fanpage_url?: string | null;
  linkedin_url?: string | null;
  /** HIGH | MEDIUM | LOW | UNVERIFIED — mặc định UNVERIFIED = "chưa đánh giá". */
  partnership_potential: string;
  province_name?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  /** false = đã bị xoá mềm (DELETE /companies/{id}) — GET mặc định không trả company này. */
  is_active: boolean;
}

/** Khớp CompanyDetailOut — GET /companies/{company_id} (thêm danh sách job). */
export interface CompanyDetail extends Company {
  jobs: Job[];
}

/** Khớp query param thật của GET /companies (api/routers/companies.py). */
export interface CompanyFilters {
  keyword?: string;
  province?: string;
  has_social?: boolean;
  created_by?: string;
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}

/** Khớp CompanyCreate (model_config extra="forbid") — POST /companies. */
export interface CompanyCreatePayload {
  company_name: string;
  tax_id?: string | null;
  website?: string | null;
  industry?: string | null;
  company_size?: string | null;
  address?: string | null;
  province_name?: string | null;
  fanpage_url?: string | null;
  linkedin_url?: string | null;
  partnership_potential?: string | null;
}

/**
 * Khớp CompanyUpdate (model_config extra="forbid") — PATCH /companies/{id}.
 * Mọi field optional, chỉ field gửi lên mới bị ghi đè.
 */
export interface CompanyUpdatePayload {
  company_name?: string;
  tax_id?: string | null;
  website?: string | null;
  industry?: string | null;
  company_size?: string | null;
  address?: string | null;
  province_name?: string | null;
  fanpage_url?: string | null;
  linkedin_url?: string | null;
  partnership_potential?: string | null;
  /** Ghi chú lý do sửa cho audit_logs — tuỳ chọn. */
  note?: string;
}

/** Khớp CompanyDeleteRequest — DELETE /companies/{id}. note BẮT BUỘC. */
export interface CompanyDeletePayload {
  note: string;
}

export interface PaginatedCompanies {
  total: number;
  limit: number;
  offset: number;
  items: Company[];
}

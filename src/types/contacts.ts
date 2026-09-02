/**
 * Company contact (HR contact) types — bám đúng api/schemas/contacts.py.
 *
 * BUG FIX (audit 09/2026): file này trước đây tự bịa field (id: number,
 * name, email, phone, position, company_id: number) không khớp response
 * thật — chưa gây lỗi runtime vì actions/contacts.ts còn là stub. Viết
 * lại đúng theo CompanyContactOut/Create/Update trước khi code module này.
 */

/** Khớp CompanyContactOut — GET /companies/{company_id}/contacts. */
export interface CompanyContact {
  contact_id: string;
  company_id: string;
  contact_name: string;
  job_title?: string | null;
  work_email?: string | null;
  social_link?: string | null;
  phone_number?: string | null;
  found_source?: string | null;
  collected_date?: string | null;
  last_contacted_date?: string | null;
  /** UNCONTACTED | EMAIL_SENT | RESPONDED | IN_PARTNERSHIP */
  contact_status: string;
  is_active: boolean;
  assigned_ss_user?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

/** Khớp CompanyContactWithCompanyOut — GET /contacts (danh sách gộp mọi công ty). */
export interface CompanyContactWithCompany extends CompanyContact {
  company_name: string;
}

/** Khớp query param thật của GET /contacts (api/routers/contacts.py::list_all_contacts). */
export interface ContactFilters {
  include_inactive?: boolean;
  contact_status?: string;
  company_id?: string;
  /** Tìm theo tên contact — tên param thật là "search", KHÔNG PHẢI "keyword" (khác GET /jobs, /companies). */
  search?: string;
  created_by?: string;
  assigned_ss_user?: string;
  limit?: number;
  offset?: number;
}

/** Khớp CompanyContactCreate (extra="forbid") — POST /companies/{company_id}/contacts. */
export interface ContactCreatePayload {
  contact_name: string;
  job_title?: string | null;
  work_email?: string | null;
  social_link?: string | null;
  phone_number?: string | null;
  found_source?: string | null;
  assigned_ss_user?: string | null;
  note?: string;
}

/**
 * Khớp CompanyContactUpdate (extra="forbid") — PATCH /contacts/{contact_id}.
 * note BẮT BUỘC nếu có field nào thực sự đổi giá trị (xem ACTION_LOG_RULES).
 */
export interface ContactUpdatePayload {
  contact_name?: string;
  job_title?: string | null;
  work_email?: string | null;
  social_link?: string | null;
  phone_number?: string | null;
  found_source?: string | null;
  contact_status?: string;
  last_contacted_date?: string | null;
  note?: string;
}

/** Khớp ContactAssignUpdate — PATCH /contacts/{contact_id}/assign. */
export interface ContactAssignPayload {
  assigned_ss_user: string | null;
  note?: string;
}

/** Khớp ContactDeleteRequest — DELETE .../contacts/{contact_id}. note BẮT BUỘC. */
export interface ContactDeletePayload {
  note: string;
}

export interface PaginatedContacts {
  total: number;
  limit: number;
  offset: number;
  items: CompanyContactWithCompany[];
}

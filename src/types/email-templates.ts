/**
 * Types cho module "Mau email lien he" -- khop api/schemas/email_templates.py
 * (Scrap_JD backend). Tab "quan-ly" o /contacts (Flask: /contacts?tab=quan-ly).
 *
 * THEM 09/2026 (ra soat #3, chat139) -- module hoan toan chua co o
 * Next.js truoc dot nay, du backend (router /email-templates) va CSS
 * (14-email-templates.css, 16-email-template-manager.css) da co san.
 */

/**
 * 4 status hop le cho "recommended_for" -- khop DUNG enum contact status
 * that (CompanyContactsManager.tsx::CONTACT_STATUS_OPTIONS + backend
 * field_validator), KHONG PHAI 4 chuoi lowercase tu doan ban dau.
 */
export type ContactStatusForTemplate = 'UNCONTACTED' | 'EMAIL_SENT' | 'RESPONDED' | 'IN_PARTNERSHIP';

/** Khop EmailTemplateOut -- created_by/updated_by la user_id tho, KHONG co ban "_name" resolve san. */
export interface EmailTemplate {
  template_id: string;
  title: string;
  description?: string | null;
  body: string;
  recommended_for: ContactStatusForTemplate[];
  display_order: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

/** Khop EmailTemplateCreate -- POST /email-templates. note KHONG bat buoc. */
export interface EmailTemplateCreatePayload {
  title: string;
  description?: string;
  body: string;
  recommended_for?: ContactStatusForTemplate[];
  display_order?: number;
  note?: string;
}

/** Khop EmailTemplateUpdate -- PATCH /email-templates/{id}. */
export interface EmailTemplateUpdatePayload {
  title?: string;
  description?: string;
  body?: string;
  recommended_for?: ContactStatusForTemplate[];
  display_order?: number;
  /** BAT BUOC neu co field nao o tren thuc su doi gia tri -- backend tu kiem tra diff, 422 neu thieu. */
  note?: string;
}

/**
 * Khop PlaceholderHelpOut -- GET /email-templates/placeholder-help.
 * `placeholders` la dict[str, str] THAT (key placeholder -> ghi chu
 * huong dan dien), KHONG PHAI mang {key,label,example} tu bia ban dau.
 */
export interface PlaceholderHelp {
  placeholders: Record<string, string>;
}

'use server';

import { getTranslations } from 'next-intl/server';
import { apiFetch } from '@/lib/api/client';
import type {
  EmailTemplate,
  EmailTemplateCreatePayload,
  EmailTemplateUpdatePayload,
  PlaceholderHelp,
} from '@/types/email-templates';

/**
 * Actions cho module "Mẫu email liên hệ" — khớp api/routers/email_templates.py.
 * Toàn bộ route yêu cầu role 'ss_team' trở lên (không phân biệt riêng
 * 'admin' như /crawl) — mọi ss_team đều thêm/sửa/xoá được.
 *
 * THÊM 09/2026 (rà soát #3, chat139) — module hoàn toàn chưa có ở
 * Next.js trước đợt này (0 action, 0 UI), dù CSS đã chuẩn bị sẵn
 * (14-email-templates.css, 16-email-template-manager.css).
 */

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const result = await apiFetch<EmailTemplate[]>('/email-templates', { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch email templates:', result.status, result.error);
    return [];
  }
  return result.data;
}

/** Bảng chú giải 5 placeholder cố định ({{TEN_CONG_TY}}, {{TEN_STAFF}}...). */
export async function getPlaceholderHelp(): Promise<PlaceholderHelp> {
  const result = await apiFetch<PlaceholderHelp>('/email-templates/placeholder-help', { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch placeholder help:', result.status, result.error);
    return { placeholders: {} };
  }
  return result.data;
}

export async function createEmailTemplate(
  data: EmailTemplateCreatePayload
): Promise<{ success: boolean; template?: EmailTemplate; error?: string }> {
  const t = await getTranslations('actions.emailTemplates');
  const result = await apiFetch<EmailTemplate>('/email-templates', {
    method: 'POST',
    body: data,
    fallbackError: t('createFailed'),
  });

  if (!result.success) {
    console.error('Error creating email template:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, template: result.data };
}

/** note BẮT BUỘC nếu có field nào thực sự đổi giá trị — backend tự kiểm tra (422 nếu thiếu). */
export async function updateEmailTemplate(
  templateId: string,
  data: EmailTemplateUpdatePayload
): Promise<{ success: boolean; template?: EmailTemplate; error?: string }> {
  const t = await getTranslations('actions.emailTemplates');
  const result = await apiFetch<EmailTemplate>(`/email-templates/${templateId}`, {
    method: 'PATCH',
    body: data,
    fallbackError: t('updateFailed'),
  });

  if (!result.success) {
    console.error('Error updating email template:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, template: result.data };
}

/** Xoá HẲN (hard delete, không phải xoá mềm) — note BẮT BUỘC. */
export async function deleteEmailTemplate(
  templateId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const t = await getTranslations('actions.emailTemplates');
  const result = await apiFetch<void>(`/email-templates/${templateId}`, {
    method: 'DELETE',
    body: { note },
    fallbackError: t('deleteFailed'),
  });

  if (!result.success) {
    console.error('Error deleting email template:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

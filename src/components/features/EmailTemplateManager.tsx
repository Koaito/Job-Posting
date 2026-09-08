'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from '@/app/actions/email-templates';
import ConfirmActionButton from '@/components/features/ConfirmActionButton';
import type { EmailTemplate, ContactStatusForTemplate, PlaceholderHelp } from '@/types/email-templates';

/**
 * Tab "Quản lý mẫu email" — /contacts?tab=quan-ly. CRUD đầy đủ cho
 * bảng email_templates, thay thế 6 mẫu trước đây hardcode cứng trong
 * public/app.js (không persist), khớp api/routers/email_templates.py.
 *
 * THÊM 09/2026 (rà soát #3, chat139) — module hoàn toàn chưa có ở
 * Next.js trước đợt này (0 action, 0 UI), dù CSS đã chuẩn bị sẵn.
 *
 * note: CREATE không bắt buộc, UPDATE/DELETE bắt buộc NẾU thực sự có
 * đổi giá trị — form ở đây LUÔN hiện ô note khi sửa (cùng pattern đã
 * áp dụng ở CompanyContactsManager: không tự đoán trước "có đổi hay
 * không", để backend là nguồn sự thật duy nhất).
 */

const STATUS_VALUES: ContactStatusForTemplate[] = ['UNCONTACTED', 'EMAIL_SENT', 'RESPONDED', 'IN_PARTNERSHIP'];

interface EmailTemplateManagerProps {
  initialTemplates: EmailTemplate[];
  placeholderHelp: PlaceholderHelp;
}

type FormMode = { kind: 'create' } | { kind: 'edit'; template: EmailTemplate } | null;

export default function EmailTemplateManager({ initialTemplates, placeholderHelp }: EmailTemplateManagerProps) {
  const router = useRouter();
  const t = useTranslations('emailTemplates');
  const tStatus = useTranslations('contactStatus');
  const statusLabel = (status: string): string =>
    (STATUS_VALUES as readonly string[]).includes(status)
      ? tStatus(status as ContactStatusForTemplate)
      : status;
  const [templates, setTemplates] = useState(initialTemplates);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [formMode, setFormMode] = useState<FormMode>(null);

  const closeForm = () => setFormMode(null);

  const handleSubmit = (formData: FormData) => {
    setError('');
    const recommended_for = STATUS_VALUES
      .filter((v) => formData.get(`status_${v}`) === 'on');
    const displayOrderRaw = String(formData.get('display_order') || '0');
    const note = String(formData.get('note') || '').trim();

    startTransition(async () => {
      if (formMode?.kind === 'edit') {
        const result = await updateEmailTemplate(formMode.template.template_id, {
          title: String(formData.get('title') || ''),
          description: String(formData.get('description') || '') || undefined,
          body: String(formData.get('body') || ''),
          recommended_for,
          display_order: Number(displayOrderRaw) || 0,
          note: note || undefined,
        });
        if (result.success && result.template) {
          setTemplates((prev) => prev.map((tpl) => (tpl.template_id === result.template!.template_id ? result.template! : tpl)));
          closeForm();
          router.refresh();
        } else {
          setError((result.error || t('errorUpdateFailed')) + (note ? '' : t('errorUpdateNoteHint')));
        }
      } else {
        const result = await createEmailTemplate({
          title: String(formData.get('title') || ''),
          description: String(formData.get('description') || '') || undefined,
          body: String(formData.get('body') || ''),
          recommended_for,
          display_order: Number(displayOrderRaw) || 0,
          note: note || undefined,
        });
        if (result.success && result.template) {
          setTemplates((prev) => [...prev, result.template!].sort((a, b) => a.display_order - b.display_order));
          closeForm();
          router.refresh();
        } else {
          setError(result.error || t('errorCreateFailed'));
        }
      }
    });
  };

  const handleDelete = async (templateId: string, note?: string) => {
    const result = await deleteEmailTemplate(templateId, note || '');
    if (result.success) {
      setTemplates((prev) => prev.filter((tpl) => tpl.template_id !== templateId));
      router.refresh();
    }
    return result;
  };

  const editing = formMode?.kind === 'edit' ? formMode.template : null;

  return (
    <div>
      <div className="et-manager-head">
        <div>
          <h4 style={{ margin: '0 0 4px' }}>{t('heading')}</h4>
          <p className="lede">{t('subheading', { placeholder: '{{...}}' })}</p>
        </div>
        {!formMode && (
          <button type="button" className="btn btn-primary" onClick={() => setFormMode({ kind: 'create' })}>
            {t('addNew')}
          </button>
        )}
      </div>

      {Object.keys(placeholderHelp.placeholders).length > 0 && (
        <details className="et-placeholder-help">
          <summary>{t('showPlaceholders')}</summary>
          <dl>
            {Object.entries(placeholderHelp.placeholders).map(([key, note]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{note}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {error && <div className="flash flash-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {formMode && (
        <form action={handleSubmit} className="form-card et-manager-form">
          <h3>{formMode.kind === 'create' ? t('formTitleCreate') : t('formTitleEdit', { title: editing?.title ?? '' })}</h3>
          <div className="form-grid">
            <label className="span-2">
              {t('titleLabel')}
              <input name="title" type="text" defaultValue={editing?.title} required disabled={isPending} />
            </label>
            <label className="span-2">
              {t('descriptionLabel')}
              <input name="description" type="text" defaultValue={editing?.description || ''} disabled={isPending} maxLength={500} />
            </label>
            <label className="span-4">
              {t('bodyLabel')}
              <textarea
                name="body"
                className="et-manager-body-textarea"
                defaultValue={editing?.body}
                required
                disabled={isPending}
              />
            </label>
            <div className="span-4 et-manager-status-field">
              <span className="et-manager-field-label">{t('recommendedForLabel')}</span>
              <div className="et-manager-status-checks">
                {STATUS_VALUES.map((value) => (
                  <label key={value} className="et-manager-status-check">
                    <input
                      type="checkbox"
                      name={`status_${value}`}
                      defaultChecked={editing?.recommended_for.includes(value)}
                      disabled={isPending}
                    />
                    {tStatus(value)}
                  </label>
                ))}
              </div>
            </div>
            <label className="span-2">
              {t('displayOrderLabel')}
              <input name="display_order" type="number" defaultValue={editing?.display_order ?? 0} disabled={isPending} />
            </label>
            <label className="span-4">
              {formMode.kind === 'edit' ? t('noteLabelEdit') : t('noteLabelCreate')}
              <textarea name="note" rows={2} disabled={isPending} />
            </label>
            <div className="form-actions span-4">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? t('saving') : formMode.kind === 'create' ? t('submitCreate') : t('submitEdit')}
              </button>
              <button type="button" className="btn" onClick={closeForm} disabled={isPending}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </form>
      )}

      {templates.length > 0 ? (
        <div className="et-manager-grid">
          {templates.map((tpl) => (
            <div key={tpl.template_id} className="et-manager-card">
              <div className="et-manager-card-head">
                <strong>{tpl.title}</strong>
                <span className="muted" style={{ fontSize: '12px' }}>{t('displayOrderPrefix', { order: tpl.display_order })}</span>
              </div>
              {tpl.description && <p className="muted" style={{ margin: 0, fontSize: '13px' }}>{tpl.description}</p>}
              {tpl.recommended_for.length > 0 && (
                <div className="et-manager-tags">
                  {tpl.recommended_for.map((s) => (
                    <span key={s} className="badge badge-info">{statusLabel(s)}</span>
                  ))}
                </div>
              )}
              <p className="et-manager-body-preview">{tpl.body.length > 220 ? `${tpl.body.slice(0, 220)}…` : tpl.body}</p>
              <div className="et-manager-card-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setFormMode({ kind: 'edit', template: tpl })}
                  disabled={isPending}
                >
                  {t('edit')}
                </button>
                <ConfirmActionButton
                  triggerLabel={t('delete')}
                  triggerClassName="btn btn-danger"
                  confirmMessage={t('confirmDeleteMessage', { title: tpl.title })}
                  showNote
                  requireNote
                  noteLabel={t('deleteNoteLabel')}
                  noteRequiredError={t('deleteNoteRequiredError')}
                  confirmButtonLabel={t('confirmDeleteButton')}
                  confirmButtonLoadingLabel={t('confirmDeleteLoading')}
                  onConfirm={(note) => handleDelete(tpl.template_id, note)}
                  onSuccess={() => {}}
                  defaultErrorMessage={t('deleteFailedError')}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state"><p>{t('emptyState')}</p></div>
      )}
    </div>
  );
}

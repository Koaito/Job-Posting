'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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

const STATUS_OPTIONS: { value: ContactStatusForTemplate; label: string }[] = [
  { value: 'UNCONTACTED', label: 'Chưa liên hệ' },
  { value: 'EMAIL_SENT', label: 'Đã gửi email' },
  { value: 'RESPONDED', label: 'Đã phản hồi' },
  { value: 'IN_PARTNERSHIP', label: 'Đang hợp tác' },
];

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

interface EmailTemplateManagerProps {
  initialTemplates: EmailTemplate[];
  placeholderHelp: PlaceholderHelp;
}

type FormMode = { kind: 'create' } | { kind: 'edit'; template: EmailTemplate } | null;

export default function EmailTemplateManager({ initialTemplates, placeholderHelp }: EmailTemplateManagerProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [formMode, setFormMode] = useState<FormMode>(null);

  const closeForm = () => setFormMode(null);

  const handleSubmit = (formData: FormData) => {
    setError('');
    const recommended_for = STATUS_OPTIONS
      .map((o) => o.value)
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
          setTemplates((prev) => prev.map((t) => (t.template_id === result.template!.template_id ? result.template! : t)));
          closeForm();
          router.refresh();
        } else {
          setError((result.error || 'Không thể cập nhật mẫu email') + (note ? '' : ' — nếu lỗi thiếu note, nhập lý do sửa rồi thử lại.'));
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
          setError(result.error || 'Không thể thêm mẫu email');
        }
      }
    });
  };

  const handleDelete = async (templateId: string, note?: string) => {
    const result = await deleteEmailTemplate(templateId, note || '');
    if (result.success) {
      setTemplates((prev) => prev.filter((t) => t.template_id !== templateId));
      router.refresh();
    }
    return result;
  };

  const editing = formMode?.kind === 'edit' ? formMode.template : null;

  return (
    <div>
      <div className="et-manager-head">
        <div>
          <h4 style={{ margin: '0 0 4px' }}>Mẫu email liên hệ</h4>
          <p className="lede">Soạn sẵn nội dung email để dùng khi liên hệ HR — dùng {'{{...}}'} cho phần tự động điền.</p>
        </div>
        {!formMode && (
          <button type="button" className="btn btn-primary" onClick={() => setFormMode({ kind: 'create' })}>
            + Thêm mẫu mới
          </button>
        )}
      </div>

      {Object.keys(placeholderHelp.placeholders).length > 0 && (
        <details className="et-placeholder-help">
          <summary>Xem danh sách placeholder có thể dùng</summary>
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
          <h3>{formMode.kind === 'create' ? 'Thêm mẫu mới' : `Sửa mẫu — ${editing?.title}`}</h3>
          <div className="form-grid">
            <label className="span-2">
              Tiêu đề *
              <input name="title" type="text" defaultValue={editing?.title} required disabled={isPending} />
            </label>
            <label className="span-2">
              Mô tả ngắn
              <input name="description" type="text" defaultValue={editing?.description || ''} disabled={isPending} maxLength={500} />
            </label>
            <label className="span-4">
              Nội dung mẫu *
              <textarea
                name="body"
                className="et-manager-body-textarea"
                defaultValue={editing?.body}
                required
                disabled={isPending}
              />
            </label>
            <div className="span-4 et-manager-status-field">
              <span className="et-manager-field-label">Gợi ý dùng cho trạng thái</span>
              <div className="et-manager-status-checks">
                {STATUS_OPTIONS.map((o) => (
                  <label key={o.value} className="et-manager-status-check">
                    <input
                      type="checkbox"
                      name={`status_${o.value}`}
                      defaultChecked={editing?.recommended_for.includes(o.value)}
                      disabled={isPending}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="span-2">
              Thứ tự hiển thị
              <input name="display_order" type="number" defaultValue={editing?.display_order ?? 0} disabled={isPending} />
            </label>
            <label className="span-4">
              {formMode.kind === 'edit' ? 'Lý do sửa (bắt buộc nếu có thay đổi)' : 'Ghi chú (tuỳ chọn)'}
              <textarea name="note" rows={2} disabled={isPending} />
            </label>
            <div className="form-actions span-4">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? 'Đang lưu...' : formMode.kind === 'create' ? 'Thêm mẫu' : 'Lưu thay đổi'}
              </button>
              <button type="button" className="btn" onClick={closeForm} disabled={isPending}>
                Huỷ
              </button>
            </div>
          </div>
        </form>
      )}

      {templates.length > 0 ? (
        <div className="et-manager-grid">
          {templates.map((t) => (
            <div key={t.template_id} className="et-manager-card">
              <div className="et-manager-card-head">
                <strong>{t.title}</strong>
                <span className="muted" style={{ fontSize: '12px' }}>Thứ tự {t.display_order}</span>
              </div>
              {t.description && <p className="muted" style={{ margin: 0, fontSize: '13px' }}>{t.description}</p>}
              {t.recommended_for.length > 0 && (
                <div className="et-manager-tags">
                  {t.recommended_for.map((s) => (
                    <span key={s} className="badge badge-info">{statusLabel(s)}</span>
                  ))}
                </div>
              )}
              <p className="et-manager-body-preview">{t.body.length > 220 ? `${t.body.slice(0, 220)}…` : t.body}</p>
              <div className="et-manager-card-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setFormMode({ kind: 'edit', template: t })}
                  disabled={isPending}
                >
                  Sửa
                </button>
                <ConfirmActionButton
                  triggerLabel="Xoá"
                  triggerClassName="btn btn-danger"
                  confirmMessage={`Xoá hẳn mẫu "${t.title}"? Không thể hoàn tác (xoá hẳn, không phải xoá mềm).`}
                  showNote
                  requireNote
                  noteLabel="Lý do xoá"
                  noteRequiredError="Vui lòng nhập lý do xoá."
                  confirmButtonLabel="Xoá mẫu"
                  confirmButtonLoadingLabel="Đang xoá..."
                  onConfirm={(note) => handleDelete(t.template_id, note)}
                  onSuccess={() => {}}
                  defaultErrorMessage="Không thể xoá mẫu email"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state"><p>Chưa có mẫu email nào — bấm &quot;Thêm mẫu mới&quot; để bắt đầu.</p></div>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createContact, updateContact, assignContact, deleteContact } from '@/app/actions/contacts';
import type { CompanyContact } from '@/types/contacts';
import { useToast } from '@/components/ui/toast/ToastProvider';

/**
 * Quản lý liên hệ HR của 1 công ty — dùng trong company detail page
 * ("Người liên hệ HR", tương ứng Flask templates/company_detail.html +
 * _contact_form.html/_contact_list.html).
 *
 * note BẮT BUỘC ở backend cho update/assign/delete NẾU giá trị thực sự
 * đổi (422/thiếu note không lưu) — form ở đây LUÔN hiện ô note khi sửa/
 * gán/xoá, không cố đoán trước "có đổi hay không" (đơn giản hơn, để
 * backend là nguồn sự thật duy nhất về việc có cần note không).
 *
 * B.1 Polish (09/2026) — tách state lỗi TRƯỚC ĐÂY dùng chung 1 `error`:
 * - Thêm liên hệ mới (`handleCreate`) là FORM SUBMIT nhiều field → giữ
 *   `formError` inline, không đổi sang toast (giống CompanyForm.tsx).
 * - Đổi trạng thái/gỡ gán/xoá (`handleUpdateStatus`/`handleUnassign`/
 *   `handleDelete`) là hành động bấm-nút-xong-liền ngay trên 1 dòng
 *   bảng (kể cả lỗi "thiếu note" — chỉ 1 câu đơn giản, không phải nhiều
 *   field cần soi lại, giống ghi chú `cvFileRequired` ở
 *   JobApplyActions.tsx) → đổi sang `toast.error()`.
 */

const CONTACT_STATUS_VALUES = ['UNCONTACTED', 'EMAIL_SENT', 'RESPONDED', 'IN_PARTNERSHIP'] as const;

interface CompanyContactsManagerProps {
  companyId: string;
  initialContacts: CompanyContact[];
}

export default function CompanyContactsManager({ companyId, initialContacts }: CompanyContactsManagerProps) {
  const router = useRouter();
  const t = useTranslations('companyContacts');
  const tStatus = useTranslations('contactStatus');
  const statusLabel = (status: string): string =>
    (CONTACT_STATUS_VALUES as readonly string[]).includes(status)
      ? tStatus(status as (typeof CONTACT_STATUS_VALUES)[number])
      : status;
  const toast = useToast();
  const [contacts, setContacts] = useState(initialContacts);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteNote, setDeleteNote] = useState('');

  const handleCreate = (formData: FormData) => {
    setFormError('');
    startTransition(async () => {
      const result = await createContact(companyId, {
        contact_name: String(formData.get('contact_name') || ''),
        job_title: String(formData.get('job_title') || '') || null,
        work_email: String(formData.get('work_email') || '') || null,
        phone_number: String(formData.get('phone_number') || '') || null,
        social_link: String(formData.get('social_link') || '') || null,
        found_source: String(formData.get('found_source') || '') || null,
      });

      if (result.success && result.contact) {
        setContacts((prev) => [...prev, result.contact!]);
        setShowCreateForm(false);
        router.refresh();
      } else {
        setFormError(result.error || t('errorAddFailed'));
      }
    });
  };

  const handleUpdateStatus = (contactId: string, status: string) => {
    startTransition(async () => {
      const result = await updateContact(companyId, contactId, {
        contact_status: status,
        note: editNote.trim() || undefined,
      });
      if (result.success && result.contact) {
        setContacts((prev) => prev.map((c) => (c.contact_id === contactId ? result.contact! : c)));
        setEditingId(null);
        setEditNote('');
      } else {
        toast.error(
          (result.error || '') + (result.error?.includes('note') ? '' : t('errorUpdateStatusNoteHint'))
        );
      }
    });
  };

  const handleUnassign = (contactId: string) => {
    if (!editNote.trim()) {
      toast.error(t('errorUnassignNoteRequired'));
      return;
    }
    startTransition(async () => {
      const result = await assignContact(companyId, contactId, {
        assigned_ss_user: null,
        note: editNote.trim(),
      });
      if (result.success && result.contact) {
        setContacts((prev) => prev.map((c) => (c.contact_id === contactId ? result.contact! : c)));
        setEditingId(null);
        setEditNote('');
      } else {
        toast.error(result.error || t('errorUnassignFailed'));
      }
    });
  };

  const handleDelete = (contactId: string) => {
    if (!deleteNote.trim()) {
      toast.error(t('errorDeleteNoteRequired'));
      return;
    }
    startTransition(async () => {
      const result = await deleteContact(companyId, contactId, { note: deleteNote.trim() });
      if (result.success) {
        setContacts((prev) => prev.filter((c) => c.contact_id !== contactId));
        setDeletingId(null);
        setDeleteNote('');
        router.refresh();
      } else {
        toast.error(result.error || t('errorDeleteFailed'));
      }
    });
  };

  return (
    <div>
      {formError && <div className="flash flash-error" style={{ marginBottom: '16px' }}>{formError}</div>}

      <div style={{ marginBottom: '18px' }}>
        {!showCreateForm ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            {t('addContact')}
          </button>
        ) : (
          <form
            action={handleCreate}
            className="card"
            style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="contact_name">{t('nameLabel')}</label>
              <input id="contact_name" name="contact_name" type="text" required disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="job_title">{t('jobTitleLabel')}</label>
              <input id="job_title" name="job_title" type="text" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="work_email">{t('emailLabel')}</label>
              <input id="work_email" name="work_email" type="email" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="phone_number">{t('phoneLabel')}</label>
              <input id="phone_number" name="phone_number" type="text" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="social_link">{t('socialLinkLabel')}</label>
              <input id="social_link" name="social_link" type="text" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="found_source">{t('foundSourceLabel')}</label>
              <input id="found_source" name="found_source" type="text" disabled={isPending} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? t('saving') : t('add')}
            </button>
            <button type="button" className="btn" onClick={() => setShowCreateForm(false)} disabled={isPending}>
              {t('cancel')}
            </button>
          </form>
        )}
      </div>

      {contacts.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colName')}</th>
                <th>{t('colJobTitle')}</th>
                <th>{t('colEmailPhone')}</th>
                <th>{t('colStatus')}</th>
                <th>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.contact_id}>
                  <td>
                    <strong>{c.contact_name}</strong>
                    {c.social_link && (
                      <div>
                        <a href={c.social_link} target="_blank" rel="noopener noreferrer" className="btn btn-text">
                          {t('linkOpen')}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="muted">{c.job_title || '—'}</td>
                  <td className="muted">
                    {c.work_email || '—'}
                    {c.phone_number && <div>{c.phone_number}</div>}
                  </td>
                  <td>
                    {editingId === c.contact_id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                        <select
                          defaultValue={c.contact_status}
                          disabled={isPending}
                          onChange={(e) => handleUpdateStatus(c.contact_id, e.target.value)}
                        >
                          {CONTACT_STATUS_VALUES.map((value) => (
                            <option key={value} value={value}>{tStatus(value)}</option>
                          ))}
                        </select>
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder={t('editNotePlaceholder')}
                          rows={2}
                          disabled={isPending}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-text"
                            disabled={isPending}
                            onClick={() => handleUnassign(c.contact_id)}
                          >
                            {t('unassign')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-text"
                            onClick={() => { setEditingId(null); setEditNote(''); }}
                          >
                            {t('close')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="status-chip">{statusLabel(c.contact_status)}</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    {deletingId === c.contact_id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                        <textarea
                          value={deleteNote}
                          onChange={(e) => setDeleteNote(e.target.value)}
                          placeholder={t('deleteNotePlaceholder')}
                          rows={2}
                          disabled={isPending}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={isPending}
                            onClick={() => handleDelete(c.contact_id)}
                          >
                            {t('confirmDelete')}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => { setDeletingId(null); setDeleteNote(''); }}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-text"
                          onClick={() => { setEditingId(c.contact_id); setEditNote(''); }}
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-text"
                          onClick={() => { setDeletingId(c.contact_id); setDeleteNote(''); }}
                        >
                          {t('delete')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">{t('emptyState')}</div>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createContact, updateContact, assignContact, deleteContact } from '@/app/actions/contacts';
import type { CompanyContact } from '@/types/contacts';

/**
 * Quản lý liên hệ HR của 1 công ty — dùng trong company detail page
 * ("Người liên hệ HR", tương ứng Flask templates/company_detail.html +
 * _contact_form.html/_contact_list.html).
 *
 * note BẮT BUỘC ở backend cho update/assign/delete NẾU giá trị thực sự
 * đổi (422/thiếu note không lưu) — form ở đây LUÔN hiện ô note khi sửa/
 * gán/xoá, không cố đoán trước "có đổi hay không" (đơn giản hơn, để
 * backend là nguồn sự thật duy nhất về việc có cần note không).
 */

const CONTACT_STATUS_OPTIONS = [
  { value: 'UNCONTACTED', label: 'Chưa liên hệ' },
  { value: 'EMAIL_SENT', label: 'Đã gửi email' },
  { value: 'RESPONDED', label: 'Đã phản hồi' },
  { value: 'IN_PARTNERSHIP', label: 'Đang hợp tác' },
];

function statusLabel(status: string): string {
  return CONTACT_STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

interface CompanyContactsManagerProps {
  companyId: string;
  initialContacts: CompanyContact[];
}

export default function CompanyContactsManager({ companyId, initialContacts }: CompanyContactsManagerProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteNote, setDeleteNote] = useState('');

  const handleCreate = (formData: FormData) => {
    setError('');
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
        setError(result.error || 'Không thể thêm liên hệ');
      }
    });
  };

  const handleUpdateStatus = (contactId: string, status: string) => {
    setError('');
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
        setError(
          (result.error || '') + (result.error?.includes('note') ? '' : ' — nếu lỗi thiếu note, nhập lý do sửa ở ô bên cạnh rồi thử lại.')
        );
      }
    });
  };

  const handleUnassign = (contactId: string) => {
    if (!editNote.trim()) {
      setError('Vui lòng nhập lý do bỏ gán ở ô note.');
      return;
    }
    setError('');
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
        setError(result.error || 'Không thể bỏ gán');
      }
    });
  };

  const handleDelete = (contactId: string) => {
    if (!deleteNote.trim()) {
      setError('Vui lòng nhập lý do xoá.');
      return;
    }
    setError('');
    startTransition(async () => {
      const result = await deleteContact(companyId, contactId, { note: deleteNote.trim() });
      if (result.success) {
        setContacts((prev) => prev.filter((c) => c.contact_id !== contactId));
        setDeletingId(null);
        setDeleteNote('');
        router.refresh();
      } else {
        setError(result.error || 'Không thể xoá liên hệ');
      }
    });
  };

  return (
    <div>
      {error && <div className="flash flash-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div style={{ marginBottom: '18px' }}>
        {!showCreateForm ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            + Thêm liên hệ HR
          </button>
        ) : (
          <form
            action={handleCreate}
            className="card"
            style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="contact_name">Tên *</label>
              <input id="contact_name" name="contact_name" type="text" required disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="job_title">Chức vụ</label>
              <input id="job_title" name="job_title" type="text" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="work_email">Email</label>
              <input id="work_email" name="work_email" type="email" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="phone_number">SĐT</label>
              <input id="phone_number" name="phone_number" type="text" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="social_link">Link mạng xã hội</label>
              <input id="social_link" name="social_link" type="text" disabled={isPending} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="found_source">Nguồn tìm thấy</label>
              <input id="found_source" name="found_source" type="text" disabled={isPending} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Đang lưu...' : 'Thêm'}
            </button>
            <button type="button" className="btn" onClick={() => setShowCreateForm(false)} disabled={isPending}>
              Huỷ
            </button>
          </form>
        )}
      </div>

      {contacts.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Chức vụ</th>
                <th>Email / SĐT</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
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
                          Link ↗
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
                          {CONTACT_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Lý do sửa (bắt buộc nếu đổi giá trị)..."
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
                            Bỏ gán phụ trách
                          </button>
                          <button
                            type="button"
                            className="btn btn-text"
                            onClick={() => { setEditingId(null); setEditNote(''); }}
                          >
                            Đóng
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
                          placeholder="Lý do xoá — bắt buộc..."
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
                            Xác nhận xoá
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => { setDeletingId(null); setDeleteNote(''); }}
                          >
                            Huỷ
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
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-text"
                          onClick={() => { setDeletingId(c.contact_id); setDeleteNote(''); }}
                        >
                          Xoá
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
        <div className="empty-state">Chưa có liên hệ HR nào cho công ty này.</div>
      )}
    </div>
  );
}

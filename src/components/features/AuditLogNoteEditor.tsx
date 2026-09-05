'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateAuditLogNote } from '@/app/actions/audit';

/**
 * Sửa note của 1 audit log — CHỈ actor_id GỐC của log mới được sửa
 * (backend trả 403 nếu người khác gọi, kể cả admin — quyết định thiết
 * kế đã chốt: note phản ánh đúng lời giải thích của CHÍNH người làm).
 * FE không tự ẩn nút với người không phải actor gốc (currentUserId có
 * thể không khớp actor_id vì actor_name chỉ join sống, không phải
 * check định danh) — để backend là nguồn sự thật duy nhất, hiện lỗi
 * 403 rõ ràng nếu bấm nhầm thay vì đoán trước UI.
 */
interface AuditLogNoteEditorProps {
  logId: string;
  currentNote: string | null | undefined;
  noteRequired: boolean;
}

export default function AuditLogNoteEditor({ logId, currentNote, noteRequired }: AuditLogNoteEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(currentNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!note.trim()) {
      setError('Note không được để trống.');
      return;
    }
    setSaving(true);
    setError(null);

    const result = await updateAuditLogNote(logId, note.trim());

    setSaving(false);
    if (result.success) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error || 'Không thể cập nhật note');
    }
  };

  if (!editing) {
    return (
      <div>
        {currentNote ? (
          <div className="note-text">{currentNote}</div>
        ) : (
          <span className="muted">{noteRequired ? '— (thiếu note?)' : '— chưa có note'}</span>
        )}
        <button className="btn btn-text" onClick={() => setEditing(true)}>
          Sửa
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Nội dung note..."
        disabled={saving}
        style={{ width: '100%' }}
      />
      {error && <p style={{ color: '#B23A22', fontSize: '12px', margin: '4px 0' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => { setEditing(false); setNote(currentNote || ''); setError(null); }}
          disabled={saving}
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

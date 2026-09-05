'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from '@/app/actions/auth';
import type { User } from '@/types/auth';

/**
 * Form đổi full_name (mọi role) + phone/track (chỉ học viên) — khớp
 * profile.index() (POST) bên Flask gốc, gọi PATCH /auth/me thật.
 *
 * isStudent quyết định có hiện input phone/track hay không — đúng
 * comment update_me() backend: 2 field này "chỉ có ý nghĩa với
 * role='user'", backend tự ép về None cho staff dù FE có gửi gì lên
 * đi nữa. Ẩn hẳn input với staff (không chỉ disable) vì hiện input vô
 * nghĩa gây hiểu lầm "sao staff không sửa được".
 */
export default function ProfileOverviewForm({ user }: { user: User }) {
  const router = useRouter();
  const isStudent = user.role === 'user';

  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || '');
  const [track, setTrack] = useState(user.track || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }

    setLoading(true);
    try {
      const result = await updateProfile({
        full_name: fullName.trim(),
        phone: isStudent ? phone.trim() : undefined,
        track: isStudent ? track.trim() : undefined,
      });

      if (result.success) {
        setSuccess('Đã cập nhật thông tin cá nhân.');
        // Sidebar đọc user_data từ cookie (đã được updateProfile() ghi
        // lại) — router.refresh() để re-render server components (vd
        // Sidebar) với dữ liệu mới ngay, không cần F5 tay.
        router.refresh();
      } else {
        setError(result.error || 'Không thể cập nhật thông tin.');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="flash flash-error">{error}</div>}
      {success && <div className="flash flash-success">{success}</div>}

      <label>
        Họ và tên
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={loading}
        />
      </label>

      {isStudent && (
        <>
          <label>
            Số điện thoại
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Không bắt buộc"
              disabled={loading}
            />
          </label>

          <label>
            Lớp / Track
            <input
              type="text"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              placeholder="Không bắt buộc"
              disabled={loading}
            />
          </label>
        </>
      )}

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
    </form>
  );
}

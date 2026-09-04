'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/app/actions/auth';

/**
 * Form đổi mật khẩu tại /profile/security — khớp profile.security()
 * bên Flask gốc. Tái dùng changePassword() đã có sẵn (viết cho trang
 * /change-password bắt buộc lúc must_change_password=true), giờ cũng
 * dùng cho đổi mật khẩu TỰ NGUYỆN từ trang cá nhân — cùng 1 hàm, cùng
 * hợp đồng backend (ChangePasswordRequest tự quyết định có bắt buộc
 * old_password hay không dựa theo must_change_password hiện tại).
 *
 * Đổi mật khẩu thành công -> backend luôn thu hồi hết token của phiên
 * này (xem docstring changePassword()) -> PHẢI điều hướng về /login,
 * không có cách nào "ở lại trang" sau khi đổi thành công.
 */
export default function ProfileSecurityForm({ mustChangePassword }: { mustChangePassword: boolean }) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }
    if (!mustChangePassword && !oldPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(newPassword, oldPassword || undefined);

      if (result.success) {
        router.push('/login');
        router.refresh();
      } else {
        setError(result.error || 'Đổi mật khẩu thất bại.');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {error && <div className="flash flash-error">{error}</div>}

      <label>
        Mật khẩu hiện tại{mustChangePassword ? ' (bỏ trống nếu là mật khẩu tạm)' : ''}
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          autoComplete="current-password"
        />
      </label>

      <label>
        Mật khẩu mới
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Tối thiểu 8 ký tự"
          required
          minLength={8}
          disabled={loading}
          autoComplete="new-password"
        />
      </label>

      <label>
        Xác nhận mật khẩu mới
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Nhập lại mật khẩu mới"
          required
          minLength={8}
          disabled={loading}
          autoComplete="new-password"
        />
      </label>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}

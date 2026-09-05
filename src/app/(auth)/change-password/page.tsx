'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/app/actions/auth';

/**
 * Trang đổi mật khẩu bắt buộc — (audit 09/2026, bug #3).
 *
 * Chủ yếu phục vụ user must_change_password=true (mật khẩu tạm do
 * admin cấp, xem (dashboard)/layout.tsx redirect vào đây) — nhưng cũng
 * dùng được cho đổi mật khẩu tự nguyện bình thường (route KHÔNG tự biết
 * must_change_password hiện tại của user, backend tự quyết định có bắt
 * buộc old_password hay không, xem ChangePasswordRequest/
 * change_password() trong auth_session.py). Vì vậy luôn hiển thị ô mật
 * khẩu cũ — bỏ trống nếu không có (trường hợp mật khẩu tạm), backend
 * tự bỏ qua validate old_password nếu must_change_password đang true.
 *
 * Nằm trong route group (auth)/ (KHÔNG phải (dashboard)/) để tránh
 * redirect loop: (dashboard)/layout.tsx redirect vào đây khi
 * must_change_password=true, nên trang này không được nằm trong cùng
 * route group đó.
 *
 * LƯU Ý: bản Flask gốc KHÔNG có trang auth-shell riêng cho route này —
 * /change-password bên đó chỉ redirect sang profile.security (form đổi
 * mật khẩu nằm trong trang cá nhân, xem 08/2026 note ở blueprints/
 * auth.py). Trang Next.js này là 1 route THẬT SỰ mới (không có trong
 * Flask) để tránh redirect loop nêu trên — vẫn giữ nguyên, chỉ sửa lại
 * đúng class CSS theo đúng bộ .auth-shell/.auth-card đã dùng chung cho
 * mọi trang auth khác (auth-wrapper/auth-header/form-group cũ không
 * tồn tại trong bất kỳ file CSS nào).
 */
export default function ChangePasswordPage() {
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

    setLoading(true);

    try {
      const result = await changePassword(newPassword, oldPassword || undefined);

      if (result.success) {
        // Backend đã thu hồi toàn bộ token của phiên này khi đổi mật
        // khẩu thành công (xem docstring changePassword() ở actions/
        // auth.ts) — bắt buộc đăng nhập lại bằng mật khẩu mới.
        router.push('/login');
        router.refresh();
      } else {
        setError(result.error || 'Đổi mật khẩu thất bại');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">Career Hub / Tài khoản</span>
        <h1>Đổi mật khẩu</h1>
        <p className="lede">
          Tài khoản của bạn đang dùng mật khẩu tạm — vui lòng đặt mật khẩu mới trước khi tiếp tục
          sử dụng hệ thống.
        </p>

        {error && <div className="flash flash-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Mật khẩu hiện tại (bỏ trống nếu là mật khẩu tạm)
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
      </div>
    </div>
  );
}

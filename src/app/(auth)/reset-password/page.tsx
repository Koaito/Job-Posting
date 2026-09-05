'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/app/actions/auth';

/**
 * Trang đặt lại mật khẩu — mới 09/2026.
 *
 * Link email trỏ về đúng đây: FRONTEND_BASE_URL + "/reset-password?token=..."
 * (xem api/email_service.py::send_password_reset_email — reset_url).
 * Token THÔ nằm trên query string, gửi thẳng lên POST /auth/reset-password,
 * dùng đúng 1 lần, hết hạn sau 1h.
 *
 * BUG FIX phòng ngừa: useSearchParams() bắt buộc phải nằm trong 1
 * <Suspense> boundary khi build static (next build sẽ fail nếu không —
 * xem lỗi thật "useSearchParams() should be wrapped in a suspense
 * boundary" nếu bỏ Suspense ở đây), nên tách phần đọc token ra 1
 * component con, default export chỉ lo bọc Suspense.
 *
 * FIX (đối chiếu templates/reset_password.html + 02-auth.css thật):
 * auth-wrapper/auth-header/form-group/auth-footer không tồn tại trong
 * CSS — đổi lại auth-shell (chỉ 1 lớp ngoài cùng, .auth-card nằm bên
 * trong từng nhánh trạng thái)/eyebrow/lede/label bọc input/auth-foot.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="auth-card">
        <span className="eyebrow">Career Hub / Tài khoản</span>
        <h1>Link không hợp lệ</h1>
        <p className="lede">
          Thiếu token trong đường dẫn — vui lòng dùng đúng link trong email, hoặc xin link mới.
        </p>
        <p className="auth-foot">
          <Link href="/forgot-password">Xin link đặt lại mật khẩu mới</Link>
        </p>
      </div>
    );
  }

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
      const result = await resetPassword(token, newPassword);
      if (result.success) {
        setMessage(
          result.message || 'Đặt lại mật khẩu thành công — vui lòng đăng nhập lại bằng mật khẩu mới.'
        );
      } else {
        setError(result.error || 'Đặt lại mật khẩu thất bại — link có thể đã hết hạn hoặc đã được dùng.');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div className="auth-card">
        <span className="eyebrow">Career Hub / Tài khoản</span>
        <h1>Thành công</h1>
        <div className="flash flash-success">{message}</div>
        <p className="auth-foot">
          <Link href="/login">Về trang đăng nhập</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <span className="eyebrow">Career Hub / Tài khoản</span>
      <h1>Đặt lại mật khẩu</h1>
      <p className="lede">Nhập mật khẩu mới cho tài khoản của bạn.</p>

      {error && <div className="flash flash-error">{error}</div>}

      <form onSubmit={handleSubmit}>
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
            autoFocus
          />
        </label>

        <label>
          Nhập lại mật khẩu mới
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            autoComplete="new-password"
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-shell">
      <Suspense fallback={<div className="auth-card">Đang tải...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

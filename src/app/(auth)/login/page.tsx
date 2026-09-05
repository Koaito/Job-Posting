'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';

/**
 * FIX (đối chiếu templates/login.html + 02-auth.css thật, 09/2026):
 * class cũ dùng ở đây (auth-wrapper/auth-header/form-group/auth-footer/
 * link-muted/separator/auth-form) KHÔNG tồn tại trong bất kỳ file CSS
 * nào — trang render như div/label/input trơn không style (mất
 * max-width, spacing, border...). Đổi đúng lại theo cấu trúc CSS gốc:
 *   .auth-shell > .auth-card > (span.eyebrow, h1, p.lede, form, p.auth-foot)
 *   .auth-card label bọc TRỰC TIẾP text + input (không qua form-group)
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email.trim().toLowerCase(), password);

      if (result.success) {
        // BUG FIX: backend không trả field "is_staff" (luôn undefined) —
        // phải tự suy ra staff/admin từ "role" thật, nếu không mọi
        // admin/ss_team login xong đều bị đá về /jobs như student.
        if (isStaffRole(result.user?.role)) {
          router.push('/dashboard');
        } else {
          router.push('/jobs');
        }
        router.refresh(); // Refresh to update auth state
      } else {
        setError(result.error || 'Đăng nhập thất bại');
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
        <span className="eyebrow">Career Hub / Học viên</span>
        <h1>Đăng nhập</h1>
        <p className="lede">
          Đăng nhập để lưu job yêu thích và quản lý danh sách ứng tuyển của bạn.
        </p>

        {error && <div className="flash flash-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              disabled={loading}
              autoComplete="email"
              autoFocus
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="auth-foot">
          <Link href="/forgot-password">Quên mật khẩu?</Link>
        </p>
        <p className="auth-foot">
          Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link>
        </p>

        <div className="demo-hint">
          Tài khoản team SS do admin tạo sẵn phía backend — dùng chung form đăng nhập này.
        </div>
      </div>
    </div>
  );
}

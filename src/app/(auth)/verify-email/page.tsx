import Link from 'next/link';

/**
 * Trang đích sau khi backend xử lý link xác thực email — mới 09/2026.
 *
 * GET /auth/verify-email?token=... (người dùng bấm thẳng từ email,
 * KHÔNG qua frontend) tự redirect 302 về đúng đây kèm
 * ?status=success|expired|invalid (xem docstring verify_email() ở
 * api/routers/auth_registration.py — route đó cố tình KHÔNG tự vẽ HTML,
 * để frontend hiển thị đúng theme).
 */

interface SearchParams {
  status?: string;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;

  const content = {
    success: {
      title: 'Xác thực email thành công',
      message: 'Tài khoản của bạn đã sẵn sàng — hãy đăng nhập để bắt đầu sử dụng.',
      tone: 'flash-success',
    },
    expired: {
      title: 'Link xác thực đã hết hạn',
      message: 'Link xác thực chỉ có hiệu lực 24 giờ. Vui lòng đăng nhập để xin gửi lại email xác thực mới.',
      tone: 'flash-error',
    },
    invalid: {
      title: 'Link xác thực không hợp lệ',
      message: 'Link này không đúng hoặc đã được sử dụng. Vui lòng kiểm tra lại email hoặc đăng ký lại.',
      tone: 'flash-error',
    },
  }[status || ''] || {
    title: 'Xác thực email',
    message: 'Không có thông tin trạng thái xác thực — vui lòng dùng đúng link trong email.',
    tone: 'flash-error',
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>{content.title}</h1>
        </div>
        <div className={`flash ${content.tone}`}>{content.message}</div>
        <div className="auth-footer">
          <Link href="/login" className="link-muted">Về trang đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}

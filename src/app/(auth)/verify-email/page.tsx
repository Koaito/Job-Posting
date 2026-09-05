import Link from 'next/link';

/**
 * Trang đích sau khi backend xử lý link xác thực email — mới 09/2026.
 *
 * GET /auth/verify-email?token=... (người dùng bấm thẳng từ email,
 * KHÔNG qua frontend) tự redirect 302 về đúng đây kèm
 * ?status=success|expired|invalid (xem docstring verify_email() ở
 * api/routers/auth_registration.py — route đó cố tình KHÔNG tự vẽ HTML,
 * để frontend hiển thị đúng theme).
 *
 * FIX (đối chiếu templates/verify_email.html + 02-auth.css thật):
 *   - auth-wrapper/auth-header/auth-footer không tồn tại trong CSS —
 *     đổi lại auth-shell/eyebrow/auth-foot.
 *   - Thiếu hẳn icon tròn trạng thái (.verify-icon + biến thể
 *     success/warn/error) — bản gốc luôn có, đã bổ sung lại.
 *   - Bản gốc dùng <p class="lede"> cho nội dung, KHÔNG bọc trong flash
 *     box màu — đổi lại cho đúng, tránh 1 trang chỉ để thông báo trạng
 *     thái mà nhìn như flash cảnh báo lỗi.
 *
 * LƯU Ý: nhánh "expired" ở bản gốc có kèm 1 form "Gửi lại email xác
 * thực" ngay tại chỗ (POST /auth/resend-verification) — bản Next.js
 * này CHƯA có form đó (chỉ dẫn link về /login), đây là thiếu 1 phần
 * CHỨC NĂNG so với bản gốc, không phải lỗi CSS — cần bổ sung riêng
 * nếu muốn khớp 100% hành vi.
 */

interface SearchParams {
  status?: string;
}

const STATUS_CONTENT = {
  success: {
    icon: '✓',
    iconClass: 'verify-icon-success',
    title: 'Xác thực thành công',
    message: 'Tài khoản của bạn đã được kích hoạt — bây giờ có thể đăng nhập để lưu job yêu thích và ứng tuyển.',
  },
  expired: {
    icon: '!',
    iconClass: 'verify-icon-warn',
    title: 'Liên kết đã hết hạn',
    message: 'Link xác thực chỉ có hiệu lực 24 giờ. Vui lòng đăng nhập để xin gửi lại email xác thực mới.',
  },
  invalid: {
    icon: '✕',
    iconClass: 'verify-icon-error',
    title: 'Liên kết không hợp lệ',
    message: 'Link này không đúng hoặc đã được sử dụng. Vui lòng kiểm tra lại email hoặc đăng ký lại.',
  },
} as const;

const DEFAULT_CONTENT = {
  icon: '✕',
  iconClass: 'verify-icon-error',
  title: 'Xác thực email',
  message: 'Không có thông tin trạng thái xác thực — vui lòng dùng đúng link trong email.',
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;
  const content = STATUS_CONTENT[status as keyof typeof STATUS_CONTENT] || DEFAULT_CONTENT;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">Career Hub / Tài khoản</span>
        <div className={`verify-icon ${content.iconClass}`}>{content.icon}</div>
        <h1>{content.title}</h1>
        <p className="lede">{content.message}</p>

        <p className="auth-foot">
          Đã xác thực rồi? <Link href="/login">Quay lại đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

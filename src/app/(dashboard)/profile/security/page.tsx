import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import ProfileSubnav from '@/components/features/ProfileSubnav';
import ProfileSecurityForm from '@/components/features/ProfileSecurityForm';

/**
 * Trang cá nhân — Bảo mật (đổi mật khẩu). Khớp profile.security()
 * bên Flask gốc + templates/profile_security.html. THAY THẾ hẳn logic
 * cũ ở /change-password về mặt "đổi mật khẩu tự nguyện" (route
 * /change-password vẫn giữ nguyên, chỉ phục vụ trường hợp
 * must_change_password=true bắt buộc đổi trước khi vào app — xem
 * (dashboard)/layout.tsx).
 *
 * (dashboard)/layout.tsx đã đảm bảo user luôn khác null + đã đổi xong
 * mật khẩu tạm (must_change_password=false) tại đây — nếu còn true thì
 * layout đã redirect sang /change-password trước khi tới trang này,
 * nên mustChangePassword truyền xuống form dưới đây trong thực tế luôn
 * là false. Vẫn truyền đúng giá trị thật (không hardcode false) để
 * form xử lý đúng nếu luồng redirect ở layout thay đổi sau này.
 *
 * BUG FIX (build): cùng lỗi đã sửa ở /profile/page.tsx — `user!`
 * (non-null assertion) làm `next build` crash lúc prerender static
 * shell (cookies() chưa sẵn sàng nên getCurrentUser() trả về null thật
 * sự tại thời điểm đó). Tự check + redirect thay vì tin layout đã
 * chặn, giống hệt cách đã sửa ở trang overview.
 */
export default async function ProfileSecurityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="auth-shell">
      <div className="auth-card profile-card">
        <h1>Trang cá nhân</h1>
        <p className="lede">Đổi mật khẩu đăng nhập của bạn.</p>

        <ProfileSubnav active="security" />

        <ProfileSecurityForm mustChangePassword={user.must_change_password} />
      </div>
    </div>
  );
}

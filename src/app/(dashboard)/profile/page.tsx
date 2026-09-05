import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { roleLabel, isStaffRole } from '@/lib/auth/roles';
import ProfileSubnav from '@/components/features/ProfileSubnav';
import ProfileOverviewForm from '@/components/features/ProfileOverviewForm';

/**
 * Trang cá nhân — Thông tin chung. Khớp profile.index() (GET) bên
 * Flask gốc (blueprints/profile.py) + templates/profile_overview.html.
 *
 * BUG FIX (09/2026): trước đây toàn trang chỉ là placeholder
 * "🚧 Chức năng đổi mật khẩu và cập nhật thông tin đang được phát
 * triển" — dù backend (PATCH /auth/me, POST /auth/change-password) đã
 * có sẵn từ lâu, chỉ chưa có trang thật gọi tới. Dùng đúng CSS đã
 * chuẩn bị sẵn (.auth-shell, .profile-card, .profile-subnav,
 * .profile-info-grid — public/css/02-auth.css) thay vì .page-container/
 * .profile-section/.info-grid không tồn tại của bản cũ.
 *
 * BUG FIX (build): (dashboard)/layout.tsx redirect /login nếu chưa
 * đăng nhập ở request THẬT, nhưng lúc `next build` cố prerender trang
 * này thành static shell, cookies() chưa sẵn sàng nên getCurrentUser()
 * trả về null thật sự — dùng `user!` (non-null assertion) làm build
 * crash hẳn ("Cannot read properties of null"), khác các trang khác
 * (vd /companies) không dùng `!` nên tự chịu được null lúc prerender,
 * để Next.js tự nhận route là dynamic rồi bỏ qua static generation.
 * Tự check + redirect ở đây thay vì tin layout đã chặn — vừa hết lỗi
 * build, vừa không còn 1 non-null assertion nào có thể crash runtime
 * nếu logic layout đổi sau này.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const isStudent = user.role === 'user';

  return (
    <div className="auth-shell">
      <div className="auth-card profile-card">
        <h1>Trang cá nhân</h1>
        <p className="lede">Xem và cập nhật thông tin tài khoản của bạn.</p>

        <ProfileSubnav active="overview" isStudent={isStudent} isStaff={isStaffRole(user.role)} />

        <dl className="profile-info-grid">
          <div>
            <dt className="profile-info-label">Email</dt>
            <dd className="profile-info-value">{user.email}</dd>
          </div>
          <div>
            <dt className="profile-info-label">Vai trò</dt>
            <dd className="profile-info-value">{roleLabel(user.role)}</dd>
          </div>
          <div>
            <dt className="profile-info-label">Ngày tham gia</dt>
            <dd className="profile-info-value">
              {new Date(user.created_at).toLocaleDateString('vi-VN')}
            </dd>
          </div>
          {!isStudent && (
            <div>
              <dt className="profile-info-label">Đăng nhập gần nhất</dt>
              <dd className="profile-info-value">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleDateString('vi-VN')
                  : '—'}
              </dd>
            </div>
          )}
        </dl>

        <ProfileOverviewForm user={user} />
      </div>
    </div>
  );
}

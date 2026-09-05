import Link from 'next/link';

/**
 * Sub-nav ngang cho khu vực "trang cá nhân" — khớp
 * templates/_profile_subnav.html (blueprints/profile.py) bên Flask
 * gốc. CSS đã có sẵn từ trước (.profile-subnav, public/css/02-auth.css).
 *
 * Job đã lưu/Đã ứng tuyển (isStudent) trỏ về path CŨ /saved-jobs,
 * /my-applications — Flask gốc đã dời 2 route này sang
 * /profile/saved-jobs, /profile/applications (vẫn thuộc blueprint
 * my_stuff.py, chỉ đổi path để nằm chung sub-nav), nhưng Next.js CHƯA
 * dời theo (ngoài phạm vi mục "Module còn thiếu" — chỉ thêm
 * /profile/activity ở đợt này), nên trỏ thẳng path hiện có để không
 * link vào route chưa tồn tại.
 * Hoạt động (isStaff) — mới 09/2026, trỏ /profile/activity.
 */
export default function ProfileSubnav({
  active,
  isStudent,
  isStaff,
}: {
  active: 'overview' | 'security' | 'saved-jobs' | 'applications' | 'activity';
  isStudent?: boolean;
  isStaff?: boolean;
}) {
  return (
    <nav className="profile-subnav">
      <Link href="/profile" className={active === 'overview' ? 'active' : ''}>
        Thông tin chung
      </Link>
      <Link href="/profile/security" className={active === 'security' ? 'active' : ''}>
        Bảo mật
      </Link>
      {isStudent && (
        <>
          <Link href="/saved-jobs" className={active === 'saved-jobs' ? 'active' : ''}>
            Job đã lưu
          </Link>
          <Link href="/my-applications" className={active === 'applications' ? 'active' : ''}>
            Đã ứng tuyển
          </Link>
        </>
      )}
      {isStaff && (
        <Link href="/profile/activity" className={active === 'activity' ? 'active' : ''}>
          Hoạt động
        </Link>
      )}
    </nav>
  );
}

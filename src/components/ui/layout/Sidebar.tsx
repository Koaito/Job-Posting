'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { logout } from '@/app/actions/auth';
import { getUnreadCount } from '@/app/actions/messages';
import { isStaffRole, roleLabel } from '@/lib/auth/roles';
import { LanguageToggle } from '@/components/ui/i18n/LanguageToggle';

// Poll ~25-30s (xem public/app.js gốc) — badge chỉ cần gần đúng, không
// cần realtime như khung chat (poll 5s riêng trong MessageThread.tsx).
const UNREAD_POLL_INTERVAL_MS = 25000;

interface SidebarUser {
  full_name: string;
  email: string;
  role: string;
}

interface SidebarProps {
  // user=null => trạng thái "guest" (chưa đăng nhập). Bản Flask gốc
  // (templates/base.html) luôn render .shell/.sidebar cho MỌI trang, kể
  // cả chưa đăng nhập — sidebar chỉ đổi phần .sidebar-foot (CTA đăng
  // nhập/đăng ký thay vì avatar+logout). Trước đây prop này bắt buộc
  // phải có user, nên (auth)/layout.tsx phải né hẳn Sidebar ra ngoài ->
  // mất luôn sidebar ở login/register/... (xem chat133/134).
  user: SidebarUser | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('sidebar');
  const tRole = useTranslations('roles');
  const isStaff = isStaffRole(user?.role);
  const [unreadCount, setUnreadCount] = useState(0);

  // Đọc thẳng class đã gắn SẴN trên <html> — class đó được set sớm bằng
  // inline <script> trong <head> (root layout.tsx), đọc localStorage
  // TRƯỚC khi React hydrate, tránh nháy (FOUC: sidebar rộng rồi mới co
  // lại 1 nhịp). Dùng lazy initializer (không phải useEffect) vì giá trị
  // này chỉ đọc ĐÚNG 1 lần lúc mount, không "đồng bộ" theo state ngoài
  // nào khác — gọi setState trong effect body sẽ bị lint cảnh báo
  // (react-hooks/set-state-in-effect, gây render lồng thừa 1 nhịp).
  // typeof document === 'undefined' che cho lượt render đầu trên server
  // (SSR không có DOM/localStorage) — 2 chỗ hiển thị dựa vào giá trị
  // này (icon/label nút) có suppressHydrationWarning vì SSR luôn không
  // biết trước lựa chọn đã lưu của trình duyệt, y hệt mọi "theme toggle"
  // đọc localStorage khác.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('sidebar-collapsed');
  });

  // B.3 Polish (mobile responsive, 09/2026): ở khoảng tablet (901–1200px
  // — đủ hẹp để sidebar full-text 248px chiếm quá nhiều chỗ nội dung,
  // nhưng CHƯA hẹp tới ngưỡng 900px khiến `.shell` phải stack 1 cột, xem
  // @media (max-width: 900px) dùng chung ở 10-pagination-responsive.css),
  // tự thu gọn sidebar về icon-rail — TÁI DÙNG NGUYÊN cơ chế
  // `sidebar-collapsed` (class + localStorage) đã có sẵn cho nút bấm thủ
  // công, không viết thêm CSS/class mới nào.
  //
  // CHỈ áp dụng khi người dùng CHƯA từng tự bấm nút thu gọn (không có
  // key `sidebarCollapsed` trong localStorage) — đã bấm rồi thì tôn
  // trọng đúng lựa chọn thủ công đó ở MỌI kích thước màn hình, kể cả khi
  // resize qua lại ngưỡng tablet này (không tự ý ghi đè lựa chọn người
  // dùng đã lưu).
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1200px)');

    const applyAuto = (matches: boolean) => {
      let hasManualPref = false;
      try {
        hasManualPref = localStorage.getItem('sidebarCollapsed') !== null;
      } catch {
        // localStorage bị chặn (chế độ ẩn danh nghiêm ngặt...) — coi như
        // chưa có lựa chọn thủ công, vẫn auto theo viewport bình thường
        // trong phiên hiện tại, chỉ không nhớ được qua lần tải sau.
      }
      if (hasManualPref) return;
      document.documentElement.classList.toggle('sidebar-collapsed', matches);
      setCollapsed(matches);
    };

    applyAuto(query.matches);
    const handleChange = (event: MediaQueryListEvent) => applyAuto(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!user) return; // guest: chưa đăng nhập, không có gì để poll
    let cancelled = false;
    const poll = async () => {
      const count = await getUnreadCount();
      if (!cancelled) setUnreadCount(count);
    };
    poll();
    const interval = setInterval(poll, UNREAD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  const toggleSidebar = () => {
    const next = !document.documentElement.classList.contains('sidebar-collapsed');
    document.documentElement.classList.toggle('sidebar-collapsed', next);
    try {
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
    } catch {
      // localStorage bị chặn (chế độ ẩn danh nghiêm ngặt...) — bỏ qua,
      // trạng thái vẫn đổi được trong phiên hiện tại, chỉ không nhớ qua
      // lần tải trang sau (giống hành vi Flask gốc, xem public/app.js).
    }
    setCollapsed(next);
  };

  const isActive = (path: string) => pathname.startsWith(path);
  const activeClass = (path: string) => (isActive(path) ? 'active' : '');

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">MX</span>
        <div className="brand-text">
          <strong>{t('brandName')}</strong>
          <span>{t('brandSub')}</span>
        </div>
      </div>

      <button
        type="button"
        className="sidebar-toggle"
        onClick={toggleSidebar}
        title={t('toggleTitle')}
        aria-expanded={!collapsed}
        suppressHydrationWarning
      >
        <span className="sidebar-toggle-ic" suppressHydrationWarning>{collapsed ? '»' : '«'}</span>
        <span className="nav-text" suppressHydrationWarning>{collapsed ? t('toggleExpand') : t('toggleCollapse')}</span>
      </button>

      <nav className="nav">
        {!user && (
          // Mọi route thật (jobs/companies/...) đều bắt buộc access_token
          // (middleware.ts) — chưa có trang public nào để trỏ tới cho
          // guest, nên KHÔNG tự chế link giả trỏ vào chỗ 404/redirect
          // ngược lại /login. Chỉ để 1 dòng ghi chú, giống lý do bỏ nhóm
          // "Thêm mới" (add_hub) trong kế hoạch — không tự chế route ảo.
          <p className="nav-note muted">{t('guestNote')}</p>
        )}

        {user && (
          <>
            <span className="nav-label">{t('sectionOverview')}</span>
            <Link href="/dashboard" className={activeClass('/dashboard')}>
              <span className="nav-ic">📊</span>
              <span className="nav-text">{t('navDashboard')}</span>
            </Link>

            <span className="nav-label">{t('sectionJobs')}</span>
            <Link href="/jobs" className={activeClass('/jobs')}>
              <span className="nav-ic">💼</span>
              <span className="nav-text">{t('navJobs')}</span>
            </Link>
            <Link href="/companies" className={activeClass('/companies')}>
              <span className="nav-ic">🏢</span>
              <span className="nav-text">{t('navCompanies')}</span>
            </Link>
            <Link href="/contacts" className={activeClass('/contacts')}>
              <span className="nav-ic">👥</span>
              <span className="nav-text">{t('navContacts')}</span>
            </Link>

            {/* Thêm 09/2026 (Phase 3.6) — chỉ học viên (role 'user') thấy
                2 link này, staff/admin dùng JobApplicantsPanel ngay trên
                trang chi tiết job để xem ai đã ứng tuyển/lưu, không cần
                trang riêng cho họ. */}
            {!isStaff && (
              <>
                <span className="nav-label">{t('sectionStudent')}</span>
                <Link href="/my-applications" className={activeClass('/my-applications')}>
                  <span className="nav-ic">📄</span>
                  <span className="nav-text">{t('navMyApplications')}</span>
                </Link>
                <Link href="/saved-jobs" className={activeClass('/saved-jobs')}>
                  <span className="nav-ic">⭐</span>
                  <span className="nav-text">{t('navSavedJobs')}</span>
                </Link>
              </>
            )}

            {/* Cập nhật 09/2026: /students, /staff, /crawl, /activity đều
                đã có page.tsx thật — không còn route nào 404 trong nhóm
                này. /contacts (link riêng phía trên) cũng đã dựng cùng
                đợt. /staff-activity thêm sau (rà soát #3, xem mục 6.10
                plan_nextjs.md) — đứng ngay sau "Nhân viên" giống thứ tự
                bên Flask gốc (templates/base.html). */}
            {isStaff && (
              <>
                <span className="nav-label">{t('sectionAdmin')}</span>
                <Link href="/students" className={activeClass('/students')}>
                  <span className="nav-ic">🎓</span>
                  <span className="nav-text">{t('navStudents')}</span>
                </Link>
                <Link href="/staff" className={activeClass('/staff')}>
                  <span className="nav-ic">👨‍💼</span>
                  <span className="nav-text">{t('navStaff')}</span>
                </Link>
                <Link href="/staff-activity" className={activeClass('/staff-activity')}>
                  <span className="nav-ic">▤</span>
                  <span className="nav-text">{t('navStaffActivity')}</span>
                </Link>
                <Link href="/crawl" className={activeClass('/crawl')}>
                  <span className="nav-ic">🕷️</span>
                  <span className="nav-text">{t('navCrawl')}</span>
                </Link>
                <Link href="/data-management" className={activeClass('/data-management')}>
                  <span className="nav-ic">🗂️</span>
                  <span className="nav-text">{t('navDataManagement')}</span>
                </Link>
                <Link href="/activity" className={activeClass('/activity')}>
                  <span className="nav-ic">📋</span>
                  <span className="nav-text">{t('navActivity')}</span>
                </Link>
              </>
            )}

            <span className="nav-label">{t('sectionOther')}</span>
            <Link href="/messages" className={activeClass('/messages')}>
              <span className="nav-ic">💬</span>
              <span className="nav-text">{t('navMessages')}</span>
              <span className="nav-badge" hidden={unreadCount === 0}>
                {unreadCount <= 99 ? unreadCount : '99+'}
              </span>
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-foot">
        <LanguageToggle />
        {user ? (
          <>
            <Link className="auth-box" href="/profile" title={t('profileTitle')}>
              <div className="auth-avatar">{user.full_name?.[0]?.toUpperCase() ?? '?'}</div>
              <div className="auth-info">
                <strong>{user.full_name}</strong>
                <span>{isStaff ? roleLabel(user.role, tRole) : user.email}</span>
              </div>
            </Link>
            <Link className="btn btn-ghost btn-block" href="/profile" title={t('profileTitle')}>
              <span className="btn-text-label">{t('profileTitle')}</span>
            </Link>
            <button type="button" onClick={handleLogout} className="btn btn-ghost btn-block">
              <span className="btn-text-label">{t('logout')}</span>
            </button>
          </>
        ) : (
          <>
            <div className="auth-box auth-box-guest">
              <p>{t('guestCta')}</p>
            </div>
            <Link className="btn btn-primary btn-block" href="/login" title={t('login')}>
              <span className="btn-text-label">{t('login')}</span>
            </Link>
            <Link className="btn btn-ghost btn-block" href="/register" title={t('register')}>
              <span className="btn-text-label">{t('register')}</span>
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}

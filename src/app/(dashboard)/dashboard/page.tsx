import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { getDashboardStats, getRecentActivity } from '@/app/actions/dashboard';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { toIntlLocale } from '@/i18n/config';

/**
 * Dashboard Homepage
 * Shows 6 KPI cards matching Flask dashboard exactly
 * Corresponds to: templates/dashboard.html lines 30-52
 *
 * BUG FIX (audit 09/2026): route này trước đây nằm ở app/dashboard/page.tsx
 * (NGOÀI route group (dashboard)/) — không đi qua (dashboard)/layout.tsx
 * nên KHÔNG có Sidebar, và KHÔNG bị redirect về /login nếu chưa đăng
 * nhập (middleware chặn được phần lộ dữ liệu, nhưng UX vẫn "trơ trọi").
 * Chuyển file vào trong route group để dùng chung layout/auth check với
 * mọi trang khác trong (dashboard)/.
 */

export default async function DashboardPage() {
  // Layout cha ((dashboard)/layout.tsx) đã gọi getCurrentUser() để lấy
  // user cho Sidebar + redirect nếu chưa đăng nhập — gọi lại ở đây để
  // lấy full_name hiển thị ở welcome message, chấp nhận gọi API 2 lần
  // (không phải bug, chỉ là chưa tối ưu — có thể truyền qua context sau).
  const [user, stats, t, locale] = await Promise.all([
    getCurrentUser(),
    getDashboardStats(),
    getTranslations('dashboard'),
    getLocale(),
  ]);
  const isStaff = isStaffRole(user?.role);
  // /audit-logs (nguồn của getRecentActivity) yêu cầu ss_team trở lên
  // — chỉ gọi khi chắc chắn có quyền, tránh gọi API vô ích rồi bị 403.
  const recentActivity = isStaff ? await getRecentActivity(8) : [];
  // Locale cho new Date().toLocaleString() — dùng helper dùng chung
  // toIntlLocale() (Polish, 09/2026, xem src/i18n/config.ts) thay vì tự
  // suy ternary riêng ở đây, để mọi nơi map locale -> BCP-47 giống nhau.
  const dateLocale = toIntlLocale(locale);

  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" bọc ngoài —
    // class ảo, main.content (root layout.tsx) đã lo container rồi.
    <>
      <div className="page-head">
        <h1>{t('title')}</h1>
        <p className="lede">{t('subtitle')}</p>
      </div>

      {/* KPI Cards - Matches Flask dashboard exactly (6 cards) */}
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-num">{stats.total_jobs.toLocaleString()}</span>
          <span className="kpi-label">{t('kpi.totalJobs')}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_companies.toLocaleString()}</span>
          <span className="kpi-label">{t('kpi.totalCompanies')}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.jobs_open.toLocaleString()}</span>
          <span className="kpi-label">{t('kpi.jobsOpen')}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">
            {stats.total_students !== null ? stats.total_students.toLocaleString() : '—'}
          </span>
          <span className="kpi-label">{t('kpi.totalStudents')}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_applications.toLocaleString()}</span>
          <span className="kpi-label">{t('kpi.totalApplications')}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_saved_jobs.toLocaleString()}</span>
          <span className="kpi-label">{t('kpi.totalSavedJobs')}</span>
        </div>
      </div>

      {/* Welcome message — "welcome-section" (class ảo, không tồn tại
          trong CSS nào, và Flask gốc không có khối này — đây là phần
          Next.js tự thêm) đổi sang ".card" (class thật, panel bo góc
          có sẵn, dùng chung với khối "Hoạt động gần đây" ngay dưới) để
          nhất quán, thay vì để trơ không style. */}
      <div className="card" style={{ marginTop: '32px' }}>
        <h2>{t('welcome', { name: user?.full_name || t('welcomeFallbackName') })}</h2>
        <p>
          {/* BUG FIX: text cũ báo "Phase 3: Jobs CRUD đang chờ phát triển"
              dù thực tế đã code xong (dù trước đây đang lỗi) — cập nhật
              lại đúng trạng thái sau khi Sprint 1 đã sửa Jobs CRUD.
              Lưu ý: trước đây dùng className="muted" ở đây — bỏ vì
              ".muted" KHÔNG phải utility toàn cục, chỉ có tác dụng khi
              nằm trong vài khối cha cụ thể (.applicant-list .muted,
              .contact-table td.muted...), đứng riêng như thế này không
              lấy được màu gì cả. Không có class chung nào khác thay thế
              đúng ngữ nghĩa "chữ mờ" cho đoạn văn thường — để plain,
              tránh gán bừa 1 class không đúng ý nghĩa chỉ để có style. */}
          {t('phase2Done')}<br />
          {t('phase3Done')}
        </p>
      </div>

      {/* Recent Activity widget — mới thêm 09/2026, dùng lại
          getRecentActivity() (trước đây throw 'Not implemented' dù
          endpoint /audit-logs đã có sẵn từ lâu). Chỉ hiện cho staff,
          khớp quyền require_role('ss_team') của endpoint gốc. */}
      {isStaff && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{t('recentActivity')}</h3>
            {/* BUG FIX (audit CSS 09/2026): class "link" không tồn tại
                — dùng "btn btn-text" (class thật, đúng kiểu link-hành-
                động nhỏ đã dùng ở mọi nơi khác trong app). */}
            <Link href="/activity" className="btn btn-text">{t('viewAll')}</Link>
          </div>
          {recentActivity.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
              {recentActivity.map((log) => (
                <li
                  key={log.log_id}
                  style={{ padding: '8px 0', borderTop: '1px solid var(--border-color, #eee)', fontSize: '14px' }}
                >
                  <span className="muted">{new Date(log.created_at).toLocaleString(dateLocale)}</span>
                  {' — '}
                  {log.actor_name || <span className="muted">{t('systemActor')}</span>}
                  {' · '}
                  {log.entity_label || log.entity_type}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-placeholder" style={{ margin: '12px 0 0 0' }}>{t('noActivity')}</p>
          )}
        </div>
      )}
    </>
  );
}

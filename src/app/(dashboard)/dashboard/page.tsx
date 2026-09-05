import Link from 'next/link';
import { getDashboardStats, getRecentActivity } from '@/app/actions/dashboard';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';

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
  const [user, stats] = await Promise.all([
    getCurrentUser(),
    getDashboardStats(),
  ]);
  const isStaff = isStaffRole(user?.role);
  // /audit-logs (nguồn của getRecentActivity) yêu cầu ss_team trở lên
  // — chỉ gọi khi chắc chắn có quyền, tránh gọi API vô ích rồi bị 403.
  const recentActivity = isStaff ? await getRecentActivity(8) : [];

  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" bọc ngoài —
    // class ảo, main.content (root layout.tsx) đã lo container rồi.
    <>
      <div className="page-head">
        <h1>Tổng quan thị trường job & database doanh nghiệp</h1>
        <p className="lede">Số liệu cập nhật theo dữ liệu hiện có trong hệ thống.</p>
      </div>

      {/* KPI Cards - Matches Flask dashboard exactly (6 cards) */}
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-num">{stats.total_jobs.toLocaleString()}</span>
          <span className="kpi-label">Job trong database</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_companies.toLocaleString()}</span>
          <span className="kpi-label">Công ty trong database</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.jobs_open.toLocaleString()}</span>
          <span className="kpi-label">Job đang còn tuyển</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">
            {stats.total_students !== null ? stats.total_students.toLocaleString() : '—'}
          </span>
          <span className="kpi-label">Học viên đã đăng ký</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_applications.toLocaleString()}</span>
          <span className="kpi-label">Lượt ứng tuyển</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_saved_jobs.toLocaleString()}</span>
          <span className="kpi-label">Job đã lưu</span>
        </div>
      </div>

      {/* Welcome message — "welcome-section" (class ảo, không tồn tại
          trong CSS nào, và Flask gốc không có khối này — đây là phần
          Next.js tự thêm) đổi sang ".card" (class thật, panel bo góc
          có sẵn, dùng chung với khối "Hoạt động gần đây" ngay dưới) để
          nhất quán, thay vì để trơ không style. */}
      <div className="card" style={{ marginTop: '32px' }}>
        <h2>Chào mừng trở lại, {user?.full_name || 'bạn'}! 👋</h2>
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
          ✅ Phase 2 hoàn thành: Dashboard stats đang hiển thị 6 KPIs (khớp Flask dashboard)<br />
          ✅ Phase 3 hoàn thành: Jobs CRUD (list, create, edit, delete)
        </p>
      </div>

      {/* Recent Activity widget — mới thêm 09/2026, dùng lại
          getRecentActivity() (trước đây throw 'Not implemented' dù
          endpoint /audit-logs đã có sẵn từ lâu). Chỉ hiện cho staff,
          khớp quyền require_role('ss_team') của endpoint gốc. */}
      {isStaff && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Hoạt động gần đây</h3>
            {/* BUG FIX (audit CSS 09/2026): class "link" không tồn tại
                — dùng "btn btn-text" (class thật, đúng kiểu link-hành-
                động nhỏ đã dùng ở mọi nơi khác trong app). */}
            <Link href="/activity" className="btn btn-text">Xem tất cả →</Link>
          </div>
          {recentActivity.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
              {recentActivity.map((log) => (
                <li
                  key={log.log_id}
                  style={{ padding: '8px 0', borderTop: '1px solid var(--border-color, #eee)', fontSize: '14px' }}
                >
                  <span className="muted">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                  {' — '}
                  {log.actor_name || <span className="muted">Hệ thống (crawl tự động)</span>}
                  {' · '}
                  {log.entity_label || log.entity_type}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-placeholder" style={{ margin: '12px 0 0 0' }}>Chưa có hoạt động nào.</p>
          )}
        </div>
      )}
    </>
  );
}

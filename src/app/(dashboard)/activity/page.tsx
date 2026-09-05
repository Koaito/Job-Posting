import Link from 'next/link';
import { getAuditLogs } from '@/app/actions/audit';
import AuditLogNoteEditor from '@/components/features/AuditLogNoteEditor';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';

/**
 * Audit Logs Page ("Lịch sử thao tác")
 * Backend thật: api/routers/audit_logs.py — require_role("ss_team").
 * Route: /activity
 *
 * Mới 09/2026 — trước đây chỉ có link trong Sidebar, KHÔNG có page.tsx
 * (404 thật). types/audit.ts + actions/audit.ts đã đúng sẵn.
 *
 * view='auto' (mặc định): TẤT CẢ thao tác, không note. view='manual':
 * tập con hành động nhạy cảm (sửa/xoá JD, sửa/xoá company, mọi thao
 * tác HR contact), kèm note — 2 CÁCH LỌC trên CÙNG 1 bảng, không phải
 * 2 nguồn dữ liệu khác nhau (xem docstring backend).
 */

interface SearchParams {
  view?: 'auto' | 'manual';
  entity_type?: string;
  action_type?: string;
  pending_note?: string;
  page?: string;
}

const ENTITY_TYPE_OPTIONS = ['JOB', 'COMPANY', 'CONTACT', 'APPLICATION'];
const ACTION_TYPE_OPTIONS = [
  'CREATE_JOB', 'UPDATE_JOB', 'DELETE_JOB',
  'CREATE_COMPANY', 'UPDATE_COMPANY', 'DELETE_COMPANY',
  'CREATE_CONTACT', 'UPDATE_CONTACT', 'DELETE_CONTACT', 'ASSIGN_CONTACT',
  'APPLY_JOB', 'WITHDRAW_JOB_APPLICATION',
];

function actionTypeLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE_JOB: 'Tạo JD', UPDATE_JOB: 'Sửa JD', DELETE_JOB: 'Xoá JD',
    CREATE_COMPANY: 'Tạo công ty', UPDATE_COMPANY: 'Sửa công ty', DELETE_COMPANY: 'Xoá công ty',
    CREATE_CONTACT: 'Tạo liên hệ', UPDATE_CONTACT: 'Sửa liên hệ',
    DELETE_CONTACT: 'Xoá liên hệ', ASSIGN_CONTACT: 'Gán liên hệ',
    APPLY_JOB: 'Ứng tuyển', WITHDRAW_JOB_APPLICATION: 'Huỷ ứng tuyển',
  };
  return labels[action] || action;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currentUser = await getCurrentUser();
  const isStaff = isStaffRole(currentUser?.role);

  if (!isStaff) {
    return (
      // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo, main.content
      // (root layout.tsx) đã lo container rồi.
      <>
        <div className="page-head">
          <h1>Lịch sử thao tác</h1>
        </div>
        <div className="empty-state">
          <p>Trang này chỉ dành cho nhân viên (ss_team/admin).</p>
        </div>
      </>
    );
  }

  const view = sp.view === 'manual' ? 'manual' : 'auto';
  const page = parseInt(sp.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const { items: logs, total } = await getAuditLogs({
    view,
    entity_type: sp.entity_type,
    action_type: sp.action_type,
    pending_note: view === 'manual' && sp.pending_note === 'true' ? true : undefined,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);
  const qs = (overrides: Partial<SearchParams>) => {
    const merged = { ...sp, ...overrides };
    const params = new URLSearchParams();
    if (merged.view) params.append('view', merged.view);
    if (merged.entity_type) params.append('entity_type', merged.entity_type);
    if (merged.action_type) params.append('action_type', merged.action_type);
    if (merged.pending_note) params.append('pending_note', merged.pending_note);
    if (merged.page) params.append('page', merged.page);
    return `/activity?${params}`;
  };

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo — main.content
    // (root layout.tsx) đã lo container/padding cho mọi trang rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Lịch sử thao tác</h1>
          <p className="lede">
            Nhật ký ai tạo/sửa/xoá JD, công ty, liên hệ HR — {total} bản ghi.
          </p>
        </div>
      </div>

      {/* BUG FIX (audit CSS 09/2026): "tabs"/"tab"/"tab-active" là class
          ảo, không khớp bất kỳ selector nào. CSS thật riêng cho đúng
          trang này (public/css/12-activity-logs.css, class tên
          "tab-nav") dùng thẻ <nav class="tab-nav"> bọc các <a>, active
          tab có thêm class "active" — khớp 1:1 templates/activity_logs.html
          gốc (KHÔNG dùng ".tab-bar", đó là family khác dựa trên <button>
          ở dashboard.html/crawl.html, không phải component ở đây). */}
      <nav className="tab-nav" style={{ marginBottom: '16px' }}>
        <Link
          href={qs({ view: 'auto', page: '1' })}
          className={view === 'auto' ? 'active' : ''}
        >
          Tất cả thao tác
        </Link>
        <Link
          href={qs({ view: 'manual', page: '1' })}
          className={view === 'manual' ? 'active' : ''}
        >
          Log thủ công (có note)
        </Link>
      </nav>

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/activity" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input type="hidden" name="view" value={view} />
          <select name="entity_type" defaultValue={sp.entity_type || ''}>
            <option value="">Mọi loại</option>
            {ENTITY_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select name="action_type" defaultValue={sp.action_type || ''}>
            <option value="">Mọi hành động</option>
            {ACTION_TYPE_OPTIONS.map((a) => (
              <option key={a} value={a}>{actionTypeLabel(a)}</option>
            ))}
          </select>
          {view === 'manual' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                name="pending_note"
                value="true"
                defaultChecked={sp.pending_note === 'true'}
              />
              Chỉ log còn thiếu note
            </label>
          )}
          <button type="submit" className="btn">Lọc</button>
          <Link href={qs({ entity_type: undefined, action_type: undefined, pending_note: undefined, page: '1' })} className="btn">
            Xoá lọc
          </Link>
        </form>
      </div>

      {logs.length > 0 ? (
        <>
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Công ty</th>
                  {view === 'manual' && <th>Note</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.log_id}>
                    <td className="muted">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                    <td>{log.actor_name || <span className="muted">Hệ thống (crawl tự động)</span>}</td>
                    <td>{actionTypeLabel(log.action_type)}</td>
                    <td>
                      {log.entity_label || <span className="muted">—</span>}
                      <div className="muted" style={{ fontSize: '12px' }}>{log.entity_type}</div>
                    </td>
                    <td>
                      {log.company_id ? (
                        <Link href={`/companies/${log.company_id}`}>{log.company_name || '—'}</Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    {view === 'manual' && (
                      <td style={{ minWidth: '260px' }}>
                        <AuditLogNoteEditor
                          logId={log.log_id}
                          currentNote={log.note}
                          noteRequired={log.note_required}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link href={qs({ page: String(page - 1) })} className="page-btn">← Trang trước</Link>
              )}
              <span className="page-status">Trang {page} / {totalPages}</span>
              {page < totalPages && (
                <Link href={qs({ page: String(page + 1) })} className="page-btn">Trang sau →</Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>Không có bản ghi nào khớp bộ lọc.</p>
        </div>
      )}
    </>
  );
}

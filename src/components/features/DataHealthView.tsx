import Link from 'next/link';
import type { CompanyDataHealth, JobDataHealth, FieldHealthRow } from '@/types/crawl';

/**
 * Tab "Tình trạng dữ liệu" ở trang /crawl — cho admin/ss_team thấy
 * nhanh company/job đang thiếu field gì/tỉ lệ bao nhiêu, KHÔNG cần vào
 * thẳng database. Chỉ đọc, không có form/route ghi nào — đúng theo
 * blueprints/crawl_status.py (Flask gốc).
 *
 * THÊM 09/2026 (rà soát #3, chat139) — module còn thiếu hoàn toàn ở
 * Next.js trước đợt này. Dùng CSS đã có sẵn (.status-card-title,
 * 15-crawl.css) + .contact-table-wrap/.contact-table dùng chung nhiều
 * trang khác trong repo (không tự bịa class mới).
 */

function FieldHealthTable({ rows, total }: { rows: FieldHealthRow[]; total: number }) {
  if (rows.length === 0) {
    return <p className="muted">Không có dữ liệu.</p>;
  }
  return (
    <div className="contact-table-wrap">
      <table className="contact-table">
        <thead>
          <tr>
            <th>Trường dữ liệu</th>
            <th>Thiếu</th>
            <th>Tổng</th>
            <th>Tỉ lệ thiếu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field}>
              <td>{row.label}</td>
              <td className="muted">{row.missing}</td>
              <td className="muted">{row.total || total}</td>
              <td>
                <span className={`badge ${row.pct_missing >= 50 ? 'badge-danger' : row.pct_missing > 0 ? 'badge-warning' : 'badge-success'}`}>
                  {row.pct_missing}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DataHealthViewProps {
  companyHealth: CompanyDataHealth;
  jobHealth: JobDataHealth;
}

export default function DataHealthView({ companyHealth, jobHealth }: DataHealthViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <h2 className="status-card-title">Company đang thiếu dữ liệu ({companyHealth.company_health_total})</h2>
        <FieldHealthTable rows={companyHealth.company_health_rows} total={companyHealth.company_health_total} />
        <p className="muted" style={{ marginTop: '14px', marginBottom: 0 }}>
          <strong>{companyHealth.company_no_contact_missing}</strong> / {companyHealth.company_no_contact_total} công
          ty active chưa có contact HR nào.
        </p>
      </div>

      <div className="card">
        <h2 className="status-card-title">Job đang thiếu dữ liệu ({jobHealth.job_health_total})</h2>
        <FieldHealthTable rows={jobHealth.job_health_rows} total={jobHealth.job_health_total} />
      </div>

      {jobHealth.job_health_by_source.length > 0 && (
        <div className="card">
          <h2 className="status-card-title">Thiếu dữ liệu theo nguồn</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {jobHealth.job_health_by_source.map((src) => (
              <div key={src.source}>
                <h4 style={{ marginBottom: '8px' }}>{src.source} ({src.total})</h4>
                <FieldHealthTable rows={src.rows} total={src.total} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="status-card-title">Job hết hạn nhưng vẫn &quot;Đang tuyển&quot; ({jobHealth.expired_open_jobs.length})</h2>
        {jobHealth.expired_open_jobs.length === 0 ? (
          <p className="muted">Không có job nào — dữ liệu sạch.</p>
        ) : (
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>Vị trí</th>
                  <th>Công ty</th>
                  <th>Hạn nộp</th>
                  <th>Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {jobHealth.expired_open_jobs.map((j) => (
                  <tr key={j.id}>
                    <td><Link href={`/jobs/${j.id}`}>{j.position}</Link></td>
                    <td className="muted">{j.company}</td>
                    <td className="muted">{j.deadline ? new Date(j.deadline).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="muted">{j.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="status-card-title">Job nghi trùng lặp ({jobHealth.duplicate_job_groups.length} nhóm)</h2>
        {jobHealth.duplicate_job_groups.length === 0 ? (
          <p className="muted">Không có nhóm nào nghi trùng.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {jobHealth.duplicate_job_groups.map((group, idx) => (
              <div key={`${group.company}-${group.position}-${idx}`}>
                <h4 style={{ marginBottom: '8px' }}>{group.company} — {group.position}</h4>
                <div className="contact-table-wrap">
                  <table className="contact-table">
                    <thead>
                      <tr>
                        <th>Vị trí</th>
                        <th>Hạn nộp</th>
                        <th>Nguồn</th>
                        <th>Gợi ý</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.jobs.map((j) => (
                        <tr key={j.id}>
                          <td><Link href={`/jobs/${j.id}`}>{j.position}</Link></td>
                          <td className="muted">{j.deadline ? new Date(j.deadline).toLocaleDateString('vi-VN') : '—'}</td>
                          <td className="muted">{j.source}</td>
                          <td>
                            {j.suggest_keep === true && <span className="badge badge-success">Nên giữ</span>}
                            {j.suggest_keep === false && <span className="badge badge-warning">Cân nhắc đóng</span>}
                            {(j.suggest_keep === null || j.suggest_keep === undefined) && <span className="muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

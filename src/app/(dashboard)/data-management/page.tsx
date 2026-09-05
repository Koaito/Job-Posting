import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import type { ImportExportEntityType } from '@/types/import-export';
import ExportPanel from '@/components/features/data-management/ExportPanel';
import ImportPanel from '@/components/features/data-management/ImportPanel';

/**
 * Data Management Page ("/data-management") — Phase 6.3, 09/2026.
 * Backend thật: Scrap_JD/api/routers/import_export.py — TOÀN BỘ route
 * require_role("ss_team") (ss_team + admin).
 *
 * Trước đây route này hoàn toàn chưa tồn tại (404 thật) dù backend đã
 * có sẵn 7 endpoint và CSS (13-data-management.css) đã chuẩn bị trước
 * — xem rà soát tổng thể 09/2026. Đợt này build phần MVP: Export đầy
 * đủ (filter + preview + tải file), Import chỉ auto-confirm dòng sạch
 * (xem docstring actions/import-export.ts::confirmImport).
 */

const ENTITY_OPTIONS: { value: ImportExportEntityType; label: string }[] = [
  { value: 'job', label: 'Job' },
  { value: 'company', label: 'Công ty' },
  { value: 'contact', label: 'Liên hệ' },
];

interface SearchParams {
  entity?: string;
  tab?: 'export' | 'import';
}

function isValidEntity(value: string | undefined): value is ImportExportEntityType {
  return value === 'job' || value === 'company' || value === 'contact';
}

export default async function DataManagementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currentUser = await getCurrentUser();
  const isStaff = isStaffRole(currentUser?.role);

  if (!isStaff) {
    return (
      // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
      <>
        <div className="page-head">
          <h1>Import / Export dữ liệu</h1>
        </div>
        <div className="empty-state">
          <p>Trang này chỉ dành cho nhân viên (ss_team/admin).</p>
        </div>
      </>
    );
  }

  const entity: ImportExportEntityType = isValidEntity(sp.entity) ? sp.entity : 'job';
  const tab: 'export' | 'import' = sp.tab === 'import' ? 'import' : 'export';

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Vận hành</span>
          <h1>Import / Export dữ liệu</h1>
          <p className="lede">
            Xuất dữ liệu Job/Công ty/Liên hệ ra CSV/XLSX, hoặc nhập hàng loạt từ file có sẵn.
          </p>
        </div>
      </div>

      <div className="dm-entity-switch">
        {ENTITY_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/data-management?entity=${opt.value}&tab=${tab}`}
            className={`dm-entity-tab ${entity === opt.value ? 'active' : ''}`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <nav className="tab-nav">
        <Link
          href={`/data-management?entity=${entity}&tab=export`}
          className={tab === 'export' ? 'active' : ''}
        >
          Export
        </Link>
        <Link
          href={`/data-management?entity=${entity}&tab=import`}
          className={tab === 'import' ? 'active' : ''}
        >
          Import
        </Link>
      </nav>

      <div className="dm-panel">
        {tab === 'export' ? (
          <ExportPanel entityType={entity} />
        ) : (
          <ImportPanel entityType={entity} />
        )}
      </div>
    </>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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

const ENTITY_VALUES: ImportExportEntityType[] = ['job', 'company', 'contact'];

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
  const t = await getTranslations('dataManagementPage');
  const currentUser = await getCurrentUser();
  const isStaff = isStaffRole(currentUser?.role);

  if (!isStaff) {
    return (
      // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
      <>
        <div className="page-head">
          <h1>{t('title')}</h1>
        </div>
        <div className="empty-state">
          <p>{t('staffOnly')}</p>
        </div>
      </>
    );
  }

  const entity: ImportExportEntityType = isValidEntity(sp.entity) ? sp.entity : 'job';
  const tab: 'export' | 'import' = sp.tab === 'import' ? 'import' : 'export';

  const entityLabel = (value: ImportExportEntityType) =>
    value === 'job' ? t('entityJob') : value === 'company' ? t('entityCompany') : t('entityContact');

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">
            {t('lede')}
          </p>
        </div>
      </div>

      <div className="dm-entity-switch">
        {ENTITY_VALUES.map((value) => (
          <Link
            key={value}
            href={`/data-management?entity=${value}&tab=${tab}`}
            className={`dm-entity-tab ${entity === value ? 'active' : ''}`}
          >
            {entityLabel(value)}
          </Link>
        ))}
      </div>

      <nav className="tab-nav">
        <Link
          href={`/data-management?entity=${entity}&tab=export`}
          className={tab === 'export' ? 'active' : ''}
        >
          {t('tabExport')}
        </Link>
        <Link
          href={`/data-management?entity=${entity}&tab=import`}
          className={tab === 'import' ? 'active' : ''}
        >
          {t('tabImport')}
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

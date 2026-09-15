import {
  getCrawlSources,
  getLatestCrawlRun,
  getCrawlHistory,
  getCompanyDataHealth,
  getJobDataHealth,
  getMaintenanceHistory,
} from '@/app/actions/crawl';
import { getCurrentUser } from '@/app/actions/auth';
import { isAdminRole } from '@/lib/auth/roles';
import { getTranslations } from 'next-intl/server';
import CrawlTrigger from '@/components/features/CrawlTrigger';
import CrawlTabNav from '@/components/features/CrawlTabNav';
import DataHealthView from '@/components/features/DataHealthView';
import MaintenanceGrid from '@/components/features/MaintenanceGrid';
import HistoryView from '@/components/features/HistoryView';
import type { MaintenanceStatus } from '@/types/crawl';
import { RequireRole } from '@/components/ui/guards/RequireRole';
import { ContentFullMarker } from '@/components/layout/ContentFullMarker';

/**
 * Crawl Page ("Van hanh du lieu") -- 4 tab, khop dung
 * blueprints/crawl.py (Flask goc): crawl / status / maintenance / history.
 * Backend that: api/routers/crawl.py, api/routers/maintenance.py,
 * api/routers/companies.py + jobs.py (data-health).
 *
 * Moi 09/2026 -- truoc day thu muc crawl/ hoan toan rong (404 that,
 * xem Sidebar TODO). QUYEN: xem trang (log/lich su) can 'ss_team' tro
 * len; BAM kich hoat crawl/bao tri can 'admin' -- an form cho ss_team
 * thuong, hien thong bao thay vi de bam roi nhan 403 (xem CrawlTrigger,
 * MaintenanceJobCard).
 *
 * THEM 09/2026 (ra soat #3, chat139) -- truoc dot nay trang nay chi co
 * 1/4 tab (chi noi dung tab "crawl", KHONG co tab nav nao ca, va bang
 * lich su crawl nam LAN vao chung tab "crawl" thay vi tab "history"
 * rieng nhu Flask that). Dot nay: them tab nav that + 3 tab con thieu
 * (status/maintenance/history) + doi bang lich su crawl sang dung tab
 * "history" cho khop kien truc goc.
 *
 * i18n (09/2026, ra soat kien truc) -- day la trang DUY NHAT con hard-code
 * tieng Viet trong khi moi trang cung cap (jobs/companies/contacts...) da
 * chuyen sang next-intl tu lau. Cac component con (CrawlTabNav, CrawlTrigger,
 * DataHealthView...) da dung useTranslations() dung, chi rieng page.tsx nay
 * (trang cha) bi bo sot. Them namespace crawlPage vao messages/{vi,en}.json,
 * dung getTranslations() dung pattern cac page Server Component khac.
 */

interface SearchParams {
  tab?: string;
  // Tab "history" - bang crawl (tien to c_)
  c_source?: string;
  c_status?: string;
  c_page?: string;
  // Tab "history" - bang bao tri (tien to m_)
  m_job_type?: string;
  m_status?: string;
  m_page?: string;
}

const VALID_TABS = ['crawl', 'status', 'maintenance', 'history'];

export default async function CrawlPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currentUser = await getCurrentUser();
  const isAdmin = isAdminRole(currentUser?.role);
  const t = await getTranslations('crawlPage');

  const tab = VALID_TABS.includes(sp.tab || '') ? (sp.tab as string) : 'crawl';

  return (
    <>
      <ContentFullMarker />
      <RequireRole role="staff" deniedTitle={t('staffOnlyTitle')} deniedMessage={t('staffOnlyMessage')}>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">{t('lede')}</p>
        </div>
      </div>

      <CrawlTabNav active={tab} />

      {tab === 'crawl' && <CrawlTabContent isAdmin={isAdmin} />}
      {tab === 'status' && <StatusTabContent />}
      {tab === 'maintenance' && <MaintenanceTabContent isAdmin={isAdmin} />}
      {tab === 'history' && <HistoryTabContent sp={sp} />}
    </RequireRole>
    </>
  );
}

async function CrawlTabContent({ isAdmin }: { isAdmin: boolean }) {
  const [sources, latestRun] = await Promise.all([getCrawlSources(), getLatestCrawlRun()]);
  return <CrawlTrigger isAdmin={isAdmin} sources={sources} initialRun={latestRun} />;
}

async function StatusTabContent() {
  const [companyHealth, jobHealth] = await Promise.all([getCompanyDataHealth(), getJobDataHealth()]);
  return <DataHealthView companyHealth={companyHealth} jobHealth={jobHealth} />;
}

async function MaintenanceTabContent({ isAdmin }: { isAdmin: boolean }) {
  // Lay cac luot dang 'running'/'queued' de biet job_type nao dang chay khi vua vao trang
  // (khop active_runs ben Flask goc) -- uu tien 'running' hon 'queued' khi ca 2 cung ton tai.
  const [runningRuns, queuedRuns] = await Promise.all([
    getMaintenanceHistory({ status: 'running', limit: 50 }),
    getMaintenanceHistory({ status: 'queued', limit: 50 }),
  ]);

  const activeRuns: Record<string, MaintenanceStatus> = {};
  for (const run of queuedRuns.items) activeRuns[run.job_type] = run;
  for (const run of runningRuns.items) activeRuns[run.job_type] = run;

  return <MaintenanceGrid isAdmin={isAdmin} activeRuns={activeRuns} />;
}

async function HistoryTabContent({ sp }: { sp: SearchParams }) {
  const limit = 20;
  const crawlPage = parseInt(sp.c_page || '1');
  const maintenancePage = parseInt(sp.m_page || '1');

  const [sources, crawlRuns, maintenanceRuns] = await Promise.all([
    getCrawlSources(),
    getCrawlHistory({ source: sp.c_source, status: sp.c_status, limit, offset: (crawlPage - 1) * limit }),
    getMaintenanceHistory({ job_type: sp.m_job_type, status: sp.m_status, limit, offset: (maintenancePage - 1) * limit }),
  ]);

  return (
    <HistoryView
      sources={Object.keys(sources)}
      crawlRuns={crawlRuns}
      crawlPage={crawlPage}
      crawlLimit={limit}
      crawlSource={sp.c_source}
      crawlStatus={sp.c_status}
      maintenanceRuns={maintenanceRuns}
      maintenancePage={maintenancePage}
      maintenanceLimit={limit}
      maintenanceJobType={sp.m_job_type}
      maintenanceStatus={sp.m_status}
    />
  );
}

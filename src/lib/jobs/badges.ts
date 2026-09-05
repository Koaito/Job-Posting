/**
 * Helper hiển thị badge/chip cho job — khớp CSS thật, không tự chế class.
 *
 * industryClass(): khớp INDUSTRY_CLASS_MAP (mindx-jobs/helpers.py) — 6
 * giá trị matching_industry chuẩn lấy từ Scrap JD/config.py::JOB_CATEGORIES
 * (nguồn sự thật duy nhất, dùng chung cho mọi nguồn crawl). Style thật
 * (.ind-code, .ind-business-analysis...) nằm ở public/css/04-job-cards.css.
 *
 * jobStatusChipClass()/jobStatusLabel(): CSS thật chỉ định nghĩa
 * .status-Đang-tuyển / .status-Đã-đóng (04-job-cards.css) — class được
 * Flask sinh ra bằng `job.status|replace(' ', '-')` trên nhãn TIẾNG VIỆT
 * gốc. Hệ thống này (Scrap JD/FastAPI) lưu job_status bằng tiếng Anh
 * OPEN/CLOSED (JOB_STATUS_VALUES) — trước đây code cũ tự
 * `status-${job_status.toLowerCase()}` ra "status-open"/"status-closed",
 * không khớp bất kỳ selector nào nên chip mất màu hoàn toàn (chỉ còn
 * đúng phần khung/font-size chung của .status-chip). Map thủ công 2
 * giá trị ở đây thay vì lowercase trực tiếp.
 */

const INDUSTRY_CLASS_MAP: Record<string, string> = {
  Code: 'ind-code',
  'Business Analysis': 'ind-business-analysis',
  'Data Analysis': 'ind-data-analysis',
  'Data Engineer': 'ind-data-engineer',
  'Data Scientist': 'ind-data-scientist',
  'UI/UX Design': 'ind-ui-ux-design',
};

// Fallback cho industry lạ ngoài 6 giá trị chuẩn (dữ liệu cũ/nhập tay
// lệch chính tả) — xám trung tính, không mượn nhầm màu ngành khác.
const INDUSTRY_CLASS_FALLBACK = 'ind-other';

export function industryClass(value: string | null | undefined): string {
  if (!value) return INDUSTRY_CLASS_FALLBACK;
  return INDUSTRY_CLASS_MAP[value] ?? INDUSTRY_CLASS_FALLBACK;
}

export function jobStatusLabel(status: string): string {
  return status === 'OPEN' ? 'Đang tuyển' : 'Đã đóng';
}

export function jobStatusChipClass(status: string): string {
  return status === 'OPEN' ? 'status-Đang-tuyển' : 'status-Đã-đóng';
}

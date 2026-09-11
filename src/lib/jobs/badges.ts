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
 *
 * i18n (Giai đoạn 2 Phần 3, 09/2026): TÁCH RIÊNG `jobStatusLabel()` (label
 * hiển thị, đổi theo locale qua `t`, namespace `jobStatus`) khỏi
 * `jobStatusChipClass()` (class CSS, LUÔN cố định tiếng Việt, KHÔNG được
 * đổi theo locale — nếu đổi, `.status-Open` sẽ không khớp CSS thật
 * `.status-Đang-tuyển` nữa và chip mất màu y hệt bug gốc mô tả ở trên).
 * Cùng pattern đã dùng ở `partnershipPotentialLabel()`/
 * `partnershipPotentialClass()` (src/lib/companies/potential.ts).
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

// i18n (Giai đoạn 2 Phần 3, 09/2026): `matching_industry` thực tế đang
// lưu 1 trong 5 giá trị tiếng Việt của INDUSTRY_OPTIONS (JobForm.tsx/
// jobs/page.tsx, namespace dịch chung "industries") — KHÁC HẲN 6 giá
// trị INDUSTRY_CLASS_MAP ở trên (Code/Business Analysis/...). Đây là 2
// bộ giá trị không khớp nhau cho CÙNG 1 field — có vẻ là bug dữ liệu
// tồn tại từ trước (industryClass() nhiều khả năng luôn rơi về
// INDUSTRY_CLASS_FALLBACK cho job thật), nhưng KHÔNG thuộc phạm vi đợt
// dịch text này — chỉ ghi chú lại, không tự sửa logic class ở đây.
//
// industryLabel(): giống jobStatusLabel(), giá trị lạ ngoài 5 giá trị
// biết trước (dữ liệu cũ/nhập tay lệch) trả nguyên văn thay vì lỗi.
const INDUSTRY_LABEL_KEY: Record<string, string> = {
  'CNTT - Phần mềm': 'it',
  'Marketing - PR': 'marketing',
  'Kinh doanh - Bán hàng': 'sales',
  'Thiết kế - Mỹ thuật': 'design',
  Khác: 'other',
};

export function industryLabel(value: string, t: (key: string) => string): string {
  const key = INDUSTRY_LABEL_KEY[value];
  return key ? t(key) : value;
}

const JOB_STATUS_LABEL_VALUES = ['OPEN', 'CLOSED'] as const;

export function jobStatusLabel(status: string, t: (key: string) => string): string {
  return (JOB_STATUS_LABEL_VALUES as readonly string[]).includes(status) ? t(status) : status;
}

export function jobStatusChipClass(status: string): string {
  return status === 'OPEN' ? 'status-Đang-tuyển' : 'status-Đã-đóng';
}

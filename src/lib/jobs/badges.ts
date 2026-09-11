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

// BUG FIX (09/2026, phát hiện lúc dịch text — xem chat, "xử lý luôn"):
// INDUSTRY_OPTIONS ở JobForm.tsx/jobs/page.tsx trước đây dùng 5 giá trị
// TỰ BỊA ("CNTT - Phần mềm", "Marketing - PR"...) — hoàn toàn KHÔNG khớp
// INDUSTRY_CLASS_MAP ở trên lẫn matching_industry THẬT mà backend lưu.
// Đối chiếu ĐÚNG nguồn sự thật (Scrap JD/config.py::JOB_CATEGORIES +
// mindx-jobs/constants.py::INDUSTRIES bên Flask gốc — cả 2 đều thống
// nhất) xác nhận CHỈ có đúng 6 giá trị hợp lệ, chính là 6 key của
// INDUSTRY_CLASS_MAP. Vì dropdown tạo/sửa job trước đây ghi giá trị
// KHÔNG nằm trong 6 giá trị này, mọi job tạo thủ công qua form (không
// phải crawl) đều: (1) không bao giờ lên đúng màu badge ngành (luôn
// rơi vào INDUSTRY_CLASS_FALLBACK phía trên), (2) không match được vào
// bất kỳ filter/logic nào dựa theo matching_industry thật.
//
// industryLabel(): giống jobStatusLabel(), giá trị lạ ngoài 6 giá trị
// biết trước (dữ liệu cũ trước bugfix này/nhập tay lệch) trả nguyên văn
// thay vì lỗi — KHÔNG đổi INDUSTRY_CLASS_MAP hay industryClass() ở trên,
// 2 hàm đó đã đúng từ đầu.
const INDUSTRY_LABEL_KEY: Record<string, string> = {
  Code: 'code',
  'Data Analysis': 'dataAnalysis',
  'Data Engineer': 'dataEngineer',
  'Data Scientist': 'dataScientist',
  'Business Analysis': 'businessAnalysis',
  'UI/UX Design': 'uiUxDesign',
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

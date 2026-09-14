/**
 * Nguồn sự thật duy nhất cho danh sách matching_industry hợp lệ.
 *
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #1): trước đây 6 giá
 * trị này bị lặp lại ở 3 nơi theo 3 hình thức khác nhau — JobForm.tsx
 * hardcode thẳng trong JSX (6 thẻ <option>), jobs/page.tsx tự khai
 * INDUSTRY_OPTIONS riêng, và lib/jobs/badges.ts tự khai INDUSTRY_LABEL_KEY/
 * INDUSTRY_CLASS_MAP riêng — sửa/thêm 1 industry mới phải nhớ sửa đủ cả
 * 3 chỗ. Gom danh sách giá trị + map label về đây, badges.ts và mọi nơi
 * khác chỉ import lại.
 *
 * Đối chiếu nguồn sự thật ở backend: Scrap JD/config.py::JOB_CATEGORIES
 * + mindx-jobs/constants.py::INDUSTRIES (2 nguồn Flask gốc, thống nhất
 * với nhau) — CHỈ có đúng 6 giá trị dưới đây. matching_industry KHÔNG
 * nằm trong GET /enums (không phải enum cố định phía FastAPI, xem
 * comment trong actions/jobs.ts::getJobEnums), nên vẫn phải hard-code ở
 * FE thay vì đọc động — nhưng ít nhất giờ chỉ hard-code ở 1 chỗ.
 */
export const INDUSTRY_OPTIONS = [
  'Code',
  'Data Analysis',
  'Data Engineer',
  'Data Scientist',
  'Business Analysis',
  'UI/UX Design',
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];

// Key namespace i18n "industries" — dùng chung giữa JobForm.tsx,
// jobs/page.tsx (qua lib/jobs/badges.ts::industryLabel).
//
// Kiểu Record<string, string> (không phải Record<IndustryOption, string>)
// CHỦ Ý rộng hơn IndustryOption — industryLabel() (lib/jobs/badges.ts)
// nhận value là string tự do (dữ liệu cũ/nhập tay có thể lệch khỏi 6 giá
// trị chuẩn, xem comment industryLabel()), cần index bằng string bất kỳ
// mà không bị TS chặn ở bước biên dịch.
export const INDUSTRY_LABEL_KEY: Record<string, string> = {
  Code: 'code',
  'Data Analysis': 'dataAnalysis',
  'Data Engineer': 'dataEngineer',
  'Data Scientist': 'dataScientist',
  'Business Analysis': 'businessAnalysis',
  'UI/UX Design': 'uiUxDesign',
};

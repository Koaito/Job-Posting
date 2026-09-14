/**
 * Danh sách level_code hợp lệ — dùng làm:
 *  (1) fallback tĩnh trong getJobEnums() (actions/jobs.ts) khi GET
 *      /enums lỗi mạng, để JobForm vẫn còn dropdown dùng được thay vì
 *      trống trơn hoàn toàn;
 *  (2) dropdown "chọn lại level" ở ImportPanel.tsx (data-management) —
 *      nơi này KHÔNG tiện gọi GET /enums (đang xử lý resolve dữ liệu
 *      import theo dòng, không phải trang render form ban đầu có thể
 *      await enums từ page cha), nên vẫn cần 1 bản tĩnh.
 *
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #1): trước đây 2 nơi
 * trên tự khai lại đúng 7 giá trị này độc lập (LEVEL_CODE_VALUES ở
 * ImportPanel.tsx, level_code trong FALLBACK_JOB_ENUMS ở actions/jobs.ts)
 * — gom về đây làm nguồn sự thật duy nhất cho phần TĨNH (bản động vẫn
 * là GET /enums qua getJobEnums(), xem comment ở actions/jobs.ts).
 *
 * Đối chiếu nguồn sự thật ở backend:
 * tests/test_stats.py::test_get_enums_matches_constants_module (Scrap
 * JD) — LEVEL_CODE_VALUES (constants.py).
 */
export const LEVEL_CODE_VALUES = [
  'Intern',
  'Fresher',
  'Junior',
  'Middle',
  'Senior',
  'Lead',
  'Manager',
] as const;

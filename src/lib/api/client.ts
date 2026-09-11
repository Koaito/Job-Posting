/**
 * API Client utilities for calling Server Actions
 * All API calls go through Next.js Server Actions (BFF pattern)
 * NEVER expose API keys to browser!
 */

import { cookies } from 'next/headers';
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE, isValidLocale, type Locale } from '@/i18n/config';
import errorsVi from '@/messages/errors.vi.json';
import errorsEn from '@/messages/errors.en.json';

/**
 * BUG FIX (audit 09/2026 #8): "process.env.CRAWLER_API_KEY!" (non-null
 * assertion) lặp lại ở 11 chỗ rải rác trong actions/auth.ts,
 * dashboard.ts, jobs.ts — nếu thiếu biến môi trường CRAWLER_API_KEY,
 * "!" chỉ ép kiểu cho TypeScript, KHÔNG kiểm tra thật ở runtime: header
 * "X-API-Key" sẽ gửi literal string "undefined" lên backend thay vì
 * báo lỗi rõ ràng, khiến backend trả 401/403 khó hiểu (không phải do
 * sai auth token, mà do thiếu hẳn API key) — rất khó debug từ phía FE.
 *
 * Đối chiếu Flask gốc (backend_auth.py::_headers()): bản gốc LUÔN
 * check "if not CRAWLER_API_KEY" TRƯỚC khi build headers, raise
 * BackendAuthError("Server chưa cấu hình CRAWLER_API_KEY...") rõ ràng
 * ngay tại thời điểm đó — KHÔNG bao giờ để lọt giá trị rỗng/undefined
 * vào request thật. Hàm dưới đây khôi phục đúng hành vi này, gom logic
 * check về 1 chỗ dùng chung thay vì lặp lại "!" ở 11 nơi.
 *
 * CHỦ Ý check ở RUNTIME (bên trong hàm, gọi mỗi lần cần build headers)
 * chứ KHÔNG check ngay lúc import module — "next build" cũng import
 * các Server Action module để phân tích route ngay cả khi build server
 * chưa set biến môi trường thật (giá trị thật thường chỉ có ở
 * deploy/runtime environment, vd Vercel/Render dashboard) — check lúc
 * import sẽ làm "next build" crash oan dù chưa có request nào thực sự
 * cần gọi backend.
 */
export function getApiKey(): string {
  const apiKey = process.env.CRAWLER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Server chưa cấu hình CRAWLER_API_KEY (biến môi trường) nên không thể gọi backend.'
    );
  }

  return apiKey;
}

/**
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #2): "process.env.FASTAPI_URL"
 * (không check) từng bị khai riêng ở 3 chỗ khác nhau — client.ts, đây,
 * VÀ actions/dashboard.ts — mỗi nơi tự đặt tên biến API_BASE, KHÔNG có
 * bước validate như getApiKey() ở trên. Thiếu biến môi trường FASTAPI_URL
 * không hề báo lỗi rõ ràng ngay: `${API_BASE}/auth/login` âm thầm build
 * ra URL `undefined/auth/login`, fetch() vẫn chạy (ném lỗi mạng khó hiểu
 * dạng "Failed to parse URL" hoặc DNS lookup fail cho host "undefined")
 * thay vì báo thẳng "thiếu FASTAPI_URL" — đúng loại bug mà getApiKey()
 * từng được viết ra để tránh, nhưng chưa áp dụng nhất quán cho biến môi
 * trường quan trọng không kém này.
 *
 * Cùng nguyên tắc CHỦ Ý check ở RUNTIME (gọi bên trong hàm, không phải
 * hằng số cấp module) như getApiKey() — "next build" cũng import các
 * Server Action module để phân tích route ngay cả khi build server chưa
 * set biến môi trường thật, check ở thời điểm import sẽ làm "next build"
 * crash oan.
 */
export function getApiBase(): string {
  const apiBase = process.env.FASTAPI_URL;

  if (!apiBase) {
    throw new Error(
      'Server chưa cấu hình FASTAPI_URL (biến môi trường) nên không thể gọi backend.'
    );
  }

  return apiBase;
}

/**
 * REFACTOR (09/2026): gom về 1 chỗ dùng chung — trước đây hàm này bị
 * copy-paste y hệt ở 7 file khác nhau trong app/actions/ (audit.ts,
 * companies.ts, contacts.ts, crawl.ts, jobs.ts, me.ts, messages.ts).
 * Mỗi module mới (import-export, staff-activity...) trước đây sẽ phải
 * copy thêm 1 lần nữa — nay chỉ cần import từ đây.
 *
 * Trả về headers chuẩn cho request JSON: X-API-Key + Content-Type +
 * Authorization (nếu có access_token trong cookie).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * Biến thể cho request multipart/form-data (upload file, vd POST
 * /me/applications) — KHÔNG set Content-Type thủ công. fetch() tự sinh
 * header "Content-Type: multipart/form-data; boundary=..." đúng khi body
 * là FormData — set thủ công "multipart/form-data" (thiếu boundary) sẽ
 * khiến backend không parse được form, luôn trả 422.
 *
 * Trước đây chỉ có ở actions/me.ts (getAuthHeadersForUpload), nay dùng
 * chung được cho mọi module có upload (vd Import/Export CSV sắp tới).
 */
export async function getAuthHeadersForUpload(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): trước đây KHÔNG có lớp
 * "fetch tới backend" dùng chung — mỗi Server Action (12 file) tự lặp lại
 * y hệt khối AbortController + setTimeout(30000) + try/finally clearTimeout
 * + check response.ok + parse lỗi + console.error + catch network error
 * (49 lần trên 8 file: audit.ts, companies.ts, contacts.ts, crawl.ts,
 * import-export.ts, jobs.ts, me.ts, messages.ts). Đồng thời CHỈ
 * getCurrentUser() (actions/auth.ts) có auto-refresh token khi 401 — mọi
 * action ghi dữ liệu khác (createJob, createCompany, sendMessage...) fail
 * thẳng 401 nếu access_token hết hạn giữa lúc thao tác, dù refresh_token
 * vẫn còn hợp lệ.
 *
 * apiFetchRaw()/apiFetch() dưới đây gộp cả 2 việc về 1 chỗ:
 *   - Tự build headers (X-API-Key/Authorization, JSON hoặc multipart).
 *   - Tự set timeout qua AbortSignal.timeout() (thay AbortController +
 *     setTimeout thủ công — jest.setup.js đã polyfill cho môi trường test).
 *   - Tự thử refresh access_token đúng 1 lần khi gặp 401 với
 *     error_code === "token_expired" (dùng LẠI đúng refreshAccessToken()/
 *     setAuthCookies() bên dưới — cùng 1 nguồn logic với getCurrentUser(),
 *     không viết lại lần 2), rồi gọi lại request gốc với token mới.
 *   - Formatting lỗi dùng chung formatErrorDetail() (bản đầy đủ nhất, có
 *     xử lý "loc" — trước đây jobs.ts có bản này, 6 file khác dùng bản cũ
 *     hơn thiếu tính năng, xem TODO mục 4 trong plan_nextjs.md).
 */

// REFACTOR (09/2026, "Đánh giá kiến trúc" #2): const API_BASE cấp module
// đã bị xoá — dùng getApiBase() (khai ở trên, cạnh getApiKey()) để có
// validate runtime rõ ràng thay vì âm thầm interpolate "undefined" vào
// URL khi thiếu biến môi trường FASTAPI_URL.

/**
 * Chuẩn hoá "detail" lỗi từ FastAPI về 1 chuỗi dễ đọc — 3 dạng thật có thể
 * gặp: string đơn giản (raise thủ công trong router), mảng object
 * {loc, msg, type} (Pydantic tự validate, extra="forbid"/min_length...),
 * hoặc object {error_code, message} (api/deps.py — các lỗi auth: xem
 * BUG FIX bên dưới). Bản đầy đủ nhất trong 7 bản từng bị khai trùng lặp —
 * có xử lý "loc" để biết lỗi thuộc field nào (trước đây chỉ jobs.ts có,
 * 6 file khác thiếu).
 *
 * BUG FIX (Giai đoạn 0, 09/2026): trước đây nhánh object chỉ
 * `JSON.stringify(detail)` — 5 chỗ raise trong api/deps.py đã trả
 * `{"error_code": "token_expired", "message": "..."}` dạng object, nên
 * user thấy nguyên chuỗi JSON thô (`{"error_code":"token_expired",...}`)
 * trên UI thay vì message tiếng Việt, ở 1 số lỗi auth hiếm gặp (session
 * bị thay thế/hết hạn). Sửa: đọc `detail.message` trước nếu có — đây
 * cũng chính là điểm cắm sẵn cho tầng dịch theo `error_code` ở Giai đoạn
 * 3 (i18n) sau này. Object không có `message` dạng string (shape lạ,
 * chưa từng gặp) mới rơi về `JSON.stringify()` như cũ — thà hiện JSON
 * thô còn hơn nuốt lỗi thành thông báo chung chung không debug được.
 */
/**
 * Đọc cookie "locale" (dùng chung tên với LOCALE_COOKIE_NAME ở
 * src/i18n/config.ts) — KHÔNG import getRequestConfig()/next-intl ở đây
 * vì đây là code chạy trong Server Actions thuần (không phải trong 1
 * request render của next-intl), gọi trực tiếp `cookies()` cho gọn,
 * cùng 1 nguồn cookie với src/i18n/request.ts nên luôn đồng bộ với
 * lựa chọn của LanguageToggle.tsx.
 */
async function getErrorLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isValidLocale(raw) ? raw : DEFAULT_LOCALE;
}

const ERROR_TRANSLATIONS: Record<Locale, Record<string, string>> = {
  vi: errorsVi as Record<string, string>,
  en: errorsEn as Record<string, string>,
};

/**
 * BUG FIX (i18n audit 09/2026, Giai đoạn 2 Phần 3): 2 chỗ dưới đây
 * (`formatErrorDetail()` fallback cuối cùng khi `detail` không có shape
 * quen thuộc, và giá trị mặc định của `fallbackError` trong `apiFetch()`)
 * trước đây hard-code "Có lỗi xảy ra" — LUÔN tiếng Việt bất kể locale
 * đang chọn là "en", khác hẳn mọi message lỗi khác trong app (đều đã đi
 * qua `t()`/`resolveErrorMessage()`). Dùng chung 1 map nhỏ + `getErrorLocale()`
 * đã có sẵn ở trên cho nhất quán, khớp giá trị đã dùng ở `common.genericError`
 * (src/messages/vi.json / en.json) thay vì tự bịa câu khác.
 */
const GENERIC_ERROR_BY_LOCALE: Record<Locale, string> = {
  vi: 'Có lỗi xảy ra',
  en: 'Something went wrong',
};

async function getGenericErrorMessage(): Promise<string> {
  const locale = await getErrorLocale();
  return GENERIC_ERROR_BY_LOCALE[locale];
}

/**
 * Cùng đợt fix trên: lỗi network riêng của `apiFetch()` (fetch tự throw,
 * KHÔNG phải backend trả !ok) cũng hard-code "Network error" tiếng Anh
 * bất kể locale. Khớp câu chữ đã dùng ở `common.networkError`
 * (vi.json/en.json) — cùng 1 khái niệm "không kết nối được server" mà
 * CompanyForm.tsx/JobForm.tsx phía client đã hiển thị qua `tc('networkError')`.
 */
const NETWORK_ERROR_BY_LOCALE: Record<Locale, string> = {
  vi: 'Không thể kết nối với server',
  en: 'Could not connect to the server',
};

async function getNetworkErrorMessage(): Promise<string> {
  const locale = await getErrorLocale();
  return NETWORK_ERROR_BY_LOCALE[locale];
}

/**
 * Cơ chế template biến số cho error_code ĐỘNG (Giai đoạn 3, đợt "cơ chế
 * template biến số", 09/2026, phần 1/2).
 *
 * Vấn đề: ~50 error_code còn lại (sau 85 mã tĩnh đã dịch ở 3 đợt trước)
 * có message do backend chèn giá trị runtime qua f-string (UUID nhập
 * sai, số lượng, danh sách hợp lệ...) — bảng tra tĩnh `errors.en.json`
 * không dịch được vì không biết trước giá trị runtime là gì.
 *
 * Giải pháp: KHÔNG đổi backend (backend vẫn chỉ trả 1 chuỗi `message`
 * đã ghép sẵn, không tách riêng "template" + "params" — đổi shape đó là
 * việc lớn hơn nhiều, đụng cả FastAPI lẫn Flask, không cần thiết cho
 * mục tiêu hiện tại). Thay vào đó: mỗi "handler" ở đây tự dùng RegExp để
 * BÓC lại giá trị runtime từ chính `message` tiếng Việt đã nhận, rồi ráp
 * vào template tiếng Anh tương ứng. Nếu message không khớp đúng pattern
 * kỳ vọng (vd backend đổi câu chữ sau này, hoặc 1 vài raise cá biệt có
 * thêm câu hướng dẫn phía sau — xem `JOB_COMPANY_ID_INVALID_UUID` ở
 * `api/routers/jobs.py`, message dài hơn các anh em cùng họ vì có thêm
 * đoạn "kiểm tra lại đã thay đúng company_id THẬT...") → `translate()`
 * trả `null`, code gọi tự fallback về message tiếng Việt gốc — AN TOÀN,
 * không bao giờ hiện `undefined`/lỗi parse ra UI, đúng nguyên tắc xuyên
 * suốt Giai đoạn 3.
 *
 * Phần 1/2 (đợt này): xử lý TOÀN BỘ họ `*_invalid_uuid` (21 error_code,
 * xem `api/error_codes.py`) bằng ĐÚNG 1 handler chung — cả họ này dùng
 * chung 1 khuôn câu `f"{field} '{value}' không đúng định dạng UUID."`
 * (chỉ khác tên field: job_id/company_id/created_by/run_id/...), không
 * cần khai 21 template riêng lẻ. Phần 2/2 (đợt sau) sẽ xử lý các nhóm
 * còn lại (status_invalid có danh sách hợp lệ, message có số lượng...),
 * mỗi nhóm có khuôn câu khác nhau nên cần handler riêng.
 */
interface DynamicErrorHandler {
  /** Handler này có áp dụng cho error_code này không (theo tên/hậu tố). */
  appliesTo: (errorCode: string) => boolean;
  /** Bóc giá trị runtime từ message vi + ráp template en. null = không khớp pattern, fallback về message gốc. */
  translate: (message: string) => string | null;
}

/**
 * Nhiều handler bên dưới cần hiện lại 1 danh sách giá trị hợp lệ mà
 * backend chèn vào message dạng repr Python (vd `sorted(_VALID_...)`
 * -> `"['CREATE', 'UPDATE']"`, có khi là set -> `"{'a', 'b'}"`). Không
 * cần parse đúng kiểu Python thật — chỉ cần bỏ dấu ngoặc
 * vuông/nhọn+nháy rồi nối lại bằng ", " cho dễ đọc ở bản tiếng Anh.
 */
function prettifyPythonListRepr(raw: string): string {
  return raw
    .replace(/^[[{]|[\]}]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .join(', ');
}

const DYNAMIC_ERROR_HANDLERS: DynamicErrorHandler[] = [
  {
    // 21 error_code, vd: job_job_id_invalid_uuid, audit_log_actor_id_invalid_uuid,
    // maintenance_run_id_invalid_uuid... — xem đầy đủ trong api/error_codes.py
    // (grep "_INVALID_UUID"). KHÔNG áp dụng cho JOB_COMPANY_ID_INVALID_UUID dù
    // tên khớp hậu tố, vì message thật của riêng nó dài hơn (có thêm câu hướng
    // dẫn) nên sẽ không khớp regex bên dưới và tự fallback — không cần loại trừ
    // thủ công.
    appliesTo: (errorCode) => errorCode.endsWith('_invalid_uuid'),
    translate: (message) => {
      const match = /^(\w+) '(.*)' không đúng định dạng UUID\.$/.exec(message);
      if (!match) return null;
      const [, field, value] = match;
      return `${field}: '${value}' is not a valid UUID.`;
    },
  },
  /**
   * Phần 2/2, batch 1 (09/2026): 5 error_code cùng khuôn "X 'value' không
   * hợp lệ — có sẵn: [danh sách]" (audit_log/contact/crawl/maintenance).
   */
  {
    appliesTo: (errorCode) =>
      [
        'audit_log_action_type_invalid',
        'audit_log_entity_type_invalid',
        'contact_contact_status_invalid',
        'crawl_status_invalid',
        'maintenance_status_invalid',
      ].includes(errorCode),
    translate: (message) => {
      const match = /^(\w+) '(.*)' không hợp lệ — có sẵn: (\[.*\]|\{.*\})$/.exec(message);
      if (!match) return null;
      const [, field, value, list] = match;
      return `${field}: '${value}' is not valid — available: ${prettifyPythonListRepr(list)}`;
    },
  },
  /**
   * 2 error_code khuôn "X 'value' không tồn tại. Có sẵn: [danh sách]"
   * (khác `_hợp lệ_` ở trên: đây là "not found" cho 1 định danh không
   * tồn tại, không phải "invalid value").
   */
  {
    appliesTo: (errorCode) => ['crawl_not_found', 'maintenance_job_not_found'].includes(errorCode),
    translate: (message) => {
      const match = /^(\w+) '(.*)' không tồn tại\. Có sẵn: (\[.*\]|\{.*\})$/.exec(message);
      if (!match) return null;
      const [, field, value, list] = match;
      return `${field}: '${value}' not found. Available: ${prettifyPythonListRepr(list)}`;
    },
  },
  /**
   * crawl_not_found_2: giống họ "not tồn tại" ở trên nhưng có 2 giá trị
   * (category phụ thuộc source) — riêng 1 handler vì shape câu khác.
   */
  {
    appliesTo: (errorCode) => errorCode === 'crawl_not_found_2',
    translate: (message) => {
      const match = /^Category '(.*)' không tồn tại cho source '(.*)'\. Có sẵn: (\[.*\])$/.exec(message);
      if (!match) return null;
      const [, category, source, list] = match;
      return `Category '${category}' not found for source '${source}'. Available: ${prettifyPythonListRepr(list)}`;
    },
  },
  /**
   * 5 error_code khuôn "field 'value' + 1 câu hậu tố CỐ ĐỊNH riêng của
   * từng error_code" — mỗi error_code 1 template vì hậu tố khác nhau
   * hoàn toàn, nhưng đều chỉ có ĐÚNG 1 giá trị động cần bóc nên gộp
   * chung 1 mảng cấu hình cho gọn thay vì lặp lại y hệt cấu trúc handler
   * 5 lần.
   */
  ...(
    [
      {
        code: 'import_entity_type_buoc_chon_cong',
        pattern: /^entity_type '(.*)' không có bước chọn công ty — chỉ job\/contact\.$/,
        template: (v: string) => `entity_type: '${v}' has no company-selection step — only job/contact support it.`,
      },
      {
        code: 'import_entity_type_filter_status',
        pattern: /^entity_type '(.*)' không có filter status\.$/,
        template: (v: string) => `entity_type: '${v}' does not support the status filter.`,
      },
      {
        code: 'import_entity_type_invalid',
        pattern: /^entity_type '(.*)' không hợp lệ — chỉ nhận job\/company\/contact\.$/,
        template: (v: string) => `entity_type: '${v}' is invalid — only job/company/contact are accepted.`,
      },
      {
        code: 'job_company_not_found',
        pattern: /^company_id '(.*)' không tồn tại — tạo công ty trước bằng POST \/companies\.$/,
        template: (v: string) => `company_id: '${v}' does not exist — create the company first via POST /companies.`,
      },
      {
        code: 'profile_job_trang_thai_ung_tuyen',
        pattern: /^Job đang ở trạng thái '(.*)', không thể ứng tuyển\.$/,
        template: (v: string) => `This job is in status '${v}' and can't be applied to.`,
      },
    ] satisfies { code: string; pattern: RegExp; template: (v: string) => string }[]
  ).map(({ code, pattern, template }) => ({
    appliesTo: (errorCode: string) => errorCode === code,
    translate: (message: string) => {
      const match = pattern.exec(message);
      return match ? template(match[1]) : null;
    },
  })),
  /**
   * Phần 2/2, batch 2 (09/2026, đợt cuối cùng của "cơ chế template biến
   * số") — 11 error_code còn lại, mỗi mã 1 khuôn câu riêng (nhiều biến
   * hơn nhóm batch 1, nên template nhận thẳng `RegExpExecArray` thay vì
   * ép cứng đúng 1 tham số string như mảng ở trên).
   *
   * Việc dịch xong batch này đưa Giai đoạn 3 lên 130/135 (85 tĩnh + 45
   * động qua template) tại thời điểm đó — 5 mã còn lại lúc này bị đánh
   * giá KHÔNG dịch được vì `message` = `str(exc)` (text lỗi Python thô,
   * không có khuôn cố định) hoặc đã là tiếng Anh sẵn ở backend
   * (`import_internal_error`, bug riêng). ĐÍNH CHÍNH (Đợt 7, 09/2026):
   * nhận định "str(exc) = không có khuôn cố định" chỉ ĐÚNG cho 1/5 mã
   * sau khi rà lại trực tiếp source backend — 3/5 mã còn lại thật ra có
   * khuôn câu cố định (đếm được 1-3 f-string/hàm), đã dịch ở Đợt 7 bên
   * dưới; `import_internal_error` đã sửa tận gốc ở backend, chuyển
   * thành mã tĩnh (xem `errors.en.json`). Giai đoạn 3 hiện đạt 134/135
   * — chỉ còn đúng `import_row_resolution_failed` (17 khuôn câu, có
   * lồng message tự do từ tầng validate khác) là thật sự bất khả thi an
   * toàn — xem plan_language_polish.md.
   */
  ...(
    [
      {
        code: 'auth_locked_2',
        pattern: /^Sai mật khẩu quá (\d+) lần liên tiếp — tài khoản bị khoá tạm (\d+) phút\.$/,
        template: (m: RegExpExecArray) =>
          `Wrong password too many times in a row (${m[1]}x) — account temporarily locked for ${m[2]} minutes.`,
      },
      {
        // Khác crawl_not_found_2 (category CÓ nháy đơn) — {unknown} ở
        // đây KHÔNG có nháy quanh, vì bản thân nó đã là 1 repr
        // list/set (nhiều category sai cùng lúc) chứ không phải 1 chuỗi
        // đơn -> cũng cần prettify qua prettifyPythonListRepr().
        code: 'crawl_not_found_3',
        pattern: /^Category (\[.*\]|\{.*\}) không tồn tại cho source '(.*)'\. Có sẵn: (\[.*\])$/,
        template: (m: RegExpExecArray) =>
          `Category ${prettifyPythonListRepr(m[1])} not found for source '${m[2]}'. Available: ${prettifyPythonListRepr(m[3])}`,
      },
      {
        code: 'import_preview_id_thuoc_entity_type',
        pattern: /^preview_id này thuộc entity_type '(.*)', không phải '(.*)'\.$/,
        template: (m: RegExpExecArray) => `This preview_id belongs to entity_type '${m[1]}', not '${m[2]}'.`,
      },
      {
        code: 'import_row_index_preview',
        pattern: /^row_index (\d+) không có trong preview này\.$/,
        template: (m: RegExpExecArray) => `row_index ${m[1]} is not in this preview.`,
      },
      {
        // valid_values có thể là repr list/tuple (`"['a', 'b']"`) hoặc
        // 1 chuỗi đơn tuỳ nơi gọi — prettifyPythonListRepr() bỏ qua an
        // toàn (trả nguyên văn) nếu không có dấu ngoặc vuông/nhọn để bóc.
        code: 'import_status_invalid',
        pattern: /^status '(.*)' không hợp lệ cho '(.*)' — chỉ nhận (.*)\.$/,
        template: (m: RegExpExecArray) =>
          `status: '${m[1]}' is not valid for '${m[2]}' — only ${prettifyPythonListRepr(m[3])} accepted.`,
      },
      {
        code: 'maintenance_after_id_ung_run_id',
        pattern: /^after_id '(.*)' \(ứng với run_id '(.*)'\) phải là số nguyên >= 0\.$/,
        template: (m: RegExpExecArray) => `after_id '${m[1]}' (for run_id '${m[2]}') must be an integer >= 0.`,
      },
      {
        code: 'maintenance_dry_run_check_deadline_only',
        pattern: /^'dry_run'\/'check_deadline_only' chỉ áp dụng cho job_type '(.*)', không áp dụng cho '(.*)'\.$/,
        template: (m: RegExpExecArray) =>
          `'dry_run'/'check_deadline_only' only applies to job_type '${m[1]}', not to '${m[2]}'.`,
      },
      {
        code: 'maintenance_required',
        pattern:
          /^job_type '(.*)' gọi Tavily\/Gemini \(tốn phí thật\) — bắt buộc truyền 'limit' khi kích hoạt từ web, không được để trống \(tránh chạy hết toàn bộ company chưa có dữ liệu\)\.$/,
        template: (m: RegExpExecArray) =>
          `job_type: '${m[1]}' calls Tavily/Gemini (real cost) — 'limit' is required when triggered from the web; it can't be left empty (to avoid running against every company with no data).`,
      },
      {
        code: 'maintenance_run_ids_muc_after_ids',
        pattern: /^run_ids \((\d+) mục\) và after_ids \((\d+) mục\) phải có CÙNG SỐ LƯỢNG, khớp theo thứ tự\.$/,
        template: (m: RegExpExecArray) =>
          `run_ids (${m[1]} items) and after_ids (${m[2]} items) must have the SAME LENGTH, matched by order.`,
      },
      {
        code: 'message_ban_qua_nhieu_yeu_cau',
        pattern:
          /^Bạn đang có quá nhiều yêu cầu nhắn tin đang chờ xử lý \(tối đa (\d+) cùng lúc\)\. Vui lòng đợi SS phản hồi trước khi gửi yêu cầu mới\.$/,
        template: (m: RegExpExecArray) =>
          `You have too many pending message requests (max ${m[1]} at a time). Please wait for the SS to respond before sending a new request.`,
      },
      {
        code: 'message_yeu_cau_truoc_choi_vui',
        pattern: /^Yêu cầu trước đã bị từ chối — vui lòng thử lại sau (\d+) ngày kể từ lúc bị từ chối\.$/,
        template: (m: RegExpExecArray) =>
          `Your previous request was declined — please try again ${m[1]} days after it was declined.`,
      },
    ] satisfies { code: string; pattern: RegExp; template: (m: RegExpExecArray) => string }[]
  ).map(({ code, pattern, template }) => ({
    appliesTo: (errorCode: string) => errorCode === code,
    translate: (message: string) => {
      const match = pattern.exec(message);
      return match ? template(match) : null;
    },
  })),
  /**
   * Đợt 7 (09/2026) — 3/5 mã "KHÔNG dịch được" còn lại ở Đợt 6 (xem
   * comment phía trên, "5 mã KHÔNG dịch được bằng cơ chế này"). Rà lại
   * TRỰC TIẾP source thật ở backend (repo Scrap_JD, không phải Next.js
   * này) cho từng mã — hoá ra `message = str(exc)` KHÔNG có nghĩa "text
   * tuỳ ý không đoán trước được" như nhận định ban đầu trong
   * plan_language_polish.md, mà với 3/5 mã dưới đây, hàm raise ra
   * `exc` chỉ có ĐÚNG 1-3 f-string CỐ ĐỊNH trong code (đếm được, không
   * phải input người dùng tự do) — viết regex an toàn y hệt các mã khác
   * ở Đợt 4-6. 2 mã còn lại (`import_row_resolution_failed` — 17 f-string
   * khác nhau, 2 trong số đó LỒNG message tự do từ tầng validate field
   * riêng biệt; `import_internal_error` — ĐÃ sửa ở backend, chuyển sang
   * mã tĩnh, xem `errors.en.json`) — xem ghi chú Đợt 6, thật sự không có
   * khuôn cố định, không đổi ở đợt này.
   */
  {
    // api/services/preview_manager.py::apply_field_fix() — CHỈ 1 raise
    // ValueError duy nhất trong hàm này (row_index không có trong
    // preview) — cùng shape message với `import_row_index_preview`
    // (route /rows/{row_index}/resolve-company) nhưng KHÁC error_code
    // (route /rows/{row_index}/verify-field), nên cần khai riêng ở đây
    // dù regex giống hệt.
    appliesTo: (errorCode) => errorCode === 'import_field_verify_failed',
    translate: (message) => {
      const match = /^row_index (\d+) không có trong preview này\.$/.exec(message);
      if (!match) return null;
      return `row_index ${match[1]} is not in this preview.`;
    },
  },
  {
    // api/services/preview_manager.py::resolve_company_selection() —
    // ĐÚNG 3 raise ValueError trong hàm này (2 check phòng thủ lặp lại
    // check đã có ở router — router validate trước khi gọi hàm này nên
    // hiếm khi thật sự bay tới đây — + 1 case thật "company vừa bị xoá
    // giữa chừng"). Thử lần lượt cả 3 pattern, pattern nào khớp dùng
    // pattern đó.
    appliesTo: (errorCode) => errorCode === 'import_resolve_company_failed',
    translate: (message) => {
      const entityTypeMatch =
        /^entity_type '(.*)' không có bước chọn công ty — chỉ job\/contact\.$/.exec(message);
      if (entityTypeMatch) {
        return `entity_type: '${entityTypeMatch[1]}' has no company-selection step — only job/contact support it.`;
      }
      const rowIndexMatch = /^row_index (\d+) không có trong preview này\.$/.exec(message);
      if (rowIndexMatch) {
        return `row_index ${rowIndexMatch[1]} is not in this preview.`;
      }
      // company_id chèn qua repr Python (!r) — luôn có nháy đơn quanh
      // giá trị vì company_id là str.
      const companyIdMatch = /^company_id '(.*)' không tồn tại\.$/.exec(message);
      if (companyIdMatch) {
        return `company_id: '${companyIdMatch[1]}' does not exist.`;
      }
      return null;
    },
  },
  {
    // api/storage.py::upload_cv() — ĐÚNG 2 raise RuntimeError trong hàm
    // này: (1) thiếu cấu hình Supabase (KHÔNG có biến động, message tĩnh
    // 100%), (2) Supabase trả lỗi HTTP (1 biến: status code).
    appliesTo: (errorCode) => errorCode === 'profile_cv_upload_failed',
    translate: (message) => {
      if (message === 'Chưa cấu hình SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trên server.') {
        return 'The server is not configured with SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.';
      }
      const httpMatch = /^Lỗi tải file lên storage \(HTTP (\d+)\)$/.exec(message);
      if (httpMatch) {
        return `Error uploading the file to storage (HTTP ${httpMatch[1]}).`;
      }
      return null;
    },
  },
];


function translateDynamicErrorMessage(errorCode: string, message: string): string | null {
  for (const handler of DYNAMIC_ERROR_HANDLERS) {
    if (handler.appliesTo(errorCode)) {
      const translated = handler.translate(message);
      if (translated != null) return translated;
    }
  }
  return null;
}

/**
 * Tra `error_code` trong bảng dịch theo `locale` (Giai đoạn 3, 09/2026).
 *
 * Nguyên tắc (đúng theo plan_language_polish.md A.1/A.3.2):
 * - `locale === "vi"`: LUÔN dùng thẳng `fallbackMessage` (message gốc từ
 *   backend) — đây vốn đã là tiếng Việt chuẩn, không cần tra bảng
 *   `errors.vi.json` (file đó chỉ giữ để dự phòng override sau này, xem
 *   comment trong file).
 * - `locale === "en"`: tra `error_code` trong `errors.en.json` (nhóm mã
 *   TĨNH) trước; nếu không có, thử `DYNAMIC_ERROR_HANDLERS` (nhóm mã
 *   ĐỘNG, xem comment ở trên); nếu cả 2 đều không khớp, fallback về
 *   `fallbackMessage` (tiếng Việt gốc), KHÔNG hiện lỗi trắng/"undefined".
 *   Đây là hành vi CHỦ Ý theo plan (Giai đoạn 3.2: "không dịch hết cùng
 *   lúc").
 */
function resolveErrorMessage(errorCode: string, fallbackMessage: string, locale: Locale): string {
  if (locale === 'vi') return fallbackMessage;
  const staticTranslation = ERROR_TRANSLATIONS[locale]?.[errorCode];
  if (staticTranslation != null) return staticTranslation;
  const dynamicTranslation = translateDynamicErrorMessage(errorCode, fallbackMessage);
  if (dynamicTranslation != null) return dynamicTranslation;
  return fallbackMessage;
}

export async function formatErrorDetail(detail: unknown): Promise<string> {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc =
            'loc' in item && Array.isArray((item as { loc?: unknown[] }).loc)
              ? (item as { loc: unknown[] }).loc.filter((p) => p !== 'body').join('.')
              : '';
          const msg = String((item as { msg: unknown }).msg);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return typeof item === 'string' ? item : JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message;
    const errorCode = (detail as { error_code?: unknown }).error_code;
    if (typeof message === 'string') {
      if (typeof errorCode === 'string') {
        const locale = await getErrorLocale();
        return resolveErrorMessage(errorCode, message, locale);
      }
      return message;
    }
    return JSON.stringify(detail);
  }
  return getGenericErrorMessage();
}

/**
 * Khớp AccessTokenOut (schemas/auth.py) — response của POST /auth/refresh.
 * LƯU Ý: refresh_token cũng bị đổi mới (rotation) mỗi lần refresh — token
 * cũ bị thu hồi ngay, không dùng lại được.
 */
export interface RefreshTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/**
 * Kết quả refresh — discriminated union để nơi gọi tự quyết định đúng
 * hành vi cho từng trường hợp (chuyển từ actions/auth.ts về đây để
 * apiFetchRaw() dùng lại được đúng 1 nguồn logic, không viết lại lần 2):
 * - { ok: true, tokens } — refresh thành công.
 * - { ok: false, reason: 'invalid' } — backend xác nhận refresh_token
 *   không dùng được nữa -> nơi gọi nên xoá cookie, coi như hết phiên.
 * - { ok: false, reason: 'network_error' } — không xác định được, có thể
 *   refresh_token vẫn hợp lệ -> KHÔNG xoá cookie, thử lại request kế tiếp.
 */
export type RefreshResult =
  | { ok: true; tokens: RefreshTokens }
  | { ok: false; reason: 'invalid' | 'network_error' };

/**
 * Đổi refresh_token lấy 1 cặp token mới — POST /auth/refresh. KHÔNG throw,
 * luôn trả RefreshResult. Chuyển từ actions/auth.ts::refreshAccessToken()
 * về đây (09/2026) để apiFetchRaw() (dùng cho MỌI action ghi dữ liệu) và
 * getCurrentUser() (actions/auth.ts) dùng chung đúng 1 bản, thay vì để
 * getCurrentUser() là nơi DUY NHẤT biết refresh — xem "Đánh giá kiến
 * trúc" #2 trong plan_nextjs.md.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey(),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    console.error('Refresh access token network error:', error);
    return { ok: false, reason: 'network_error' };
  }

  if (!response.ok) {
    // Backend đã trả lời rõ ràng (401 invalid/expired/revoked, 429, 5xx...)
    // — coi mọi !ok non-network-error là 'invalid' để giữ logic đơn giản,
    // giống nguyên bản ở actions/auth.ts.
    return { ok: false, reason: 'invalid' };
  }

  try {
    const tokens: RefreshTokens = await response.json();
    return { ok: true, tokens };
  } catch (error) {
    console.error('Refresh access token: invalid JSON response', error);
    return { ok: false, reason: 'network_error' };
  }
}

/**
 * Ghi cookie access_token + refresh_token — dùng chung cho login(),
 * auto-refresh trong getCurrentUser() (actions/auth.ts), VÀ auto-refresh
 * trong apiFetchRaw() bên dưới (mọi action ghi dữ liệu khác). Chuyển từ
 * actions/auth.ts về đây (09/2026) cùng lý do với refreshAccessToken().
 */
export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();

  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-serializable (auto JSON.stringify) hoặc FormData khi isUpload=true. */
  body?: unknown;
  /**
   * true (mặc định): gắn Authorization: Bearer (nếu có access_token) +
   * X-API-Key qua getAuthHeaders(), và BẬT auto-refresh khi 401
   * token_expired. false: CHỈ gắn X-API-Key (route public, không cần JWT
   * — vd GET /jobs, GET /sources).
   */
  auth?: boolean;
  /** true: dùng getAuthHeadersForUpload() (không set Content-Type thủ
   * công) + body là FormData, không JSON.stringify. */
  isUpload?: boolean;
  cache?: RequestCache;
  /** Mặc định 30000ms. Một số route poll nhanh (crawl status/logs) dùng
   * 15000ms — xem actions/crawl.ts. */
  timeoutMs?: number;
}

/**
 * Lớp fetch-tới-backend dùng chung — trả thẳng Response (đã qua auto-
 * refresh-on-401 nếu auth=true), để action nào có nhu cầu đọc response
 * đặc biệt (binary/arrayBuffer ở import-export.ts, phân biệt 201 vs 202
 * ở messages.ts::sendMessage) tự xử lý tiếp phần thân response, KHÔNG
 * phải tự viết lại timeout/header/refresh.
 *
 * LƯU Ý: nếu fetch() throw (lỗi mạng/DNS/timeout), hàm này THROW LUÔN
 * (không tự catch) — nơi gọi (apiFetch() bên dưới, hoặc action tự viết
 * try/catch riêng) chịu trách nhiệm bắt lỗi này, giữ đúng convention
 * try/catch đã có sẵn khắp actions/*.ts.
 */
export async function apiFetchRaw(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { method = 'GET', body, auth = true, isUpload = false, cache, timeoutMs = 30000 } = options;

  const url = `${getApiBase()}${path}`;

  const buildHeaders = (): Promise<Record<string, string>> => {
    if (!auth) return Promise.resolve({ 'X-API-Key': getApiKey() });
    return isUpload ? getAuthHeadersForUpload() : getAuthHeaders();
  };

  const serializedBody: BodyInit | undefined =
    body === undefined
      ? undefined
      : isUpload || typeof body === 'string'
        ? (body as BodyInit)
        : JSON.stringify(body);

  const doFetch = async (): Promise<Response> =>
    fetch(url, {
      method,
      headers: await buildHeaders(),
      ...(serializedBody !== undefined ? { body: serializedBody } : {}),
      ...(cache ? { cache } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });

  const response = await doFetch();

  // Auto-refresh: CHỈ khi route cần auth (đính Authorization) và backend
  // trả đúng 401 (api/deps.py::get_current_user luôn kèm error_code trong
  // detail — xem giải thích đầy đủ ở actions/auth.ts::getCurrentUser()).
  // Cùng lý do đã áp dụng ở getCurrentUser(): CHỈ refresh khi error_code
  // CHÍNH XÁC là "token_expired" — "session_replaced"/"session_revoked"
  // nghĩa là refresh_token trên thiết bị này đã bị thu hồi từ trước, cố
  // refresh sẽ bị backend hiểu nhầm là token bị đánh cắp.
  if (auth && response.status === 401) {
    // Đọc body 1 LẦN DUY NHẤT ở đây (không dùng response.clone() — môi
    // trường test (jest mock Response đơn giản trong __tests__/fixtures.ts)
    // không có method này, chỉ Response thật ở runtime Next.js mới có).
    // Nếu không refresh được, "dựng lại" 1 Response tối thiểu (ok/status/
    // statusText/json) từ đúng body đã đọc để trả cho nơi gọi — tránh lỗi
    // "body already used" khi nơi gọi tự đọc response.json() lần nữa.
    const errorBody = await response.json().catch(() => null);
    const errorCode = (errorBody as { detail?: { error_code?: string } } | null)?.detail?.error_code;

    if (errorCode === 'token_expired') {
      const cookieStore = await cookies();
      const refreshToken = cookieStore.get('refresh_token')?.value;

      if (refreshToken) {
        const refreshResult = await refreshAccessToken(refreshToken);

        if (refreshResult.ok) {
          await setAuthCookies(refreshResult.tokens.access_token, refreshResult.tokens.refresh_token);
          // Gọi lại request gốc với token mới — trả THẲNG response mới,
          // không cần dựng lại gì (body chưa bị ai đọc).
          return doFetch();
        }

        if (refreshResult.reason === 'invalid') {
          cookieStore.delete('access_token');
          cookieStore.delete('refresh_token');
          cookieStore.delete('user_data');
        }
        // reason === 'network_error': KHÔNG xoá cookie (có thể refresh_token
        // vẫn hợp lệ, chỉ là không xác định được ngay lúc này) — rơi xuống
        // trả lại response 401 gốc bên dưới, để action hiện lỗi/thử lại.
      }
    }

    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      json: async () => errorBody,
    } as Response;
  }

  return response;
}

export type ApiResult<T> =
  | { success: true; data: T; status: number }
  | { success: false; error: string; status: number };

/**
 * Bản bọc JSON-friendly của apiFetchRaw() — dùng cho phần lớn action
 * (GET danh sách/chi tiết, POST/PATCH/DELETE trả JSON hoặc 204 rỗng).
 * Action nào cần xử lý response đặc biệt (binary, nhiều status code
 * thành công khác nhau...) dùng thẳng apiFetchRaw().
 *
 * KHÔNG throw — mọi lỗi (network, timeout, backend trả !ok) đều gói vào
 * ApiResult<T>.success = false, đúng convention try/catch trả về
 * { success: false, error } đã dùng khắp actions/*.ts.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions & { fallbackError?: string } = {}
): Promise<ApiResult<T>> {
  const { fallbackError, ...fetchOptions } = options;

  let response: Response;
  try {
    response = await apiFetchRaw(path, fetchOptions);
  } catch (error) {
    console.error(`apiFetch network error [${fetchOptions.method || 'GET'} ${path}]:`, error);
    return { success: false, error: await getNetworkErrorMessage(), status: 0 };
  }

  if (response.status === 204) {
    return { success: true, data: undefined as T, status: 204 };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = (errorBody as { detail?: unknown } | null)?.detail;
    return {
      success: false,
      error: detail != null ? await formatErrorDetail(detail) : fallbackError ?? (await getGenericErrorMessage()),
      status: response.status,
    };
  }

  try {
    const data = (await response.json()) as T;
    return { success: true, data, status: response.status };
  } catch {
    return { success: true, data: undefined as T, status: response.status };
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Helper to handle server action responses
 */
export async function handleServerAction<T>(
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      'Internal Server Error'
    );
  }
}

/**
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #5, ưu tiên thấp): 9 hàm list
 * (getJobs, getCompanies, getContacts, getContactsByCompany, getAuditLogs,
 * getCrawlHistory, getCrawlBatchHistory, getExportPreview/exportEntity)
 * trước đây tự viết `new URLSearchParams()` rồi chuỗi
 * `if (filters?.x) params.append('x', ...)` thủ công cho từng field —
 * đúng chỗ đã xảy ra bug thật (GET /jobs gửi "search" nhưng backend chờ
 * "keyword", lọc bị bỏ qua trong im lặng vì query lạ không bị FastAPI từ
 * chối). buildParams() KHÔNG giảm được rủi ro sai *tên* param (dev vẫn
 * phải tự đối chiếu đúng tên query thật của backend), nhưng giảm rủi ro
 * quên/thừa dòng `if` khi filter object có nhiều field — mỗi hàm list
 * giờ chỉ cần khai 1 object literal.
 *
 * QUY TẮC bỏ qua field (gộp đúng 2 kiểu check khác nhau đã tồn tại rải
 * rác trước đây về CHUNG 1 quy tắc):
 *   - `undefined`/`null`/chuỗi rỗng `''` -> BỎ QUA (không lọc theo field
 *     này) — khớp đúng hành vi các `if (filters?.x)` cũ dùng cho field
 *     string (keyword, province, search...).
 *   - `false` (boolean) -> VẪN GỬI (`"...=false"`) — khớp đúng hành vi
 *     các chỗ cũ tự check `!== undefined` riêng cho field boolean
 *     (has_social, include_inactive, pending_note...), vì `false` là 1
 *     giá trị lọc CÓ CHỦ Ý, khác hẳn "không truyền field này".
 *   - Số `0` -> VẪN GỬI (khác `''`) — an toàn cho field số có thể hợp lệ
 *     bằng 0 sau này (hiện `limit`/`offset` luôn được set giá trị mặc
 *     định trước khi truyền vào, không đi qua nhánh "bỏ qua" này).
 *
 * LƯU Ý THỨ TỰ: `Object.entries()` giữ đúng thứ tự khai báo trong
 * object literal truyền vào — gọi nơi dùng vẫn chủ động kiểm soát được
 * thứ tự param trên query string y hệt trước đây (1 vài test cũ so
 * khớp cả chuỗi URL, vd `/jobs?limit=50&offset=0`) bằng cách đặt
 * `limit`/`offset` ở cuối object literal.
 */
export function buildParams(
  filters: Record<string, string | number | boolean | undefined | null>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return params;
}


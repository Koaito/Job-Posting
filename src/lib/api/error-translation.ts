/**
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #2+#3): tách khỏi
 * lib/api/client.ts — client.ts trước đây là "god file" (935 dòng) gộp 3
 * trách nhiệm không liên quan: (1) HTTP transport thuần, (2) auth/token
 * refresh (lib/api/auth-tokens.ts), (3) engine dịch lỗi động (toàn bộ
 * nội dung file này). Đây cũng chính là phần được nêu riêng ở mục #3
 * ("Cơ chế dịch lỗi động bằng regex parse câu tiếng Việt — kiến trúc
 * giòn") — DYNAMIC_ERROR_HANDLERS parse lại message tiếng Việt đã format
 * sẵn từ backend bằng regex để tái tạo bản tiếng Anh; chỉ cần backend
 * đổi 1 dấu câu/từ ngữ là regex im lặng không khớp, rơi về hiển thị
 * tiếng Việt cho người dùng đang chọn tiếng Anh — không có cảnh báo/log
 * nào báo hiệu (translateDynamicErrorMessage() trả `null`, code gọi tự
 * fallback, AN TOÀN nhưng ÂM THẦM). Đây là hạng mục "50 mã error_code
 * còn thiếu template" mà plan_language_polish.md đã ghi nhận là nợ kỹ
 * thuật — về lâu dài nên đề xuất backend trả params có cấu trúc
 * (field/value/list) thay vì chỉ câu đã nội suy, để FE interpolate vào
 * template i18n thay vì "đoán ngược" cấu trúc câu. KHÔNG sửa kiến trúc
 * này trong đợt tách file — chỉ di chuyển nguyên vẹn sang module riêng
 * để dễ test độc lập + không còn lẫn với transport/auth trong cùng 1
 * file.
 *
 * client.ts (transport) import lại formatErrorDetail() từ đây để dùng
 * trong apiFetch() — KHÔNG có logic mới nào bị đổi trong đợt tách file
 * này, chỉ di chuyển nguyên vẹn.
 */

import { cookies } from 'next/headers';
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE, isValidLocale, type Locale } from '@/i18n/config';
import errorsVi from '@/messages/errors.vi.json';
import errorsEn from '@/messages/errors.en.json';

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

export async function getGenericErrorMessage(): Promise<string> {
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

export async function getNetworkErrorMessage(): Promise<string> {
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

/**
 * Cơ chế params có cấu trúc (Giai đoạn 3, "Phần A", 09/2026) — bổ sung
 * SONG SONG với DYNAMIC_ERROR_HANDLERS bên dưới, KHÔNG thay thế.
 *
 * Bối cảnh: backend (Scrap_JD, "đợt 1/2") đã bắt đầu trả thêm field
 * `params` bên cạnh `error_code`/`message` cho error_code chỉ có ĐÚNG 1
 * giá trị runtime — vd `{"params": {"value": job_id}}`. FE trước đây
 * (DYNAMIC_ERROR_HANDLERS) phải BÓC NGƯỢC giá trị đó từ chính message
 * tiếng Việt bằng regex — giòn, chỉ cần backend đổi 1 dấu câu/từ ngữ là
 * lặng lẽ không khớp. Có `params` rồi thì không cần đoán ngược nữa: đọc
 * thẳng `params.value`, ráp vào template tiếng Anh đã biết trước.
 *
 * Áp dụng cho ĐÚNG 30 error_code mà backend đã có `params` tại thời
 * điểm này (đối chiếu trực tiếp source `api/routers/*.py`, KHÔNG suy
 * đoán từ error_codes.py vì docstring ở đó nói "chỉ 1 giá trị" nhưng
 * thực tế đã có 2 case 2-giá-trị — JOB_CURSOR_WITH_OFFSET_NOT_ALLOWED/
 * JOB_CURSOR_INVALID — cố tình KHÔNG đưa vào đây vì message của 2 mã
 * này TĨNH 100%, không nội suy giá trị nào vào câu, params ở đó chỉ là
 * metadata phụ, không cần template):
 * - 21 mã họ `*_invalid_uuid` (field name suy từ chính error_code, vd
 *   `job_job_id_invalid_uuid` -> field `job_id` — KHÔNG lấy field name
 *   từ `params` vì backend chỉ gửi `{"value": ...}`, không gửi field
 *   name) + `job_company_id_invalid_uuid` template riêng vì message có
 *   thêm câu hướng dẫn (route POST/PATCH /jobs) — mã này trước đây
 *   KHÔNG dịch được bằng regex ở dưới (message dài hơn các anh em cùng
 *   họ nên cố tình loại trừ, xem comment cũ) nên vẫn hiện tiếng Việt dù
 *   locale=en; giờ dịch được luôn nhờ đọc thẳng `params.value`.
 * - 9 mã đặc biệt còn lại, mỗi mã 1 khuôn câu riêng (xem
 *   PARAM_ERROR_TEMPLATES bên dưới).
 *
 * 133 mã còn lại (192 tổng − 59 raise site đã có params, quy về 30
 * error_code duy nhất) — backend CHƯA thêm params ("đợt 2" của họ) —
 * vẫn đi qua DYNAMIC_ERROR_HANDLERS (regex) như cũ, không đổi gì.
 *
 * Thứ tự ưu tiên khi dịch (xem resolveErrorMessage() bên dưới):
 * bảng tĩnh errors.en.json -> params (nếu backend có gửi VÀ error_code
 * nằm trong bảng dưới đây) -> regex cũ (DYNAMIC_ERROR_HANDLERS, an toàn
 * dự phòng nếu vì lý do gì đó params bị thiếu) -> message tiếng Việt gốc.
 */
type ErrorParams = Record<string, unknown>;

/** Ép giá trị params (đa phần là string — uuid/tên; 1 số ít là number — row_index/số lượng/số ngày) thành chuỗi hiển thị an toàn. */
function formatParamValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Field label tiếng Anh cho 20/21 mã họ `*_invalid_uuid` (không tính
 * `job_company_id_invalid_uuid` — template riêng ở PARAM_ERROR_TEMPLATES
 * vì message dài hơn). Suy trực tiếp từ tên error_code, KHÔNG từ params
 * (backend chỉ gửi `{"value": ...}`, không gửi field name kèm theo).
 */
const UUID_FIELD_LABEL: Record<string, string> = {
  audit_log_company_id_invalid_uuid: 'company_id',
  audit_log_actor_id_invalid_uuid: 'actor_id',
  audit_log_log_id_invalid_uuid: 'log_id',
  user_ss_user_id_invalid_uuid: 'ss_user_id',
  company_created_by_invalid_uuid: 'created_by',
  company_company_id_invalid_uuid: 'company_id',
  contact_assigned_ss_user_invalid_uuid: 'assigned_ss_user',
  contact_company_id_invalid_uuid: 'company_id',
  contact_created_by_invalid_uuid: 'created_by',
  contact_contact_id_invalid_uuid: 'contact_id',
  crawl_triggered_by_invalid_uuid: 'triggered_by',
  crawl_batch_id_invalid_uuid: 'batch_id',
  crawl_run_id_invalid_uuid: 'run_id',
  email_template_template_id_invalid_uuid: 'template_id',
  import_preview_id_invalid_uuid: 'preview_id',
  job_created_by_invalid_uuid: 'created_by',
  job_job_id_invalid_uuid: 'job_id',
  maintenance_triggered_by_invalid_uuid: 'triggered_by',
  maintenance_run_id_invalid_uuid: 'run_id',
  profile_job_id_invalid_uuid: 'job_id',
};

/** 30 error_code đã có params (21 họ uuid ở trên + 9 mã đặc biệt dưới đây). */
const PARAM_ERROR_TEMPLATES: Record<string, (params: ErrorParams) => string | null> = {
  ...Object.fromEntries(
    Object.entries(UUID_FIELD_LABEL).map(([code, field]) => [
      code,
      (params: ErrorParams) =>
        'value' in params ? `${field}: '${formatParamValue(params.value)}' is not a valid UUID.` : null,
    ]),
  ),
  // Cùng họ uuid nhưng message thật (jobs.py POST/PATCH) có thêm câu
  // hướng dẫn — trước đây KHÔNG dịch được (loại trừ khỏi regex chung
  // vì message dài hơn), giờ dịch được nhờ đọc thẳng params.value.
  job_company_id_invalid_uuid: (params) =>
    'value' in params
      ? `company_id: '${formatParamValue(params.value)}' is not a valid UUID — make sure you used a REAL company_id from the response of POST /companies (or GET /companies?keyword=) instead of a placeholder/sample string.`
      : null,
  job_company_not_found: (params) =>
    'value' in params
      ? `company_id: '${formatParamValue(params.value)}' does not exist — create the company first via POST /companies.`
      : null,
  profile_job_status_not_applicable: (params) =>
    'value' in params ? `This job is in status '${formatParamValue(params.value)}' and can't be applied to.` : null,
  message_too_many_pending_requests: (params) =>
    'value' in params
      ? `You have too many pending message requests (max ${formatParamValue(params.value)} at a time). Please wait for the SS to respond before sending a new request.`
      : null,
  message_previous_request_rejected_cooldown: (params) =>
    'value' in params
      ? `Your previous request was declined — please try again ${formatParamValue(params.value)} days after it was declined.`
      : null,
  maintenance_required: (params) =>
    'value' in params
      ? `job_type: '${formatParamValue(params.value)}' calls Tavily/Gemini (real cost) — 'limit' is required when triggered from the web; it can't be left empty (to avoid running against every company with no data).`
      : null,
  import_entity_type_invalid: (params) =>
    'value' in params ? `entity_type: '${formatParamValue(params.value)}' is invalid — only job/company/contact are accepted.` : null,
  import_entity_type_filter_status: (params) =>
    'value' in params ? `entity_type: '${formatParamValue(params.value)}' does not support the status filter.` : null,
  import_entity_type_no_company_step: (params) =>
    'value' in params
      ? `entity_type: '${formatParamValue(params.value)}' has no company-selection step — only job/contact support it.`
      : null,
  import_row_index_not_in_preview: (params) =>
    'value' in params ? `row_index ${formatParamValue(params.value)} is not in this preview.` : null,
};

function translateFromParams(errorCode: string, params: ErrorParams): string | null {
  const template = PARAM_ERROR_TEMPLATES[errorCode];
  return template ? template(params) : null;
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
        // BUG FIX (đợt Phần A, 09/2026): code cũ 'import_entity_type_buoc_chon_cong'
        // không khớp error_code thật ('import_entity_type_no_company_step',
        // xem api/error_codes.py::IMPORT_ENTITY_TYPE_NO_COMPANY_STEP) — handler
        // này CHƯA BAO GIỜ chạy từ lúc viết (appliesTo() luôn false). Không xoá
        // hẳn (giữ làm fallback an toàn nếu params thiếu) — chỉ sửa đúng string.
        code: 'import_entity_type_no_company_step',
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
        // BUG FIX (đợt Phần A, 09/2026): code cũ 'profile_job_trang_thai_ung_tuyen'
        // không khớp error_code thật ('profile_job_status_not_applicable', xem
        // api/error_codes.py::PROFILE_JOB_STATUS_NOT_APPLICABLE) — handler này
        // CHƯA BAO GIỜ chạy. Giữ làm fallback, sửa đúng string.
        code: 'profile_job_status_not_applicable',
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
        // BUG FIX (đợt Phần A, 09/2026): code cũ 'import_row_index_preview'
        // không khớp error_code thật ('import_row_index_not_in_preview', xem
        // api/error_codes.py::IMPORT_ROW_INDEX_NOT_IN_PREVIEW) — handler này
        // CHƯA BAO GIỜ chạy. Giữ làm fallback, sửa đúng string.
        code: 'import_row_index_not_in_preview',
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
        // BUG FIX (đợt Phần A, 09/2026): code cũ 'message_ban_qua_nhieu_yeu_cau'
        // không khớp error_code thật ('message_too_many_pending_requests', xem
        // api/error_codes.py::MESSAGE_TOO_MANY_PENDING_REQUESTS) — handler này
        // CHƯA BAO GIỜ chạy. Giữ làm fallback, sửa đúng string.
        code: 'message_too_many_pending_requests',
        pattern:
          /^Bạn đang có quá nhiều yêu cầu nhắn tin đang chờ xử lý \(tối đa (\d+) cùng lúc\)\. Vui lòng đợi SS phản hồi trước khi gửi yêu cầu mới\.$/,
        template: (m: RegExpExecArray) =>
          `You have too many pending message requests (max ${m[1]} at a time). Please wait for the SS to respond before sending a new request.`,
      },
      {
        // BUG FIX (đợt Phần A, 09/2026): code cũ 'message_yeu_cau_truoc_choi_vui'
        // không khớp error_code thật ('message_previous_request_rejected_cooldown',
        // xem api/error_codes.py::MESSAGE_PREVIOUS_REQUEST_REJECTED_COOLDOWN) —
        // handler này CHƯA BAO GIỜ chạy. Giữ làm fallback, sửa đúng string.
        code: 'message_previous_request_rejected_cooldown',
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
function resolveErrorMessage(
  errorCode: string,
  fallbackMessage: string,
  locale: Locale,
  params?: ErrorParams | null,
): string {
  if (locale === 'vi') return fallbackMessage;
  const staticTranslation = ERROR_TRANSLATIONS[locale]?.[errorCode];
  if (staticTranslation != null) return staticTranslation;
  // Phần A (09/2026): ưu tiên params (backend gửi kèm, đọc thẳng không cần
  // đoán ngược từ câu tiếng Việt) trước khi thử regex — an toàn hơn, không
  // phụ thuộc câu chữ backend. Chỉ 30 error_code có params tính tới thời
  // điểm này (xem PARAM_ERROR_TEMPLATES); các mã khác đi thẳng qua regex.
  if (params) {
    const paramTranslation = translateFromParams(errorCode, params);
    if (paramTranslation != null) return paramTranslation;
  }
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
    // Phần A (09/2026): đọc thêm field "params" mà backend (Scrap_JD, "đợt
    // 1/2") đã bắt đầu gửi kèm cho 30 error_code có giá trị runtime — xem
    // resolveErrorMessage()/PARAM_ERROR_TEMPLATES ở trên. Validate object
    // thô (không phải mảng) trước khi coi là ErrorParams hợp lệ; sai shape
    // thì bỏ qua an toàn (coi như không có params), không throw.
    const rawParams = (detail as { params?: unknown }).params;
    const params: ErrorParams | null =
      rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams)
        ? (rawParams as ErrorParams)
        : null;
    if (typeof message === 'string') {
      if (typeof errorCode === 'string') {
        const locale = await getErrorLocale();
        return resolveErrorMessage(errorCode, message, locale, params);
      }
      return message;
    }
    return JSON.stringify(detail);
  }
  return getGenericErrorMessage();
}

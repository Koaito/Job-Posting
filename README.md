# MindX Jobs Platform — Next.js Frontend

> Migration từ Flask (`mindx-jobs`) sang Next.js, gọi backend FastAPI có sẵn
> (`Scrap_JD`) qua kiến trúc BFF. Xem `plan_nextjs.md` (repo riêng, không nằm
> trong repo này) để biết lịch sử/quyết định thiết kế chi tiết — file này chỉ
> mô tả **trạng thái thật hiện tại** của code, không phải kế hoạch.

## 🏗️ Kiến trúc

```
Browser → Next.js Server Actions → FastAPI (Scrap_JD) → PostgreSQL
```

**BFF Pattern (Backend-For-Frontend)** — mọi request tới FastAPI đều đi qua
Server Actions (`'use server'`) chạy trên Next.js server, KHÔNG bao giờ gọi
thẳng từ browser:
- `X-API-Key` (biến `CRAWLER_API_KEY`) không bao giờ lộ ra client.
- JWT (`access_token`/`refresh_token`) lưu ở HTTP-only cookie, đọc/ghi phía
  server; middleware chỉ fast-path theo sự tồn tại của cookie (không tự verify
  JWT), việc verify thật nằm ở FastAPI.

**Rendering:** React Server Components là mặc định — mỗi `page.tsx` tự
`await getX()` (Server Action) để lấy dữ liệu, không có tầng data-fetching
phía client nào khác. Mutation (form submit, nút hành động) dùng Server
Actions + `useTransition()` phía client, báo lỗi/thành công bằng khối
`flash flash-error`/`flash flash-success` inline — không có toast library.

> ⚠️ **Không dùng** TanStack Query, Zustand, hay `@tanstack/react-virtual` —
> cả 3 từng có trong kế hoạch ban đầu nhưng không có trong `package.json`
> hiện tại (đã bị dọn bỏ ở một đợt cleanup sau khi xác nhận không dùng thật).
> `src/store/` vẫn còn tồn tại trên đĩa nhưng **rỗng hoàn toàn** — tàn dư
> scaffold, không dùng, không import bởi bất kỳ đâu.

## 🚀 Tech Stack (đúng theo `package.json`)

- **Next.js 16** (App Router, Turbopack mặc định)
- **React 19**
- **TypeScript 5** (`strict: true`)
- **next-intl** — i18n, chọn locale qua cookie (không dùng locale-prefix URL)
- **react-hook-form** + **zod** (`@hookform/resolvers`) — form + validate
- **date-fns** — format ngày tháng
- **clsx** — ghép className có điều kiện
- CSS thuần, chia theo file (`public/css/00-tokens.css` → `19-loading-skeletons.css`,
  20 file), migrate gần như nguyên vẹn từ Flask, dùng CSS variables cho theme.

Dev/test:
- **Jest** + **@testing-library/react** + `jest-environment-jsdom`
- **ESLint** (`eslint-config-next`)
- `@next/bundle-analyzer` (chỉ dùng qua `npm run build:analyze`, bắt buộc cờ
  `--webpack` vì bundle analyzer không tương thích Turbopack)

## 📁 Cấu trúc thư mục (đúng theo code thật)

```
src/
├── app/
│   ├── (auth)/                  # login, register, forgot/reset-password,
│   │                            # verify-email, change-password
│   ├── (dashboard)/             # mọi route cần đăng nhập
│   │   ├── dashboard/
│   │   ├── jobs/[id]/{edit}, jobs/new
│   │   ├── companies/[id]/{edit}, companies/new
│   │   ├── contacts/            # KHÔNG có route riêng — luôn lồng trong
│   │   │                        # company (list/new/edit qua modal/tab)
│   │   ├── crawl/                # 4 tab: trigger, data-health, maintenance,
│   │   │                        # history
│   │   ├── data-management/     # import/export
│   │   ├── students/[id]/
│   │   ├── staff/
│   │   ├── staff-activity/[userId]/   # admin xem hoạt động 1 nhân viên
│   │   ├── messages/[partnerId]/, messages/new
│   │   ├── my-applications/, saved-jobs/   # phía học viên ("my_stuff")
│   │   ├── profile/{security,activity}/
│   │   └── activity/            # audit log
│   └── actions/                 # Server Actions, 1 file/module (13 file):
│       auth, dashboard, jobs, companies, contacts, crawl, students, staff,
│       messages, me (apply/save job), audit, email-templates, import-export
├── components/
│   ├── features/                # 39 component gắn với 1 module cụ thể
│   │   (JobForm, CompanyContactsManager, CrawlTrigger, ConfirmActionButton
│   │   dùng chung cho 3 nút xoá/rút đơn, MessageThread, ImportPanel...)
│   └── ui/                      # 9 component dùng chung (layout, loading
│                                 # skeleton, error boundary...)
├── i18n/                        # config.ts (danh sách locale + cookie name),
│                                 # request.ts (next-intl getRequestConfig)
├── lib/
│   ├── api/
│   │   ├── client.ts            # apiFetch<T>()/apiFetchRaw() dùng chung:
│   │   │                        # tự gắn header, timeout (AbortSignal.timeout),
│   │   │                        # auto-retry 1 lần khi error_code=token_expired
│   │   ├── auth-tokens.ts       # refreshAccessToken(), setAuthCookies()
│   │   ├── env.ts               # getApiKey()/getApiBase() — validate runtime,
│   │   │                        # không dùng non-null assertion "!"
│   │   └── error-translation.ts # dịch error_code backend → tiếng Anh khi
│   │                             # locale=en (xem plan_language_polish.md)
│   ├── auth/roles.ts             # isStaffRole()/isAdminRole()/roleLabel()
│   ├── jobs/, crawl/, companies/, maintenance/  # badge/label helper theo domain
│   ├── hooks/useKeyboardShortcut.ts
│   └── utils/
├── messages/                    # en.json, vi.json (UI) + errors.en.json,
│                                 # errors.vi.json (dịch error_code backend)
├── store/                       # RỖNG — không dùng, xem cảnh báo ở trên
├── types/                       # 1 file/module, KHÔNG có barrel index.ts
└── __tests__/                   # actions/, components/, lib/ (19 file test)
```

## 🔑 Environment Variables

Biến môi trường **thật sự được đọc** trong code (đã grep `process.env.` toàn
bộ `src/`):

```bash
# .env.local — BẮT BUỘC, không có giá trị mặc định, thiếu sẽ throw lúc runtime
# (KHÔNG phải lúc `next build`, xem lib/api/env.ts)
FASTAPI_URL=https://scrap-jd-api.onrender.com   # base URL backend FastAPI
CRAWLER_API_KEY=your_api_key_here                # header X-API-Key mọi request
```

`NODE_ENV` được đọc nhưng do Next.js tự set, không cần khai tay.

> Không có biến `JWT_SECRET`/`SUPABASE_URL`/`SUPABASE_KEY` nào ở phía
> Next.js — verify JWT và upload file (CV) đều xử lý ở backend (`Scrap_JD`),
> Next.js chỉ forward request kèm `X-API-Key`/cookie JWT, không tự ký hay
> upload trực tiếp.

## 🔐 Auth & phân quyền

- **Server Actions**, không phải Route Handlers — `actions/auth.ts` gọi
  thẳng FastAPI (`POST /auth/login`, `/auth/refresh`...), set cookie
  HTTP-only (`access_token`, `refresh_token`) từ server.
- **`middleware.ts`** chỉ đọc sự tồn tại của cookie `access_token` để
  redirect nhanh (`/login` nếu vào trang cần đăng nhập mà chưa có token,
  ngược lại đá về `/dashboard` nếu đã đăng nhập mà vào trang auth) — KHÔNG
  tự verify chữ ký JWT ở middleware, xác thực thật nằm ở FastAPI mỗi request.
- Backend enforce **single-session** (`active_session_id`) + **refresh
  token rotation** nghiêm ngặt — hết hạn/bị thu hồi thì `apiFetch()` tự
  retry 1 lần qua `refreshAccessToken()`, thất bại thì trả lỗi để UI xử lý
  đăng xuất.
- 3 role: `user` (học viên), `ss_team`, `admin` — dùng `isStaffRole()`/
  `isAdminRole()` (`lib/auth/roles.ts`), **không** có field `is_staff` (bug
  cũ đã sửa — backend không bao giờ trả field này).

## 🌐 i18n

Hai tầng **độc lập nhau**, đừng nhầm:

1. **UI strings** (`next-intl`, `src/messages/{vi,en}.json`) — đang dịch dần
   theo từng đợt ("Giai đoạn 2 Phần 3" trong git log), chưa phủ 100% UI.
   Chọn locale qua cookie (`LOCALE_COOKIE_NAME`, xem `i18n/config.ts`),
   không dùng locale-prefix URL (`/en/...`).
2. **Error message từ backend** (`src/lib/api/error-translation.ts` +
   `errors.{vi,en}.json`) — dịch `error_code` mà FastAPI trả về. Khi
   `locale=vi` luôn dùng thẳng message gốc tiếng Việt; khi `locale=en` tra
   bảng tĩnh trước, sau đó thử cơ chế `params`/template cho error_code có
   biến runtime (uuid sai, số lượng...), cuối cùng fallback về message tiếng
   Việt gốc nếu chưa có bản dịch — không bao giờ hiện lỗi trắng.

## 📦 Scripts

```bash
npm run dev            # next dev — localhost:3000
npm run build           # next build (Turbopack)
npm run build:analyze   # next build --webpack, có bundle analyzer report
npm run start           # next start (chạy bản đã build)
npm run lint            # eslint
npm test                # jest (chạy 1 lần)
npm run test:watch      # jest --watch
```

## 🧪 Testing

- `jest.config.js` dùng `next/jest`, map alias `@/*` → `src/*`.
- `jest.setup.js` mock `next-intl` (`useTranslations`/`getTranslations`) có
  hỗ trợ interpolation `{param}` để khớp hành vi thật.
- Test nằm ở `src/__tests__/{actions,components,lib}`, đặt tên
  `*.test.ts(x)`.
- Trước khi merge: `npx tsc --noEmit`, `npx eslint .`, `npx jest`, và
  `npx next build` nên đều sạch — quy trình review hiện tại verify thủ công
  theo 4 lệnh này (chưa có GitHub Actions riêng cho job-posting).

## 🧩 Thêm 1 module mới — quy ước đang dùng thật

Không theo khuôn cứng "1 hook + 1 type + 1 action" — linh hoạt theo nhu cầu
module, nhưng nhất quán ở các điểm sau:

1. **Server Action** — `src/app/actions/{module}.ts`, luôn bắt đầu bằng
   `'use server'`, dùng `apiFetch<T>()`/`apiFetchRaw()` từ `lib/api/client.ts`
   (không tự viết `fetch()` tay, không tự khai `AbortController`).
2. **Type** — `src/types/{module}.ts`, không cần đăng ký vào barrel export
   nào (không còn `types/index.ts`).
3. **Route** — `src/app/(dashboard)/{module}/page.tsx` (+ `[id]/`, `new/`,
   `[id]/edit/` nếu cần) — Server Component, `await getX()` trực tiếp.
   **Nhớ thêm path mới vào `isProtectedPage` trong `middleware.ts`** nếu
   route cần đăng nhập — đây là allowlist tập trung, không tự động phát
   hiện route mới (đã có tiền lệ quên, gây bug UX — xem comment trong
   `middleware.ts`).
4. **Component** — `src/components/features/{Module}...tsx`. Nếu có hành
   động "xoá/xác nhận" dùng `ConfirmActionButton` (`components/features/
   ConfirmActionButton.tsx`) thay vì cài lại state machine riêng.
5. **Filter/query params** dùng `buildParams()` (`lib/api/client.ts`) thay
   vì tự viết logic bỏ qua field `undefined`/`null`/`''`.
6. **Lỗi từ backend** — mọi Server Action nên để lỗi đi qua
   `formatErrorDetail()` (`lib/api/error-translation.ts`), không tự parse
   `detail` tay ở từng action.

## 🐛 Troubleshooting

**CSS không load / thấy trang trắng style** — kiểm tra thứ tự import trong
`globals.css` và đường dẫn `../../public/css/*.css` còn đúng không; toàn bộ
class dùng trong `src/` đã được xác nhận khớp 100% với class khai trong
`public/style.css` + `public/css/*.css` (không còn class ảo, xem
`plan_nextjs.md` mục "Dọn CSS ảo").

**Gọi backend lỗi 401/403 khó hiểu** — kiểm tra `.env.local` có
`FASTAPI_URL`/`CRAWLER_API_KEY` chưa; thiếu sẽ throw lỗi rõ ràng
("Server chưa cấu hình..."), không còn im lặng gửi `"undefined"` như bug cũ.

**Route mới không tự đá về `/login` khi chưa đăng nhập** — quên thêm path
vào `isProtectedPage` trong `middleware.ts`, xem mục "Thêm 1 module mới" ở
trên.

**Locale không đổi dù bấm nút chuyển ngôn ngữ** — `LanguageToggle.tsx` set
cookie `locale` phía client; nếu không thấy đổi, kiểm tra cookie đó có bị
`middleware.ts` ghi đè về `DEFAULT_LOCALE` do `isValidLocale()` trả `false`
(giá trị cookie không nằm trong danh sách locale hợp lệ ở `i18n/config.ts`).

## 📖 Tài liệu liên quan (ngoài repo này)

- `plan_nextjs.md` — kế hoạch migration tổng thể, lịch sử quyết định kiến
  trúc, checklist done/todo đầy đủ.
- `plan_language_polish.md` — kế hoạch riêng cho tầng dịch `error_code`.
- `ARCHITECTURE_ANALYSIS.md` — phân tích kiến trúc backend/Flask chi tiết
  hơn (viết sau khi đã đọc code thật, đáng tin hơn phần đầu `plan_nextjs.md`).

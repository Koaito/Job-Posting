# MindX Jobs Platform - Next.js Frontend

> Migration từ Flask sang Next.js với kiến trúc modular, mở và linh hoạt

## 🏗️ Kiến Trúc

### BFF Pattern (Backend-For-Frontend)
```
Browser → Next.js Server Actions → FastAPI → PostgreSQL
```

**Lý do:**
- ✅ Bảo mật API key (không expose ra browser)
- ✅ Xử lý JWT cookie cross-origin
- ✅ Tối ưu performance với caching

### Cấu Trúc Modular

Project được tổ chức theo **module pattern** giống Flask blueprints:

```
src/
├── app/
│   ├── (auth)/              # Auth routes (login, register)
│   ├── (dashboard)/         # Protected routes
│   │   ├── jobs/            # Job management
│   │   ├── companies/       # Company management
│   │   ├── contacts/        # Contact management
│   │   ├── crawl/           # Crawler control
│   │   ├── students/        # Student management
│   │   ├── staff/           # Staff management
│   │   └── messages/        # Messaging
│   └── actions/             # Server Actions (1 file per module)
│       ├── auth.ts
│       ├── jobs.ts
│       ├── companies.ts
│       └── ...
├── components/
│   ├── features/            # Feature-specific components
│   │   ├── jobs/
│   │   ├── companies/
│   │   └── ...
│   └── ui/                  # Shared UI components
│       ├── layout/
│       ├── forms/
│       └── tables/
├── hooks/                   # React Query hooks (1 file per module)
│   ├── useJobs.ts
│   ├── useCompanies.ts
│   └── ...
├── lib/
│   ├── api/                 # API client utilities
│   ├── auth/                # Session management
│   ├── utils/               # Utilities (format, validation)
│   └── providers/           # React providers
├── store/                   # Zustand stores (for client state)
└── types/                   # TypeScript types (1 file per module)
    ├── auth.ts
    ├── jobs.ts
    └── ...
```

## 🚀 Tech Stack

### Core
- **Next.js 15+** (App Router)
- **React 19**
- **TypeScript 5+**

### State Management
- **TanStack Query (React Query)** - Server state & caching
- **Zustand** - Client state (draft data, UI state)

### Forms & Validation
- **React Hook Form** - Form handling
- **Zod** - Schema validation

### Performance
- **@tanstack/react-virtual** - Virtualization cho 5000+ rows

### Styling
- **CSS Modules** - Migrated từ Flask (00-tokens.css → 18-messages.css)

## 📦 Scripts

```bash
# Development
npm run dev          # Start dev server (localhost:3000)

# Build
npm run build        # Production build
npm run start        # Start production server

# Lint
npm run lint         # Run ESLint
```

## 🔑 Environment Variables

Tạo file `.env.local`:

```bash
# Server-side only (NEVER use NEXT_PUBLIC_ prefix!)
FASTAPI_URL=https://scrap-jd-api.onrender.com
CRAWLER_API_KEY=your_api_key_here
JWT_SECRET=your_jwt_secret_here

# Optional: Supabase for file uploads
SUPABASE_URL=
SUPABASE_KEY=
```

## 📚 Module Pattern

Mỗi module (feature) có cấu trúc chuẩn:

### 1. Server Actions (`app/actions/{module}.ts`)
```typescript
'use server';

export async function getItems() { ... }
export async function createItem(data) { ... }
export async function updateItem(id, data) { ... }
export async function deleteItem(id) { ... }
```

### 2. Types (`types/{module}.ts`)
```typescript
export interface Item { ... }
export interface ItemFilters { ... }
export interface ItemFormData { ... }
```

### 3. Hooks (`hooks/use{Module}.ts`)
```typescript
export function useItems(filters) { ... }
export function useItem(id) { ... }
export function useCreateItem() { ... }
export function useUpdateItem() { ... }
export function useDeleteItem() { ... }
```

### 4. Routes (`app/(dashboard)/{module}/`)
```
{module}/
├── page.tsx              # List page
├── [id]/
│   ├── page.tsx          # Detail page
│   └── edit/
│       └── page.tsx      # Edit page
└── new/
    └── page.tsx          # Create page
```

### 5. Components (`components/features/{module}/`)
```
{module}/
├── {Module}Card.tsx
├── {Module}Form.tsx
├── {Module}Table.tsx
└── ...
```

## 🔐 Bảo Mật

### ❌ WRONG - Expose API key
```typescript
// NEVER DO THIS!
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
fetch('https://api.example.com', {
  headers: { 'X-API-Key': API_KEY }
});
```

### ✅ CORRECT - BFF Pattern
```typescript
// Server Action (server-side only)
'use server';
const API_KEY = process.env.CRAWLER_API_KEY; // No NEXT_PUBLIC_
export async function getData() {
  return fetch(API_URL, {
    headers: { 'X-API-Key': API_KEY }
  });
}

// Client Component
'use client';
import { getData } from '@/app/actions/module';
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: getData // Call Server Action
});
```

## 📋 Migration Checklist

### Phase 0: Setup ✅
- [x] Next.js project setup
- [x] Folder structure
- [x] CSS migration
- [x] TypeScript types
- [x] Server Actions skeleton
- [x] React Query setup

### Phase 1: Authentication
- [ ] Login/logout API routes
- [ ] Auth middleware
- [ ] Login page UI
- [ ] Session management

### Phase 2: Dashboard
- [ ] Layout with sidebar
- [ ] Dashboard stats
- [ ] Recent activity

### Phase 3+: Features
- [ ] Jobs CRUD
- [ ] Companies CRUD
- [ ] Contacts CRUD
- [ ] Crawler control
- [ ] Students management
- [ ] Staff management
- [ ] Messages
- [ ] Activity logs

## 🎯 Best Practices

### 1. Thêm Module Mới
```bash
# 1. Tạo Server Actions
src/app/actions/newModule.ts

# 2. Tạo Types
src/types/newModule.ts

# 3. Tạo Hooks
src/hooks/useNewModule.ts

# 4. Tạo Routes
src/app/(dashboard)/newModule/page.tsx

# 5. Tạo Components
src/components/features/newModule/
```

### 2. State Management
- **Server state** → React Query (data từ API)
- **Client state** → Zustand (UI state, draft data)
- **Form state** → React Hook Form

### 3. Validation
- Dùng Zod schemas từ `lib/utils/validation.ts`
- Validate ở cả client và server

### 4. Performance
- Dùng `@tanstack/react-virtual` cho tables lớn (>100 rows)
- Dùng React Query caching (đã config sẵn)
- Lazy load components với `React.lazy()`

## 🐛 Troubleshooting

### CSS không load
```bash
# Check import order trong globals.css
# Đảm bảo paths đúng: ../../public/css/
```

### API call failed
```bash
# Check .env.local có đúng không
# Đảm bảo FastAPI CORS allow Next.js origin
```

### Type errors
```bash
# Re-generate types từ OpenAPI
npx openapi-typescript https://api.../openapi.json -o src/types/api.ts
```

## 📖 Tài Liệu Thêm

- [Next.js Docs](https://nextjs.org/docs)
- [React Query Docs](https://tanstack.com/query/latest)
- [Zod Docs](https://zod.dev)
- [Migration Plan](../plan_nextjs.md)

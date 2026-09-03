'use server';

import { listUsers, createUser, updateUserRole, updateUserActiveStatus } from './auth';
import type { User, UserCreatePayload, UserCreated } from '@/types/auth';

/**
 * Server Actions for Staff (Nhân viên — ss_team/admin)
 * Corresponds to Flask blueprint: blueprints/staff.py
 *
 * BUG FIX (audit 09/2026): trước đây throw new Error('Not implemented')
 * cho cả 2 hàm gốc. Cùng lý do như students.ts — không có entity/router
 * "staff" riêng ở backend, chỉ lọc role!=='user' từ GET /auth/users.
 * create/updateRole/updateActiveStatus dùng lại đúng 3 hàm admin-only
 * đã thêm ở actions/auth.ts (backend tự chặn 403 nếu người gọi không
 * phải admin, route ở đây không tự kiểm tra role phía FE).
 */

export interface StaffFilters {
  keyword?: string;
}

/** role !== 'user' = "nhân viên" (ss_team hoặc admin) trong hệ thống này. */
export async function getStaff(filters?: StaffFilters): Promise<User[]> {
  const users = await listUsers();
  const staff = users.filter((u) => u.role !== 'user');

  if (!filters?.keyword) return staff;

  const kw = filters.keyword.trim().toLowerCase();
  if (!kw) return staff;

  return staff.filter(
    (s) => s.full_name.toLowerCase().includes(kw) || s.email.toLowerCase().includes(kw)
  );
}

export async function getStaffById(id: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.ss_user_id === id && u.role !== 'user') || null;
}

/** admin-only ở backend — role bắt buộc phải là 'ss_team' hoặc 'admin' khi tạo qua trang này. */
export async function createStaff(
  data: UserCreatePayload
): Promise<{ success: boolean; user?: UserCreated; error?: string }> {
  return createUser(data);
}

export async function updateStaffRole(
  ssUserId: string,
  role: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  return updateUserRole(ssUserId, role);
}

export async function updateStaffActiveStatus(
  ssUserId: string,
  isActive: boolean
): Promise<{ success: boolean; user?: User; error?: string }> {
  return updateUserActiveStatus(ssUserId, isActive);
}

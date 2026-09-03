'use server';

import { listUsers, createUser, updateUserRole, updateUserActiveStatus } from '@/app/actions/auth';
import type { User, UserCreatePayload, UserCreated } from '@/types/auth';

/**
 * Server Actions for Staff
 * Corresponds to Flask blueprint: blueprints/staff.py
 *
 * BUG FIX (audit 09/2026 #13): trước đây throw new Error('Not implemented').
 * Đối chiếu bản Flask gốc (staff.py::accounts()/add()/update_role()/
 * update_active_status()) — "Nhân viên" (staff_accounts) KHÔNG phải 1
 * entity/router riêng ở backend, chỉ là GET /auth/users lọc theo role
 * KHÁC 'user' ở tầng FE, dùng lại đúng 4 hàm ghi/đọc trong actions/auth.ts
 * (listUsers/createUser/updateUserRole/updateUserActiveStatus).
 * 3 hàm ghi ở dưới đều admin-only ở backend — role thấp hơn sẽ nhận lỗi
 * 403 qua { success: false, error } như bình thường, không throw.
 */

export interface StaffFilters {
  keyword?: string;
}

/** Lọc role != 'user' (ss_team + admin) từ danh sách chung. */
export async function getStaff(filters?: StaffFilters): Promise<User[]> {
  const users = await listUsers();
  let staff = users.filter((u) => u.role !== 'user');

  if (filters?.keyword) {
    const keyword = filters.keyword.trim().toLowerCase();
    if (keyword) {
      staff = staff.filter(
        (u) =>
          u.full_name.toLowerCase().includes(keyword) ||
          u.email.toLowerCase().includes(keyword)
      );
    }
  }

  return staff;
}

export async function getStaffById(id: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.ss_user_id === id && u.role !== 'user') || null;
}

/** Tạo tài khoản nhân viên mới (admin-only) — xem createUser() ở actions/auth.ts. */
export async function createStaffAccount(
  data: UserCreatePayload
): Promise<{ success: boolean; user?: UserCreated; error?: string }> {
  return createUser(data);
}

/** Đổi role của 1 nhân viên (admin-only). */
export async function updateStaffRole(
  id: string,
  role: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  return updateUserRole(id, role);
}

/** Khoá/mở khoá 1 tài khoản nhân viên (admin-only). */
export async function updateStaffActiveStatus(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; user?: User; error?: string }> {
  return updateUserActiveStatus(id, isActive);
}

/**
 * Dashboard types
 */

export interface DashboardStats {
  total_jobs: number;
  total_companies: number;
  total_contacts: number;
  total_students: number;
  active_crawls: number;
  recent_jobs: number;
}

export interface RecentActivity {
  id: number;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: number;
  created_at: string;
}

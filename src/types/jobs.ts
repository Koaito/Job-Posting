/**
 * Job types
 */

export interface Job {
  id: number;
  title: string;
  company_id: number;
  company_name?: string;
  description?: string;
  requirements?: string;
  location?: string;
  salary?: string;
  employment_type?: 'full-time' | 'part-time' | 'contract' | 'internship';
  status: 'active' | 'inactive' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface JobFilters {
  company_id?: number;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface JobFormData {
  title: string;
  company_id: number;
  description?: string;
  requirements?: string;
  location?: string;
  salary?: string;
  employment_type?: string;
}

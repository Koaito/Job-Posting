/**
 * Company types
 */

export interface Company {
  id: number;
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyFilters {
  search?: string;
  industry?: string;
  page?: number;
  per_page?: number;
}

export interface CompanyFormData {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  description?: string;
}

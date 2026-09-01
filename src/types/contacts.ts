/**
 * Contact types
 */

export interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  company_id?: number;
  company_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactFilters {
  company_id?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ContactFormData {
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  company_id?: number;
}

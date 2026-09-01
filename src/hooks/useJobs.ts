/**
 * React Query hooks for Jobs
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJobs, getJobById, createJob, updateJob, deleteJob } from '@/app/actions/jobs';
import type { JobFilters, JobFormData } from '@/types';

export function useJobs(filters?: JobFilters) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => getJobs(filters),
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => getJobById(id),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: JobFormData) => createJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJob(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: JobFormData) => updateJob(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

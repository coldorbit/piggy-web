import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api('/api/admin/users').then((data) => data.users),
  });
}

export function useAdminDashboard(filters = {}) {
  const queryParams = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['admin', 'dashboard', filters],
    queryFn: () => api(`/api/admin/dashboard${queryParams ? `?${queryParams}` : ''}`).then((data) => data.dashboard),
    staleTime: 30_000,
  });
}

export function useAdminConsumption() {
  return useQuery({
    queryKey: ['admin', 'consumption'],
    queryFn: () => api('/api/admin/consumption').then((data) => data.consumption),
  });
}

export function useCreateConsumptionRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordData) =>
      api('/api/admin/consumption', {
        method: 'POST',
        body: JSON.stringify(recordData),
      }).then((data) => data.record),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'consumption'] }),
  });
}

export function useUpdateConsumptionRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, recordData }) =>
      api(`/api/admin/consumption/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify(recordData),
      }).then((data) => data.record),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'consumption'] }),
  });
}

export function useDeleteConsumptionRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId) =>
      api(`/api/admin/consumption/${recordId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'consumption'] }),
  });
}

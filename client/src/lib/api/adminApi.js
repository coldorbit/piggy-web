import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useAdminUsers(filters = {}) {
  const queryParams = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () => api(`/api/admin/users${queryParams ? `?${queryParams}` : ''}`).then((data) => data.users),
  });
}

export function useAdminWorkspaces() {
  return useQuery({
    queryKey: ['admin', 'workspaces'],
    queryFn: () => api('/api/admin/workspaces').then((data) => data.workspaces),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceData) =>
      api('/api/admin/workspaces', {
        method: 'POST',
        body: JSON.stringify(workspaceData),
      }).then((data) => data.workspace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, workspaceData }) =>
      api(`/api/admin/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify(workspaceData),
      }).then((data) => data.workspace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId) =>
      api(`/api/admin/workspaces/${workspaceId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
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

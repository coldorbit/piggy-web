import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const AUTH_TOKEN_KEY = 'scraper_auth_token';
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function api(path, options = {}) {
  try {
    const token = authToken();
    const response = await axios({
      url: apiUrl(path),
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      data: options.body,
    });
    return response.data || {};
  } catch (error) {
    if (error.response?.status === 401) clearAuthToken();
    const apiError = new Error(error.response?.data?.error || error.message);
    apiError.status = error.response?.status;
    apiError.data = error.response?.data || null;
    throw apiError;
  }
}

export function authToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthToken(token) {
  if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  else clearAuthToken();
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function authUrl(path) {
  const token = authToken();
  const url = apiUrl(path);
  if (!token) return url;
  const separator = path.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api('/api/me').then((data) => data.user),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials) =>
      api('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(['me'], data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/logout', { method: 'POST' }),
    onSettled: async () => {
      await queryClient.cancelQueries();
      clearAuthToken();
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
    },
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userData) =>
      api('/api/me', {
        method: 'PATCH',
        body: JSON.stringify(userData),
      }),
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(['me'], data.user);
      queryClient.invalidateQueries();
    },
  });
}

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
      withCredentials: true,
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
  return '';
}

export function setAuthToken(_token) {
  clearAuthToken();
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function authUrl(path) {
  return apiUrl(path);
}

export async function downloadAuthenticatedFile(path, fallbackFilename = 'download') {
  try {
    const response = await axios({
      url: apiUrl(path),
      method: 'GET',
      withCredentials: true,
      responseType: 'blob',
    });
    const filename = filenameFromDisposition(response.headers?.['content-disposition']) || fallbackFilename;
    triggerBrowserDownload(response.data, filename);
    return { filename };
  } catch (error) {
    if (error.response?.status === 401) clearAuthToken();
    const message = await downloadErrorMessage(error);
    const downloadError = new Error(message || error.message);
    downloadError.status = error.response?.status;
    throw downloadError;
  }
}

function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

function filenameFromDisposition(value) {
  const disposition = String(value || '');
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const bareMatch = disposition.match(/filename=([^;]+)/i);
  return bareMatch?.[1]?.trim() || '';
}

function triggerBrowserDownload(data, filename) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function downloadErrorMessage(error) {
  const data = error.response?.data;
  if (!data) return '';
  if (data instanceof Blob) {
    const text = await data.text();
    try {
      return JSON.parse(text)?.error || text;
    } catch {
      return text;
    }
  }
  return data?.error || '';
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
      clearAuthToken();
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
      clearAuthToken();
      queryClient.setQueryData(['me'], data.user);
      queryClient.invalidateQueries();
    },
  });
}

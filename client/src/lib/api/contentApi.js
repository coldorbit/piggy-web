import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useFaqs() {
  return useQuery({ queryKey: ['faqs'], queryFn: () => api('/api/faqs').then((data) => data.faqs) });
}

export function useFaq(faqId) {
  return useQuery({ queryKey: ['faqs', faqId], queryFn: () => api(`/api/faqs/${faqId}`).then((data) => data.faq), enabled: Boolean(faqId) });
}

export function useCreateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (faqData) => api('/api/faqs', { method: 'POST', body: JSON.stringify(faqData) }).then((data) => data.faq),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faqs'] }),
  });
}

export function useUpdateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ faqId, faqData }) => api(`/api/faqs/${faqId}`, { method: 'PATCH', body: JSON.stringify(faqData) }).then((data) => data.faq),
    onSuccess: (faq) => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
      queryClient.setQueryData(['faqs', faq.id], faq);
    },
  });
}

export function useLearningArticles(filters = {}) {
  const queryParams = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['learning', 'articles', filters],
    queryFn: () => api(`/api/learning/articles${queryParams ? `?${queryParams}` : ''}`).then((data) => data.articles),
    staleTime: 30_000,
  });
}

export function useLearningCompanies() {
  return useQuery({
    queryKey: ['learning', 'companies'],
    queryFn: () => api('/api/learning/companies').then((data) => data.companies),
    staleTime: 30_000,
  });
}

export function useCreateLearningCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (company) => api('/api/learning/companies', { method: 'POST', body: JSON.stringify(company) }).then((data) => data.company),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  });
}

export function useUpdateLearningCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, company }) => api(`/api/learning/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(company) }).then((data) => data.company),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  });
}

export function useLearningArticle(articleId) {
  return useQuery({
    queryKey: ['learning', 'articles', articleId],
    queryFn: () => api(`/api/learning/articles/${articleId}`).then((data) => data.article),
    enabled: Boolean(articleId),
  });
}

export function useCreateLearningArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleData) => api('/api/learning/articles', { method: 'POST', body: JSON.stringify(articleData) }).then((data) => data.article),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  });
}

export function useUpdateLearningArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ articleId, articleData }) => api(`/api/learning/articles/${articleId}`, { method: 'PATCH', body: JSON.stringify(articleData) }).then((data) => data.article),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ['learning'] });
      queryClient.setQueryData(['learning', 'articles', article.id], article);
    },
  });
}

export function useDeleteLearningArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleId) => api(`/api/learning/articles/${articleId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  });
}

export function useProfileHub(profileId, queryOptions = {}) {
  return useQuery({
    queryKey: ['bid', 'profiles', profileId, 'hub'],
    queryFn: () => api(`/api/bid/profiles/${profileId}/hub`).then((data) => data.hub),
    enabled: Boolean(profileId),
    staleTime: 30_000,
    ...queryOptions,
  });
}

export function useUpdateProfileIntelligence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, intelligence }) => api(`/api/bid/profiles/${profileId}/intelligence`, { method: 'PATCH', body: JSON.stringify(intelligence) }).then((data) => data.intelligence),
    onSuccess: (_intelligence, variables) => invalidateProfileHub(queryClient, variables.profileId),
  });
}

export function useGeocodeProfileLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, address, countryCode = 'US' }) => api(`/api/bid/profiles/${profileId}/location/geocode`, { method: 'POST', body: JSON.stringify({ address, countryCode }) }),
    onSuccess: (_result, variables) => invalidateProfileHub(queryClient, variables.profileId),
  });
}

export function useCreateProfileStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, story }) => api(`/api/bid/profiles/${profileId}/stories`, { method: 'POST', body: JSON.stringify(story) }).then((data) => data.story),
    onSuccess: (_story, variables) => invalidateProfileHub(queryClient, variables.profileId),
  });
}

export function useUpdateProfileStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, storyId, story }) => api(`/api/bid/profiles/${profileId}/stories/${storyId}`, { method: 'PATCH', body: JSON.stringify(story) }).then((data) => data.story),
    onSuccess: (_story, variables) => invalidateProfileHub(queryClient, variables.profileId),
  });
}

export function useDeleteProfileStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, storyId }) => api(`/api/bid/profiles/${profileId}/stories/${storyId}`, { method: 'DELETE' }),
    onSuccess: (_result, variables) => invalidateProfileHub(queryClient, variables.profileId),
  });
}

export function useUpdateProfilePrepPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, prepPlan }) => api(`/api/bid/profiles/${profileId}/prep-plan`, { method: 'PATCH', body: JSON.stringify(prepPlan) }).then((data) => data.prepPlan),
    onSuccess: (_prepPlan, variables) => invalidateProfileHub(queryClient, variables.profileId),
  });
}

function invalidateProfileHub(queryClient, profileId) {
  queryClient.invalidateQueries({ queryKey: ['bid', 'profiles', profileId, 'hub'] });
  queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
}

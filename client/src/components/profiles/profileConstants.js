export const EMPTY_PROFILE = {
  name: '',
  location: '',
  phone: '',
  email: '',
  linkedin: '',
  yearsOfExperience: '',
  companies: '[]',
  education: '[]',
  resumeText: '',
  colorScheme: 'blue',
  profileBadge: 'SWE',
};

export const COLOR_OPTIONS = ['green', 'blue', 'violet', 'amber', 'rose', 'slate'];

export const PROFILE_BADGE_OPTIONS = [
  { value: 'ML', label: 'ML', description: 'AI/ML' },
  { value: 'DE', label: 'DE', description: 'Data Engineering' },
  { value: 'SWE', label: 'SWE', description: 'Software Engineer' },
];

export const PROFILE_BADGE_COLORS = {
  ML: { bgcolor: '#EFF6FF', color: '#1E40AF' },
  DE: { bgcolor: '#ECFDF5', color: '#0F766E' },
  SWE: { bgcolor: '#F8FAFC', color: '#0F172A' },
};

export const PROFILE_COLORS = {
  green: { main: '#16A34A', dark: '#166534', soft: '#ECFDF5' },
  blue: { main: '#2563EB', dark: '#1E40AF', soft: '#EFF6FF' },
  violet: { main: '#6366F1', dark: '#4338CA', soft: '#EEF2FF' },
  amber: { main: '#D97706', dark: '#92400E', soft: '#FFFBEB' },
  rose: { main: '#DC2626', dark: '#991B1B', soft: '#FEF2F2' },
  slate: { main: '#64748B', dark: '#334155', soft: '#F1F5F9' },
};

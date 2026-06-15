export const EMPTY_PROFILE = {
  name: '',
  location: '',
  phone: '',
  email: '',
  linkedin: '',
  yearsOfExperience: '',
  resumeText: '',
  resumeTemplate: 'classic',
  colorScheme: 'blue',
  profileBadge: 'SWE',
  dailyBidGoal: 60,
};

export const COLOR_OPTIONS = ['green', 'blue', 'violet', 'amber', 'rose', 'slate'];

export const RESUME_TEMPLATE_OPTIONS = [
  { value: 'classic', label: 'Classic', description: 'Traditional ATS' },
  { value: 'compact', label: 'Compact', description: 'Dense single page' },
  { value: 'modern', label: 'Modern', description: 'Clean ATS' },
];

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

export const CALENDAR_PROFILE_COLORS = [
  { main: '#2563EB', dark: '#1E40AF', soft: '#EFF6FF' },
  { main: '#DC2626', dark: '#991B1B', soft: '#FEF2F2' },
  { main: '#16A34A', dark: '#166534', soft: '#ECFDF5' },
  { main: '#D97706', dark: '#92400E', soft: '#FFFBEB' },
  { main: '#7C3AED', dark: '#5B21B6', soft: '#F5F3FF' },
  { main: '#0891B2', dark: '#155E75', soft: '#ECFEFF' },
  { main: '#DB2777', dark: '#9D174D', soft: '#FDF2F8' },
  { main: '#4F46E5', dark: '#3730A3', soft: '#EEF2FF' },
  { main: '#65A30D', dark: '#3F6212', soft: '#F7FEE7' },
  { main: '#EA580C', dark: '#9A3412', soft: '#FFF7ED' },
  { main: '#0D9488', dark: '#115E59', soft: '#F0FDFA' },
  { main: '#475569', dark: '#1E293B', soft: '#F8FAFC' },
];

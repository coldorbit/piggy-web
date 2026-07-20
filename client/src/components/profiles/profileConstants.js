export const EMPTY_PROFILE = {
  name: '',
  location: '',
  phone: '',
  email: '',
  forwardingEmail: '',
  linkedin: '',
  yearsOfExperience: '',
  resumeText: '',
  resumeTemplate: 'classic',
  isStatic: false,
  staticResumeFilename: '',
  staticResumeUpload: null,
  colorScheme: 'blue',
  profileBadge: 'SWE',
  profileStatus: 'active',
  isFeatured: false,
  dailyBidGoal: 60,
};

export function forwardingAliasForProfileName(name) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || '';
  const tag = firstName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  return tag ? `service+${tag}@co-bounce.com` : 'service+first_name@co-bounce.com';
}

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
  ML: { bgcolor: 'rgba(0, 103, 192, 0.10)', color: '#004E8C' },
  DE: { bgcolor: '#ECFDF5', color: '#486860' },
  SWE: { bgcolor: 'rgba(246, 248, 251, 0.86)', color: '#1B1B1B' },
};

export const PROFILE_COLORS = {
  green: { main: '#0E7A3E', dark: '#166534', soft: '#ECFDF5' },
  blue: { main: '#0067C0', dark: '#004E8C', soft: 'rgba(0, 103, 192, 0.10)' },
  violet: { main: '#6366F1', dark: '#4338CA', soft: '#EEF2FF' },
  amber: { main: '#C77700', dark: '#92400E', soft: '#FFFBEB' },
  rose: { main: '#C42B1C', dark: '#991B1B', soft: '#FEF2F2' },
  slate: { main: '#5F5F5F', dark: '#334155', soft: '#F1F5F9' },
  teal: { main: '#0D9488', dark: '#324B45', soft: '#F0FDFA' },
  cyan: { main: '#0891B2', dark: '#155E75', soft: '#ECFEFF' },
  pink: { main: '#DB2777', dark: '#9D174D', soft: '#FDF2F8' },
  indigo: { main: '#4F46E5', dark: '#3730A3', soft: '#EEF2FF' },
  lime: { main: '#65A30D', dark: '#3F6212', soft: '#F7FEE7' },
  orange: { main: '#EA580C', dark: '#9A3412', soft: '#FFF7ED' },
};

export const COLOR_OPTIONS = Object.keys(PROFILE_COLORS);
export const CALENDAR_PROFILE_COLORS = COLOR_OPTIONS.map((color) => PROFILE_COLORS[color]);

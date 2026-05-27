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
  colorScheme: 'violet',
  profileBadge: 'SWE',
};

export const COLOR_OPTIONS = ['green', 'blue', 'violet', 'amber', 'rose', 'slate'];

export const PROFILE_BADGE_OPTIONS = [
  { value: 'ML', label: 'ML', description: 'AI/ML' },
  { value: 'DE', label: 'DE', description: 'Data Engineering' },
  { value: 'SWE', label: 'SWE', description: 'Software Engineer' },
];

export const PROFILE_BADGE_COLORS = {
  ML: { bgcolor: '#ebe9ff', color: '#37328f' },
  DE: { bgcolor: '#dff7f5', color: '#08716f' },
  SWE: { bgcolor: '#fff0e9', color: '#8b422c' },
};

export const PROFILE_COLORS = {
  green: { main: '#0f9f9a', dark: '#08716f', soft: '#dff7f5' },
  blue: { main: '#4776d8', dark: '#29458f', soft: '#e5edff' },
  violet: { main: '#5f5bd8', dark: '#37328f', soft: '#ebe9ff' },
  amber: { main: '#c98228', dark: '#7a4a12', soft: '#fff2d8' },
  rose: { main: '#c85d75', dark: '#843548', soft: '#ffe7ee' },
  slate: { main: '#68657f', dark: '#3c394f', soft: '#eceaf4' },
};

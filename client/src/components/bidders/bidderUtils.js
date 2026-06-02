export function roleLabel(role) {
  if (role === 'readonly_bidder' || role === 'bidder') return 'Readonly bidder';
  if (role === 'editable_bidder') return 'Editable bidder';
  return role || 'User';
}

export function shortDayLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

import { Chip } from '@mui/material';

export default function SpamBadge({ job }) {
  if (job.isSpam === true) return <Chip color="error" label="Spam" size="small" variant="outlined" />;
  if (job.isSpam === false) return <Chip color="success" label="Not spam" size="small" variant="outlined" />;
  return <Chip label="Unreviewed" size="small" variant="outlined" />;
}

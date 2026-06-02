import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { formatDate, formatDateTime } from '../../lib/formatters.js';
import { toDatetimeLocalValue } from './interviewUtils.js';

export default function InterviewCard({
  accent,
  currentUser,
  draft,
  isSaving,
  job,
  onDraftChange,
  onDragEnd,
  onDragStart,
  onSave,
}) {
  const owner = job.bid?.user?.username || (String(job.bid?.userId) === String(currentUser?.id) ? currentUser?.username : '');

  function handleStatusChange(event) {
    const status = event.target.value;
    onDraftChange('status', status);
    onSave({ status });
  }

  return (
    <Card
      draggable
      variant="outlined"
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      sx={{
        borderLeft: `4px solid ${accent.main}`,
        boxShadow: 1,
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <CardContent sx={{ display: 'grid', gap: 1, p: 1, '&:last-child': { pb: 1 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 0.75, alignItems: 'start' }}>
          <Box minWidth={0}>
            <Typography
              component="a"
              href={job.url}
              target="_blank"
              rel="noreferrer"
              variant="body2"
              fontWeight={900}
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main', textDecoration: 'underline' },
              }}
            >
              {job.title || 'Untitled role'}
            </Typography>
            <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.25 }}>
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                {job.company || 'Unknown company'}
              </Box>
              {job.location ? ` · ${job.location}` : null}
            </Typography>
          </Box>
          <DragIndicatorIcon fontSize="small" color="action" />
        </Box>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<CalendarMonthIcon />}
            label={draft.interviewNextAt ? formatDateTime(draft.interviewNextAt) : 'No next date'}
            size="small"
            sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 800, '& .MuiChip-icon': { color: '#0F766E' } }}
          />
          {owner ? <Chip label={owner} size="small" sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 800 }} /> : null}
          <Chip label={formatDate(job.bid?.updatedAt)} size="small" sx={{ bgcolor: '#f7ead1', color: '#70400d', fontWeight: 800 }} />
        </Stack>

        <TextField
          label="Next interview"
          size="small"
          type="datetime-local"
          value={toDatetimeLocalValue(draft.interviewNextAt)}
          onChange={(event) => onDraftChange('interviewNextAt', event.target.value ? new Date(event.target.value).toISOString() : '')}
          disabled={isSaving}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControl size="small">
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={draft.status || 'interviewing'} onChange={handleStatusChange} disabled={isSaving}>
            <MenuItem value="interviewing">Interviewing</MenuItem>
            <MenuItem value="submitted">Submitted</MenuItem>
            <MenuItem value="won">Won</MenuItem>
            <MenuItem value="lost">Lost</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Notes"
          minRows={2}
          multiline
          value={draft.interviewNotes || ''}
          onChange={(event) => onDraftChange('interviewNotes', event.target.value)}
          disabled={isSaving}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.75 }}>
          <Button
            component="a"
            href={job.url}
            target="_blank"
            rel="noreferrer"
            size="small"
            startIcon={<OpenInNewIcon />}
            variant="outlined"
            sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
          >
            Job
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => onSave()}
            size="small"
            startIcon={isSaving ? <CircularProgress color="inherit" size={16} /> : <SaveIcon />}
            variant="contained"
            sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
          >
            Save
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

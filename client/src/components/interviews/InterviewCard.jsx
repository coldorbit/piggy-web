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
  TextField,
  Typography,
} from '@mui/material';
import { INTERVIEW_STAGES } from '../bids/bidConstants.js';
import { formatDate, formatDateTime } from '../../lib/formatters.js';
import { toDatetimeLocalValue } from './interviewUtils.js';

export default function InterviewCard({
  accent,
  callerUsers = [],
  canAssignCallers = false,
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
  const jobUrl = externalJobUrl(job);

  function handleStageChange(event) {
    const interviewStage = event.target.value;
    onDraftChange('interviewStage', interviewStage);
    onSave({ interviewStage, status: 'interviewing' });
  }

  function handleCallerChange(event) {
    const callerUserId = event.target.value;
    onDraftChange('callerUserId', callerUserId);
    onSave({ callerUserId });
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
              component={jobUrl ? 'a' : 'span'}
              href={jobUrl || undefined}
              target={jobUrl ? '_blank' : undefined}
              rel={jobUrl ? 'noreferrer' : undefined}
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
          <InputLabel>Step</InputLabel>
          <Select label="Step" value={draft.interviewStage || INTERVIEW_STAGES[0].value} onChange={handleStageChange} disabled={isSaving}>
            {INTERVIEW_STAGES.map((stage) => (
              <MenuItem key={stage.value} value={stage.value}>
                {stage.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Caller</InputLabel>
          <Select
            label="Caller"
            value={draft.callerUserId || ''}
            onChange={handleCallerChange}
            disabled={isSaving || !canAssignCallers}
          >
            <MenuItem value="">Unassigned</MenuItem>
            {callerUsers.map((caller) => (
              <MenuItem key={caller.id} value={caller.id}>
                {caller.username}
              </MenuItem>
            ))}
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
          {jobUrl ? (
            <Button
              component="a"
              href={jobUrl}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<OpenInNewIcon />}
              variant="outlined"
              sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
            >
              Job
            </Button>
          ) : (
            <Box />
          )}
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
        <Box sx={chipRowSx}>
          <Chip
            icon={<CalendarMonthIcon />}
            label={draft.interviewNextAt ? formatDateTime(draft.interviewNextAt) : 'No next date'}
            size="small"
            sx={{ ...chipSx, bgcolor: '#ECFDF5', color: '#0F766E', '& .MuiChip-icon': { color: '#0F766E' } }}
          />
          {owner ? <Chip label={owner} size="small" sx={{ ...chipSx, bgcolor: '#edf0ff', color: '#343f91' }} /> : null}
          <Chip label={formatDate(job.bid?.updatedAt)} size="small" sx={{ ...chipSx, bgcolor: '#f7ead1', color: '#70400d' }} />
        </Box>
      </CardContent>
    </Card>
  );
}

const chipRowSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.5,
  minWidth: 0,
  maxWidth: '100%',
};

const chipSx = {
  fontWeight: 800,
  maxWidth: '100%',
  minWidth: 0,
  '& .MuiChip-label': {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

function externalJobUrl(job) {
  const url = job?.rawJob?.originalUrl || job?.url || '';
  return /^https?:\/\//i.test(String(url)) ? url : '';
}

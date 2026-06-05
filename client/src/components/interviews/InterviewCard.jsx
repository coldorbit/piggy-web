import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import { INTERVIEW_STAGES } from '../bids/bidConstants.js';
import { formatDate, formatDateTime } from '../../lib/formatters.js';

const INTERACTIVE_SELECTOR = 'a, button, input, textarea, [role="combobox"], .MuiSelect-select';

export default function InterviewCard({
  accent,
  callerUsers = [],
  canAssignCallers = false,
  currentUser,
  draft,
  dragAttributes = {},
  dragHandleRef,
  dragListeners = {},
  isDragging = false,
  isDeleting = false,
  isSaving,
  job,
  nodeRef,
  onOpen,
  overlay = false,
}) {
  const owner = job.bid?.user?.username || (String(job.bid?.userId) === String(currentUser?.id) ? currentUser?.username : '');
  const currentStage = draft.interviewStage || INTERVIEW_STAGES[0].value;
  const stageNotes = draft.stageNotes || {};
  const logs = draft.logs || [];
  const currentStageNote = stageNotes[currentStage] || draft.interviewNotes || '';

  function handlePointerDown(event) {
    if (event.target.closest(INTERACTIVE_SELECTOR)) {
      event.stopPropagation();
      return;
    }
    dragListeners.onPointerDown?.(event);
  }

  return (
    <Card
      ref={nodeRef}
      variant="outlined"
      {...dragAttributes}
      {...dragListeners}
      onPointerDown={handlePointerDown}
      onClick={(event) => {
        if (overlay || isDragging || event.target.closest(INTERACTIVE_SELECTOR)) return;
        onOpen?.();
      }}
      sx={{
        borderLeft: `4px solid ${accent.main}`,
        boxShadow: 1,
        cursor: isSaving || isDeleting || overlay ? 'default' : 'grab',
        flexShrink: 0,
        opacity: isDragging ? 0.32 : 1,
        touchAction: overlay ? 'none' : 'manipulation',
        '&:active': { cursor: isSaving || isDeleting || overlay ? 'default' : 'grabbing' },
      }}
    >
      <CardContent sx={{ display: 'grid', gap: 1, p: 1, '&:last-child': { pb: 1 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 0.75, alignItems: 'start' }}>
          <Box minWidth={0}>
            <Typography
              component="span"
              variant="body2"
              fontWeight={900}
              sx={{
                color: 'text.primary',
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Box
              ref={dragHandleRef}
              aria-label="Move interview"
              aria-hidden="true"
              sx={{
                alignItems: 'center',
                cursor: isSaving || isDeleting ? 'default' : 'grab',
                display: 'flex',
                height: 28,
                justifyContent: 'center',
                width: 28,
                '&:active': { cursor: isSaving || isDeleting ? 'default' : 'grabbing' },
              }}
            >
              <DragIndicatorIcon fontSize="small" color="action" />
            </Box>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 20 }} noWrap>
          {currentStageNote || 'No notes for this step'}
        </Typography>
        {logs.length ? (
          <Box sx={{ display: 'grid', gap: 0.35, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={900}>
              Journey
            </Typography>
            {logs.slice(-4).map((log) => (
              <Typography key={log.id} variant="caption" color="text.secondary" noWrap>
                {formatJourneyLog(log)}
              </Typography>
            ))}
          </Box>
        ) : null}
        <Box sx={chipRowSx}>
          <Chip
            icon={<CalendarMonthIcon />}
            label={draft.interviewNextAt ? formatDateTime(draft.interviewNextAt) : 'No next date'}
            size="small"
            sx={{ ...chipSx, bgcolor: '#ECFDF5', color: '#0F766E', '& .MuiChip-icon': { color: '#0F766E' } }}
          />
          {owner ? <Chip label={owner} size="small" sx={{ ...chipSx, bgcolor: '#edf0ff', color: '#343f91' }} /> : null}
          <Chip label={stageLabel(currentStage)} size="small" sx={{ ...chipSx, bgcolor: '#EFF6FF', color: '#1D4ED8' }} />
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

function stageLabel(value) {
  return INTERVIEW_STAGES.find((stage) => stage.value === value)?.label || 'Stage';
}

function formatJourneyLog(log) {
  const at = log.createdAt ? formatDateTime(log.createdAt) : '';
  const stage = log.metadata?.stage ? stageLabel(log.metadata.stage) : '';
  const action = {
    created: 'Created',
    first_scheduled: 'First scheduled',
    schedule_changed: 'Schedule changed',
    stage_changed: `Moved ${stageLabel(log.fromValue)} -> ${stageLabel(log.toValue)}`,
    stage_note_changed: `${stage || 'Stage'} note updated`,
  }[log.eventType] || log.eventType;
  return [action, at].filter(Boolean).join(' · ');
}

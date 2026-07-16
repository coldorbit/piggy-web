import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import { INTERVIEW_STAGES } from '../bids/bidConstants.js';
import { formatDate, formatDateTimeInDefaultTimezone } from '../../lib/formatters.js';
import { downloadAuthenticatedFile } from '../../lib/api.js';
import { failureFeedbackLabel, isFailedInterviewStatus } from './InterviewFailureFeedback.jsx';

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
  const stageMeetingLinks = draft.stageMeetingLinks || {};
  const currentStageNote = stageNotes[currentStage] || draft.interviewNotes || '';
  const currentStageMeetingLink = externalUrl(stageMeetingLinks[currentStage] || draft.meetingLink);
  const jobUrl = externalUrl(job.rawJob?.originalUrl || job.url || job.sourceUrl);
  const resumeUrl = resumeDownloadUrl(job.tailoredResume);
  const scheduledStepCount = interviewStepCount(job.bid);
  const hasAssociatedCall = Array.isArray(job.bid?.calls) && job.bid.calls.length > 0;

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
              fontWeight={600}
              sx={{
                color: 'text.primary',
              }}
            >
              {job.title || 'Untitled role'}
            </Typography>
            <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.25 }}>
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
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
        <Box sx={chipRowSx}>
          <Chip
            icon={<CalendarMonthIcon />}
            label={draft.interviewNextAt ? formatDateTimeInDefaultTimezone(draft.interviewNextAt) : 'No next date'}
            size="small"
            sx={{ ...chipSx, bgcolor: '#ECFDF5', color: '#486860', '& .MuiChip-icon': { color: '#486860' } }}
          />
          {owner ? <Chip label={owner} size="small" sx={{ ...chipSx, bgcolor: '#edf0ff', color: '#343f91' }} /> : null}
          <Chip label={stageLabel(currentStage)} size="small" sx={{ ...chipSx, bgcolor: 'rgba(0, 103, 192, 0.10)', color: '#005A9E' }} />
          {isFailedInterviewStatus(draft.status) ? (
            <Chip label={failureFeedbackLabel(draft.failureFeedback)} size="small" sx={{ ...chipSx, bgcolor: '#FEE2E2', color: '#991B1B' }} />
          ) : null}
          {!hasAssociatedCall ? <Chip label="Missing call" size="small" sx={{ ...chipSx, bgcolor: '#FEF3C7', color: '#92400E' }} /> : null}
          {scheduledStepCount > 1 ? <Chip label={`${scheduledStepCount} interviews`} size="small" sx={{ ...chipSx, bgcolor: '#F5F3FF', color: '#6D28D9' }} /> : null}
          <Chip label={formatDate(job.bid?.updatedAt)} size="small" sx={{ ...chipSx, bgcolor: '#f7ead1', color: '#70400d' }} />
          {currentStageMeetingLink ? (
            <Button
              component="a"
              href={currentStageMeetingLink}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<OpenInNewIcon fontSize="small" />}
              variant="contained"
              sx={{ minHeight: 24, px: 1, py: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}
            >
              Join
            </Button>
          ) : null}
          {jobUrl ? (
            <Button
              component="a"
              href={jobUrl}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<OpenInNewIcon fontSize="small" />}
              variant="outlined"
              sx={{ minHeight: 24, px: 1, py: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}
            >
              Job
            </Button>
          ) : null}
          {resumeUrl ? (
            <Button
              onClick={() => downloadAuthenticatedFile(resumeUrl, resumeFileName(job.tailoredResume?.filePath))}
              size="small"
              startIcon={<OpenInNewIcon fontSize="small" />}
              variant="outlined"
              sx={{ minHeight: 24, px: 1, py: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}
            >
              Resume
            </Button>
          ) : job.tailoredResume?.status ? (
            <Chip label={`Resume: ${job.tailoredResume.status}`} size="small" sx={{ ...chipSx, bgcolor: 'rgba(246, 248, 251, 0.86)', color: '#475569' }} />
          ) : null}
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
  fontWeight: 600,
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

function externalUrl(value) {
  return /^https?:\/\//i.test(String(value || '')) ? value : '';
}

function resumeDownloadUrl(resume) {
  if (resume?.status !== 'ready' || !resume?.filePath || !resume?.id) return '';
  return `/api/bid/tailored-resumes/${encodeURIComponent(resume.id)}/download`;
}

function interviewStepCount(bid) {
  const completedSteps = (bid?.logs || []).filter((log) => log.eventType === 'interview_occurrence').length;
  return completedSteps + (bid?.interviewNextAt ? 1 : 0);
}

function resumeFileName(filePath) {
  return filePath ? String(filePath).split('/').pop() || 'tailored-resume.docx' : 'tailored-resume.docx';
}

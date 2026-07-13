import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import WorkOffOutlinedIcon from '@mui/icons-material/WorkOffOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useProfileLearningReview, useUpdateProfileLearningReview } from '../../lib/api.js';
import { formatDateTimeInDefaultTimezone } from '../../lib/formatters.js';
import EmptyState from '../common/EmptyState.jsx';

const PAGE_SIZE = 20;
const OUTCOME_REASONS = [
  { value: '', label: 'Not confirmed' },
  { value: 'company_declined', label: 'Company declined' },
  { value: 'candidate_withdrew', label: 'Candidate withdrew' },
  { value: 'job_closed', label: 'Job closed' },
  { value: 'no_response', label: 'No response' },
  { value: 'unknown', label: 'Unknown' },
];

export default function ProfileLearningReview({ canEdit, canOpenLearningHub, profileId }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [declinedOnly, setDeclinedOnly] = useState(false);
  const [interviewedOnly, setInterviewedOnly] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const filters = {
    page,
    limit: PAGE_SIZE,
    search,
    declined: declinedOnly ? 'true' : '',
    interviewed: interviewedOnly ? 'true' : '',
  };
  const { data, error, isFetching, isLoading, refetch } = useProfileLearningReview(profileId, filters);
  const updateLearning = useUpdateProfileLearningReview();
  const items = data?.items || [];
  const summary = data?.summary || {};
  const pageCount = Math.max(1, Math.ceil(Number(data?.total || 0) / PAGE_SIZE));

  function toggleDeclined() {
    setDeclinedOnly((current) => !current);
    setPage(1);
  }

  function toggleInterviewed() {
    setInterviewedOnly((current) => !current);
    setPage(1);
  }

  function saveLearning(event) {
    event.preventDefault();
    updateLearning.mutate(
      {
        profileId,
        sourceType: editing.sourceType,
        sourceId: editing.sourceId,
        learning: {
          outcomeReason: editing.outcomeReason,
          outcomeAt: editing.outcomeAt,
          learningSummary: editing.learningSummary,
          nextAction: editing.nextAction,
        },
      },
      { onSuccess: () => setEditing(null) },
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
        <SummaryCard label="Learning opportunities" value={summary.total} detail="Unique jobs and manual interviews" />
        <SummaryCard label="Lost / declined" value={summary.declined} detail="Confirm the exact outcome reason" color="#B42318" />
        <SummaryCard label="Interview scheduled" value={summary.interviewed} detail={`${Number(summary.both || 0).toLocaleString()} also ended as lost`} color="#0067C0" />
        <SummaryCard label="Needs reflection" value={summary.needsReview} detail="No learning summary captured" color="#C77700" />
      </Box>

      <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, boxShadow: 1 }}>
        <TextField
          label="Search learning history"
          placeholder="Company, role, location, or notes"
          size="small"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ flex: '1 1 280px' }}
        />
        <Chip icon={<WorkOffOutlinedIcon />} label="Lost / declined" color={declinedOnly ? 'error' : 'default'} variant={declinedOnly ? 'filled' : 'outlined'} onClick={toggleDeclined} />
        <Chip icon={<EventAvailableOutlinedIcon />} label="Interview scheduled" color={interviewedOnly ? 'primary' : 'default'} variant={interviewedOnly ? 'filled' : 'outlined'} onClick={toggleInterviewed} />
        <Button onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
      </Paper>

      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {isLoading ? <LearningReviewSkeleton /> : null}
      {!isLoading && !items.length ? (
        <EmptyState
          title="No matching learning history"
          detail={declinedOnly || interviewedOnly || search ? 'Clear a filter or try another search.' : 'Lost applications and scheduled interviews will appear here automatically.'}
        />
      ) : null}
      {!isLoading && items.length ? (
        <Box sx={{ display: 'grid', gap: 1, opacity: isFetching ? 0.72 : 1, transition: 'opacity 120ms ease' }}>
          {items.map((item) => (
            <LearningReviewCard
              key={`${item.sourceType}-${item.sourceId}`}
              item={item}
              canEdit={canEdit}
              canOpenLearningHub={canOpenLearningHub}
              onEdit={() => setEditing(learningDraft(item))}
            />
          ))}
        </Box>
      ) : null}
      {pageCount > 1 ? <Pagination count={pageCount} page={Math.min(page, pageCount)} onChange={(_event, value) => setPage(value)} color="primary" sx={{ justifySelf: 'center' }} /> : null}

      <LearningReviewDialog
        draft={editing}
        error={updateLearning.error}
        isSaving={updateLearning.isPending}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={saveLearning}
      />
    </Box>
  );
}

function SummaryCard({ color = 'text.primary', detail, label, value = 0 }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0, boxShadow: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
      <Typography variant="h5" fontWeight={700} sx={{ color }}>{Number(value || 0).toLocaleString()}</Typography>
      <Typography variant="caption" color="text.secondary">{detail}</Typography>
    </Paper>
  );
}

function LearningReviewCard({ canEdit, canOpenLearningHub, item, onEdit }) {
  const notes = learningSourceNotes(item);
  const directory = item.companyDirectory;
  return (
    <Card variant="outlined" sx={{ boxShadow: 1 }}>
      <CardContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.3fr) minmax(260px, 0.9fr) auto' }, gap: 1.5, alignItems: 'start' }}>
        <Stack direction="row" spacing={1.25} minWidth={0}>
          <Avatar src={directory?.logoUrl || undefined} alt={directory ? `${directory.name} logo` : ''} variant="rounded" imgProps={{ loading: 'lazy', referrerPolicy: 'no-referrer' }} sx={{ bgcolor: '#fff', color: 'primary.main', border: 1, borderColor: 'divider', '& img': { objectFit: 'contain', p: 0.5 } }}>{item.company?.charAt(0)?.toUpperCase()}</Avatar>
          <Box minWidth={0}>
            <Typography fontWeight={650}>{item.title}</Typography>
            <Typography variant="body2" color="text.secondary">{[item.company, item.location].filter(Boolean).join(' · ')}</Typography>
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" mt={0.75}>
              {item.isDeclined ? <Chip size="small" color="error" variant="outlined" icon={<WorkOffOutlinedIcon />} label={outcomeLabel(item.outcomeReason)} /> : null}
              {item.interviewScheduled ? <Chip size="small" color="primary" variant="outlined" icon={<EventAvailableOutlinedIcon />} label="Interview scheduled" /> : null}
              {item.interviewStage ? <Chip size="small" label={humanize(item.interviewStage)} variant="outlined" /> : null}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>{interviewDetail(item)}</Typography>
            {notes ? <Typography variant="body2" color="text.secondary" mt={0.75} sx={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{notes}</Typography> : null}
          </Box>
        </Stack>

        <Box sx={{ minWidth: 0, borderLeft: { lg: 1 }, borderColor: { lg: 'divider' }, pl: { lg: 1.5 } }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>Captured learning</Typography>
          {item.learningSummary ? (
            <>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.learningSummary}</Typography>
              {item.nextAction ? <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>Next: {item.nextAction}</Typography> : null}
            </>
          ) : <Typography variant="body2" color="text.secondary">No reflection captured yet.</Typography>}
        </Box>

        <Stack spacing={0.5} alignItems={{ xs: 'stretch', lg: 'flex-end' }}>
          {canEdit ? <Button size="small" startIcon={<EditNoteOutlinedIcon />} onClick={onEdit}>{item.learningSummary ? 'Edit learning' : 'Capture learning'}</Button> : null}
          {directory && canOpenLearningHub ? <Button size="small" component={RouterLink} to={`/learning?category=companies&company=${encodeURIComponent(directory.slug)}`} startIcon={<MenuBookOutlinedIcon />}>Company learning</Button> : null}
          {item.jobUrl ? <Button size="small" component="a" href={item.jobUrl} target="_blank" rel="noopener noreferrer" startIcon={<LaunchOutlinedIcon />}>Job listing</Button> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function LearningReviewDialog({ draft, error, isSaving, onChange, onClose, onSubmit }) {
  if (!draft) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit}>
        <DialogTitle>Capture learning · {draft.title}</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'grid', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">{draft.company}</Typography>
          {error ? <Alert severity="error">{error.message}</Alert> : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
            <FormControl>
              <InputLabel>Outcome reason</InputLabel>
              <Select label="Outcome reason" value={draft.outcomeReason} onChange={(event) => onChange({ ...draft, outcomeReason: event.target.value })}>
                {OUTCOME_REASONS.map((reason) => <MenuItem key={reason.value || 'unset'} value={reason.value}>{reason.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Outcome date" type="date" value={draft.outcomeAt} onChange={(event) => onChange({ ...draft, outcomeAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          <TextField required label="What did we learn?" multiline minRows={5} value={draft.learningSummary} onChange={(event) => onChange({ ...draft, learningSummary: event.target.value })} inputProps={{ maxLength: 8000 }} />
          <TextField label="Next action" multiline minRows={2} value={draft.nextAction} onChange={(event) => onChange({ ...draft, nextAction: event.target.value })} placeholder="Adjust targeting, resume evidence, preparation, or follow-up" inputProps={{ maxLength: 4000 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSaving || !draft.learningSummary.trim()}>{isSaving ? 'Saving…' : 'Save learning'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function LearningReviewSkeleton() {
  return <Box sx={{ display: 'grid', gap: 1 }}>{[0, 1, 2].map((item) => <Skeleton key={item} variant="rounded" height={142} />)}</Box>;
}

function learningDraft(item) {
  return {
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    title: item.title,
    company: item.company,
    outcomeReason: item.outcomeReason || '',
    outcomeAt: dateInputValue(item.outcomeAt),
    learningSummary: item.learningSummary || '',
    nextAction: item.nextAction || '',
  };
}

function learningSourceNotes(item) {
  const stageNotes = Object.values(item.stageNotes || {}).filter(Boolean);
  return [item.interviewNotes, item.applicationNotes, ...stageNotes].filter(Boolean).join('\n');
}

function interviewDetail(item) {
  const parts = [];
  if (item.callCount) parts.push(`${item.callCount} scheduled ${item.callCount === 1 ? 'call' : 'calls'}`);
  if (item.nextInterviewAt) parts.push(`Next ${formatDateTimeInDefaultTimezone(item.nextInterviewAt)}`);
  else if (item.lastInterviewAt || item.firstInterviewAt) parts.push(`Last scheduled ${formatDateTimeInDefaultTimezone(item.lastInterviewAt || item.firstInterviewAt)}`);
  if (item.outcomeAt) parts.push(`Outcome ${formatDateOnly(item.outcomeAt)}`);
  return parts.join(' · ') || 'No dated interview activity';
}

function outcomeLabel(reason) {
  if (reason === 'company_declined') return 'Company declined';
  if (reason === 'candidate_withdrew') return 'Candidate withdrew';
  if (reason === 'job_closed') return 'Job closed';
  if (reason === 'no_response') return 'No response';
  if (reason === 'unknown') return 'Outcome unknown';
  return 'Lost / declined';
}

function humanize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function formatDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return String(value || '');
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString();
}

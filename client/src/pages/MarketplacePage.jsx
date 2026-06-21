import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { formatDateTime } from '../lib/formatters.js';
import {
  useCreateMarketplaceCaller,
  useCreateMarketplaceInterview,
  useCreateMarketplaceMatch,
  useMarketplace,
  useReviewMarketplaceCaller,
  useReviewMarketplaceInterview,
  useReviewMarketplaceParticipant,
  useUpdateMarketplaceMatch,
  useUpsertMarketplaceParticipant,
} from '../lib/api.js';

const EMPTY_PARTICIPANT = { participantRole: 'both', displayName: '', timezone: '', publicNotes: '' };
const EMPTY_INTERVIEW = {
  title: '',
  company: '',
  stage: 'screen',
  format: 'phone',
  timezone: '',
  availabilityWindows: '',
  requiredSkills: '',
  budget: '',
  jobUrl: '',
  notes: '',
};
const EMPTY_CALLER = {
  callerName: '',
  skills: '',
  languages: '',
  experience: '',
  timezone: '',
  availabilityWindows: '',
  preferredCategories: '',
  rateExpectation: '',
  constraints: '',
};
const EMPTY_MATCH = { interviewOpportunityId: '', callerProfileId: '', status: 'suggested', internalNotes: '' };

const reviewStatuses = ['pending', 'approved', 'needs_info', 'rejected', 'suspended'];
const riskStatuses = ['normal', 'watch', 'blocked'];
const interviewMatchStatuses = ['submitted', 'matching', 'matched', 'scheduled', 'completed', 'closed', 'cancelled', 'rejected'];
const availabilityStatuses = ['available', 'matched', 'scheduled', 'in_progress', 'unavailable', 'suspended'];
const matchStatuses = ['suggested', 'internal_review', 'pending_caller_confirmation', 'pending_interview_confirmation', 'confirmed', 'scheduled', 'in_progress', 'completed', 'offer_tracking', 'closed', 'cancelled', 'failed'];
const confirmationStatuses = ['pending', 'confirmed', 'declined'];
const outcomeStatuses = ['pending', 'completed', 'next_round', 'rejected', 'offer_received', 'offer_accepted', 'offer_declined', 'cancelled', 'no_show'];
const offerStatuses = ['none', 'pending', 'confirmed', 'accepted', 'declined'];
const paymentStatuses = ['not_started', 'pending_confirmation', 'requested', 'paid', 'closed'];
const payoutStatuses = ['not_started', 'pending', 'completed', 'closed'];

export default function MarketplacePage({ currentUser }) {
  const [tab, setTab] = useState('matches');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState('');
  const [participantForm, setParticipantForm] = useState(EMPTY_PARTICIPANT);
  const [interviewForm, setInterviewForm] = useState(EMPTY_INTERVIEW);
  const [callerForm, setCallerForm] = useState(EMPTY_CALLER);
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH);
  const [error, setError] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data, isLoading, error: loadError } = useMarketplace();
  const upsertParticipant = useUpsertMarketplaceParticipant();
  const createInterview = useCreateMarketplaceInterview();
  const createCaller = useCreateMarketplaceCaller();
  const createMatch = useCreateMarketplaceMatch();
  const reviewParticipant = useReviewMarketplaceParticipant();
  const reviewInterview = useReviewMarketplaceInterview();
  const reviewCaller = useReviewMarketplaceCaller();
  const updateMatch = useUpdateMarketplaceMatch();

  const canManage = Boolean(data?.canManage);
  const participants = data?.participants || [];
  const interviews = data?.interviews || [];
  const callers = data?.callers || [];
  const matches = data?.matches || [];
  const approvedInterviews = interviews.filter((interview) => interview.reviewStatus === 'approved');
  const approvedCallers = callers.filter((caller) => caller.reviewStatus === 'approved' && caller.availabilityStatus !== 'suspended');

  const filtered = useMemo(() => {
    const pattern = search.trim().toLowerCase();
    const contains = (values) => !pattern || values.filter(Boolean).some((value) => String(value).toLowerCase().includes(pattern));
    return {
      participants: participants.filter((row) => contains([row.displayName, row.username, row.participantRole, row.reviewStatus])),
      interviews: interviews.filter((row) => contains([row.title, row.company, row.ownerUsername, row.reviewStatus, row.matchStatus])),
      callers: callers.filter((row) => contains([row.callerName, row.skills, row.ownerUsername, row.reviewStatus, row.availabilityStatus])),
      matches: matches.filter((row) =>
        contains([
          row.status,
          row.outcomeStatus,
          row.offerStatus,
          row.interviewOpportunity?.title,
          row.interviewOpportunity?.company,
          row.callerProfile?.callerName,
        ]),
      ),
    };
  }, [callers, interviews, matches, participants, search]);

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search marketplace',
      value: search,
      onChange: setSearch,
    });
  }, [search, setHeaderSearch]);

  useEffect(() => () => setHeaderSearch(EMPTY_HEADER_SEARCH), [setHeaderSearch]);

  useEffect(() => {
    if (data?.participant) {
      setParticipantForm({
        participantRole: data.participant.participantRole || 'both',
        displayName: data.participant.displayName || currentUser.username || '',
        timezone: data.participant.timezone || '',
        publicNotes: data.participant.publicNotes || '',
      });
    } else {
      setParticipantForm((current) => ({ ...current, displayName: current.displayName || currentUser.username || '' }));
    }
  }, [currentUser.username, data?.participant]);

  function closeDialog() {
    setDialog('');
    setError('');
    setInterviewForm(EMPTY_INTERVIEW);
    setCallerForm(EMPTY_CALLER);
    setMatchForm(EMPTY_MATCH);
  }

  function submitParticipant(event) {
    event.preventDefault();
    setError('');
    upsertParticipant.mutate(participantForm, {
      onSuccess: closeDialog,
      onError: (mutationError) => setError(mutationError.message),
    });
  }

  function submitInterview(event) {
    event.preventDefault();
    setError('');
    createInterview.mutate(interviewForm, {
      onSuccess: closeDialog,
      onError: (mutationError) => setError(mutationError.message),
    });
  }

  function submitCaller(event) {
    event.preventDefault();
    setError('');
    createCaller.mutate(callerForm, {
      onSuccess: closeDialog,
      onError: (mutationError) => setError(mutationError.message),
    });
  }

  function submitMatch(event) {
    event.preventDefault();
    setError('');
    createMatch.mutate(matchForm, {
      onSuccess: closeDialog,
      onError: (mutationError) => setError(mutationError.message),
    });
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {loadError ? <Alert severity="error">{loadError.message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 1.25, boxShadow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6" fontWeight={900}>
              Managed Interview Marketplace
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Internal team controls review, matching, communication, scheduling, outcomes, and payouts.
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setDialog('participant')}>
              Marketplace profile
            </Button>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setDialog('interview')}>
              Interview
            </Button>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setDialog('caller')}>
              Caller
            </Button>
            {canManage ? (
              <Button startIcon={<HandshakeIcon />} variant="contained" onClick={() => setDialog('match')}>
                Match
              </Button>
            ) : null}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Metric icon={<PendingActionsIcon />} label="Pending review" value={pendingReviewCount(participants, interviews, callers)} />
          <Metric icon={<HandshakeIcon />} label="Active matches" value={matches.filter((match) => !['closed', 'cancelled', 'failed'].includes(match.status)).length} />
          <Metric icon={<ScheduleIcon />} label="Scheduled" value={matches.filter((match) => match.status === 'scheduled').length} />
          <Metric icon={<CheckCircleIcon />} label="Offer tracking" value={matches.filter((match) => match.status === 'offer_tracking' || match.offerStatus !== 'none').length} />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ boxShadow: 1 }}>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable">
          <Tab label="Matches" value="matches" />
          <Tab label="Interviews" value="interviews" />
          <Tab label="Callers" value="callers" />
          {canManage ? <Tab label="Participants" value="participants" /> : null}
        </Tabs>
      </Paper>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && tab === 'matches' ? (
        <MatchList matches={filtered.matches} canManage={canManage} currentUser={currentUser} updateMatch={updateMatch} />
      ) : null}
      {!isLoading && tab === 'interviews' ? (
        <InterviewList interviews={filtered.interviews} canManage={canManage} reviewInterview={reviewInterview} />
      ) : null}
      {!isLoading && tab === 'callers' ? (
        <CallerList callers={filtered.callers} canManage={canManage} reviewCaller={reviewCaller} />
      ) : null}
      {!isLoading && tab === 'participants' && canManage ? (
        <ParticipantList participants={filtered.participants} reviewParticipant={reviewParticipant} />
      ) : null}

      <ProfileDialog
        form={participantForm}
        isOpen={dialog === 'participant'}
        isSaving={upsertParticipant.isPending}
        onChange={setParticipantForm}
        onClose={closeDialog}
        onSubmit={submitParticipant}
      />
      <InterviewDialog
        form={interviewForm}
        isOpen={dialog === 'interview'}
        isSaving={createInterview.isPending}
        onChange={setInterviewForm}
        onClose={closeDialog}
        onSubmit={submitInterview}
      />
      <CallerDialog
        form={callerForm}
        isOpen={dialog === 'caller'}
        isSaving={createCaller.isPending}
        onChange={setCallerForm}
        onClose={closeDialog}
        onSubmit={submitCaller}
      />
      <MatchDialog
        callers={approvedCallers}
        form={matchForm}
        interviews={approvedInterviews}
        isOpen={dialog === 'match'}
        isSaving={createMatch.isPending}
        onChange={setMatchForm}
        onClose={closeDialog}
        onSubmit={submitMatch}
      />
    </Box>
  );
}

function ParticipantList({ participants, reviewParticipant }) {
  return (
    <ResponsiveGrid>
      {participants.map((participant) => (
        <RecordCard
          key={participant.id}
          title={participant.displayName}
          subtitle={[participant.username, labelize(participant.participantRole)].filter(Boolean).join(' · ')}
          chips={[
            statusChip(participant.reviewStatus),
            statusChip(participant.riskStatus),
          ]}
        >
          <Typography variant="body2" color="text.secondary">{participant.publicNotes || 'No participant notes.'}</Typography>
          <ReviewControls
            fields={[
              ['reviewStatus', reviewStatuses],
              ['riskStatus', riskStatuses],
            ]}
            initial={{ reviewStatus: participant.reviewStatus, riskStatus: participant.riskStatus, internalNotes: participant.internalNotes || '' }}
            isSaving={reviewParticipant.isPending}
            notesLabel="Internal notes"
            onSubmit={(reviewData) => reviewParticipant.mutate({ participantId: participant.id, reviewData })}
          />
        </RecordCard>
      ))}
    </ResponsiveGrid>
  );
}

function InterviewList({ interviews, canManage, reviewInterview }) {
  return (
    <ResponsiveGrid>
      {interviews.map((interview) => (
        <RecordCard
          key={interview.id}
          title={interview.title}
          subtitle={[interview.company || 'Unknown company', interview.ownerUsername].filter(Boolean).join(' · ')}
          chips={[statusChip(interview.reviewStatus), statusChip(interview.matchStatus)]}
        >
          <DetailRows rows={[
            ['Stage', interview.stage],
            ['Format', interview.format],
            ['Timezone', interview.timezone],
            ['Budget', interview.budget],
            ['Availability', interview.availabilityWindows],
            ['Required skills', interview.requiredSkills],
          ]} />
          <Typography variant="body2" color="text.secondary">{interview.notes || 'No interview notes.'}</Typography>
          {canManage ? (
            <ReviewControls
              fields={[
                ['reviewStatus', reviewStatuses],
                ['matchStatus', interviewMatchStatuses],
              ]}
              initial={{ reviewStatus: interview.reviewStatus, matchStatus: interview.matchStatus, internalNotes: interview.internalNotes || '' }}
              isSaving={reviewInterview.isPending}
              notesLabel="Internal notes"
              onSubmit={(reviewData) => reviewInterview.mutate({ interviewId: interview.id, reviewData })}
            />
          ) : null}
        </RecordCard>
      ))}
    </ResponsiveGrid>
  );
}

function CallerList({ callers, canManage, reviewCaller }) {
  return (
    <ResponsiveGrid>
      {callers.map((caller) => (
        <RecordCard
          key={caller.id}
          title={caller.callerName}
          subtitle={[caller.ownerUsername, caller.timezone].filter(Boolean).join(' · ')}
          chips={[statusChip(caller.reviewStatus), statusChip(caller.availabilityStatus)]}
        >
          <DetailRows rows={[
            ['Skills', caller.skills],
            ['Languages', caller.languages],
            ['Experience', caller.experience],
            ['Availability', caller.availabilityWindows],
            ['Rate', caller.rateExpectation],
            ['Constraints', caller.constraints],
          ]} />
          {canManage ? (
            <ReviewControls
              fields={[
                ['reviewStatus', reviewStatuses],
                ['availabilityStatus', availabilityStatuses],
              ]}
              initial={{
                reviewStatus: caller.reviewStatus,
                availabilityStatus: caller.availabilityStatus,
                performanceNotes: caller.performanceNotes || '',
                internalNotes: caller.internalNotes || '',
              }}
              isSaving={reviewCaller.isPending}
              notesLabel="Internal notes"
              extraNotesLabel="Performance notes"
              onSubmit={(reviewData) => reviewCaller.mutate({ callerId: caller.id, reviewData })}
            />
          ) : null}
        </RecordCard>
      ))}
    </ResponsiveGrid>
  );
}

function MatchList({ canManage, currentUser, matches, updateMatch }) {
  return (
    <ResponsiveGrid>
      {matches.map((match) => {
        const isInterviewOwner = String(match.interviewOpportunity?.ownerUserId) === String(currentUser.id);
        const isCallerOwner = String(match.callerProfile?.ownerUserId) === String(currentUser.id);
        return (
          <RecordCard
            key={match.id}
            title={match.interviewOpportunity?.title || 'Untitled interview'}
            subtitle={[match.interviewOpportunity?.company, match.callerProfile?.callerName].filter(Boolean).join(' · ')}
            chips={[statusChip(match.status), statusChip(match.outcomeStatus), statusChip(match.offerStatus)]}
          >
            <DetailRows rows={[
              ['Scheduled', formatDateTime(match.scheduledAt)],
              ['Caller confirmation', match.callerConfirmationStatus],
              ['Interview confirmation', match.interviewConfirmationStatus],
              ['Payment', match.paymentStatus],
              ['Payout', match.payoutStatus],
              ['Offer', [match.offerAmount, match.offerTerms].filter(Boolean).join(' · ')],
            ]} />
            {canManage ? (
              <MatchControls match={match} isSaving={updateMatch.isPending} onSubmit={(matchData) => updateMatch.mutate({ matchId: match.id, matchData })} />
            ) : (
              <UserMatchControls
                isCallerOwner={isCallerOwner}
                isInterviewOwner={isInterviewOwner}
                isSaving={updateMatch.isPending}
                match={match}
                onSubmit={(matchData) => updateMatch.mutate({ matchId: match.id, matchData })}
              />
            )}
          </RecordCard>
        );
      })}
    </ResponsiveGrid>
  );
}

function ReviewControls({ extraNotesLabel = '', fields, initial, isSaving, notesLabel, onSubmit }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  return (
    <Box component="form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} sx={{ display: 'grid', gap: 0.75 }}>
      <Divider />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${fields.length}, minmax(0, 1fr))` }, gap: 0.75 }}>
        {fields.map(([key, values]) => (
          <EnumSelect key={key} label={labelize(key)} value={form[key] || ''} values={values} onChange={(value) => setForm((current) => ({ ...current, [key]: value }))} />
        ))}
      </Box>
      {extraNotesLabel ? (
        <TextField label={extraNotesLabel} value={form.performanceNotes || ''} onChange={(event) => setForm((current) => ({ ...current, performanceNotes: event.target.value }))} size="small" multiline minRows={2} />
      ) : null}
      <TextField label={notesLabel} value={form.internalNotes || ''} onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} size="small" multiline minRows={2} />
      <Button type="submit" variant="outlined" disabled={isSaving} sx={{ justifySelf: 'end' }}>Save review</Button>
    </Box>
  );
}

function MatchControls({ isSaving, match, onSubmit }) {
  const [form, setForm] = useState(() => matchFormFromMatch(match));
  useEffect(() => setForm(matchFormFromMatch(match)), [match]);

  return (
    <Box component="form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null }); }} sx={{ display: 'grid', gap: 0.75 }}>
      <Divider />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 0.75 }}>
        <EnumSelect label="Status" value={form.status} values={matchStatuses} onChange={(value) => setForm((current) => ({ ...current, status: value }))} />
        <EnumSelect label="Caller confirmation" value={form.callerConfirmationStatus} values={confirmationStatuses} onChange={(value) => setForm((current) => ({ ...current, callerConfirmationStatus: value }))} />
        <EnumSelect label="Interview confirmation" value={form.interviewConfirmationStatus} values={confirmationStatuses} onChange={(value) => setForm((current) => ({ ...current, interviewConfirmationStatus: value }))} />
        <EnumSelect label="Outcome" value={form.outcomeStatus} values={outcomeStatuses} onChange={(value) => setForm((current) => ({ ...current, outcomeStatus: value }))} />
        <EnumSelect label="Offer" value={form.offerStatus} values={offerStatuses} onChange={(value) => setForm((current) => ({ ...current, offerStatus: value }))} />
        <EnumSelect label="Payment" value={form.paymentStatus} values={paymentStatuses} onChange={(value) => setForm((current) => ({ ...current, paymentStatus: value }))} />
        <EnumSelect label="Payout" value={form.payoutStatus} values={payoutStatuses} onChange={(value) => setForm((current) => ({ ...current, payoutStatus: value }))} />
        <TextField label="Scheduled" type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
        <TextField label="Meeting link" value={form.meetingLink} onChange={(event) => setForm((current) => ({ ...current, meetingLink: event.target.value }))} size="small" />
        <TextField label="Offer amount" value={form.offerAmount} onChange={(event) => setForm((current) => ({ ...current, offerAmount: event.target.value }))} size="small" />
        <TextField label="Platform fee" value={form.platformFee} onChange={(event) => setForm((current) => ({ ...current, platformFee: event.target.value }))} size="small" />
        <TextField label="Caller payout" value={form.callerPayout} onChange={(event) => setForm((current) => ({ ...current, callerPayout: event.target.value }))} size="small" />
      </Box>
      <TextField label="Offer terms" value={form.offerTerms} onChange={(event) => setForm((current) => ({ ...current, offerTerms: event.target.value }))} size="small" multiline minRows={2} />
      <TextField label="Internal notes" value={form.internalNotes} onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} size="small" multiline minRows={2} />
      <Button type="submit" variant="outlined" disabled={isSaving} sx={{ justifySelf: 'end' }}>Save match</Button>
    </Box>
  );
}

function UserMatchControls({ isCallerOwner, isInterviewOwner, isSaving, match, onSubmit }) {
  const [form, setForm] = useState({
    callerConfirmationStatus: match.callerConfirmationStatus || 'pending',
    interviewConfirmationStatus: match.interviewConfirmationStatus || 'pending',
    callerOwnerNotes: match.callerOwnerNotes || '',
    interviewOwnerNotes: match.interviewOwnerNotes || '',
  });
  useEffect(() => {
    setForm({
      callerConfirmationStatus: match.callerConfirmationStatus || 'pending',
      interviewConfirmationStatus: match.interviewConfirmationStatus || 'pending',
      callerOwnerNotes: match.callerOwnerNotes || '',
      interviewOwnerNotes: match.interviewOwnerNotes || '',
    });
  }, [match]);

  return (
    <Box component="form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} sx={{ display: 'grid', gap: 0.75 }}>
      <Divider />
      {isInterviewOwner ? (
        <>
          <EnumSelect label="Interview confirmation" value={form.interviewConfirmationStatus} values={confirmationStatuses} onChange={(value) => setForm((current) => ({ ...current, interviewConfirmationStatus: value }))} />
          <TextField label="Notes to internal team" value={form.interviewOwnerNotes} onChange={(event) => setForm((current) => ({ ...current, interviewOwnerNotes: event.target.value }))} size="small" multiline minRows={2} />
        </>
      ) : null}
      {isCallerOwner ? (
        <>
          <EnumSelect label="Caller confirmation" value={form.callerConfirmationStatus} values={confirmationStatuses} onChange={(value) => setForm((current) => ({ ...current, callerConfirmationStatus: value }))} />
          <TextField label="Notes to internal team" value={form.callerOwnerNotes} onChange={(event) => setForm((current) => ({ ...current, callerOwnerNotes: event.target.value }))} size="small" multiline minRows={2} />
        </>
      ) : null}
      <Button type="submit" variant="outlined" disabled={isSaving} sx={{ justifySelf: 'end' }}>Send update</Button>
    </Box>
  );
}

function ProfileDialog({ form, isOpen, isSaving, onChange, onClose, onSubmit }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>Marketplace profile</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1, pt: 2 }}>
          <EnumSelect label="Role" value={form.participantRole} values={['interview_owner', 'caller_owner', 'both']} onChange={(value) => onChange({ ...form, participantRole: value })} />
          <TextField label="Display name" value={form.displayName} onChange={(event) => onChange({ ...form, displayName: event.target.value })} required />
          <TextField label="Timezone" value={form.timezone} onChange={(event) => onChange({ ...form, timezone: event.target.value })} />
          <TextField label="Notes" value={form.publicNotes} onChange={(event) => onChange({ ...form, publicNotes: event.target.value })} multiline minRows={3} />
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={isSaving}>Save</Button></DialogActions>
      </Box>
    </Dialog>
  );
}

function InterviewDialog({ form, isOpen, isSaving, onChange, onClose, onSubmit }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>Submit interview opportunity</DialogTitle>
        <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1, pt: 2 }}>
          <TextField label="Job title" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} required />
          <TextField label="Company" value={form.company} onChange={(event) => onChange({ ...form, company: event.target.value })} />
          <TextField label="Stage" value={form.stage} onChange={(event) => onChange({ ...form, stage: event.target.value })} />
          <TextField label="Format" value={form.format} onChange={(event) => onChange({ ...form, format: event.target.value })} />
          <TextField label="Timezone" value={form.timezone} onChange={(event) => onChange({ ...form, timezone: event.target.value })} />
          <TextField label="Budget" value={form.budget} onChange={(event) => onChange({ ...form, budget: event.target.value })} />
          <TextField label="Job URL" value={form.jobUrl} onChange={(event) => onChange({ ...form, jobUrl: event.target.value })} sx={{ gridColumn: { sm: '1 / -1' } }} />
          <TextField label="Availability windows" value={form.availabilityWindows} onChange={(event) => onChange({ ...form, availabilityWindows: event.target.value })} multiline minRows={2} />
          <TextField label="Required caller skills" value={form.requiredSkills} onChange={(event) => onChange({ ...form, requiredSkills: event.target.value })} multiline minRows={2} />
          <TextField label="Notes" value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} multiline minRows={3} sx={{ gridColumn: { sm: '1 / -1' } }} />
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={isSaving}>Submit</Button></DialogActions>
      </Box>
    </Dialog>
  );
}

function CallerDialog({ form, isOpen, isSaving, onChange, onClose, onSubmit }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>Submit caller profile</DialogTitle>
        <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1, pt: 2 }}>
          <TextField label="Caller name or label" value={form.callerName} onChange={(event) => onChange({ ...form, callerName: event.target.value })} required />
          <TextField label="Timezone" value={form.timezone} onChange={(event) => onChange({ ...form, timezone: event.target.value })} />
          <TextField label="Languages" value={form.languages} onChange={(event) => onChange({ ...form, languages: event.target.value })} />
          <TextField label="Rate expectation" value={form.rateExpectation} onChange={(event) => onChange({ ...form, rateExpectation: event.target.value })} />
          <TextField label="Skills" value={form.skills} onChange={(event) => onChange({ ...form, skills: event.target.value })} multiline minRows={2} />
          <TextField label="Experience" value={form.experience} onChange={(event) => onChange({ ...form, experience: event.target.value })} multiline minRows={2} />
          <TextField label="Availability windows" value={form.availabilityWindows} onChange={(event) => onChange({ ...form, availabilityWindows: event.target.value })} multiline minRows={2} />
          <TextField label="Preferred categories" value={form.preferredCategories} onChange={(event) => onChange({ ...form, preferredCategories: event.target.value })} multiline minRows={2} />
          <TextField label="Constraints" value={form.constraints} onChange={(event) => onChange({ ...form, constraints: event.target.value })} multiline minRows={3} sx={{ gridColumn: { sm: '1 / -1' } }} />
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={isSaving}>Submit</Button></DialogActions>
      </Box>
    </Dialog>
  );
}

function MatchDialog({ callers, form, interviews, isOpen, isSaving, onChange, onClose, onSubmit }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>Create controlled match</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1, pt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Interview</InputLabel>
            <Select label="Interview" value={form.interviewOpportunityId} onChange={(event) => onChange({ ...form, interviewOpportunityId: event.target.value })} required>
              {interviews.map((interview) => <MenuItem key={interview.id} value={interview.id}>{[interview.title, interview.company, interview.ownerUsername].filter(Boolean).join(' · ')}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Caller</InputLabel>
            <Select label="Caller" value={form.callerProfileId} onChange={(event) => onChange({ ...form, callerProfileId: event.target.value })} required>
              {callers.map((caller) => <MenuItem key={caller.id} value={caller.id}>{[caller.callerName, caller.ownerUsername, caller.timezone].filter(Boolean).join(' · ')}</MenuItem>)}
            </Select>
          </FormControl>
          <EnumSelect label="Initial status" value={form.status} values={matchStatuses} onChange={(value) => onChange({ ...form, status: value })} />
          <TextField label="Internal notes" value={form.internalNotes} onChange={(event) => onChange({ ...form, internalNotes: event.target.value })} multiline minRows={3} />
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={isSaving}>Create</Button></DialogActions>
      </Box>
    </Dialog>
  );
}

function EnumSelect({ label, onChange, value, values }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value || ''} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <MenuItem key={item} value={item}>{labelize(item)}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function RecordCard({ children, chips, subtitle, title }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 1, boxShadow: 1, alignContent: 'start' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
        <Box minWidth={0}>
          <Typography fontWeight={900} noWrap>{title}</Typography>
          <Typography color="text.secondary" variant="caption" noWrap>{subtitle}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">{chips}</Stack>
      </Box>
      {children}
    </Paper>
  );
}

function ResponsiveGrid({ children }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
      {children}
    </Box>
  );
}

function DetailRows({ rows }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.45 }}>
      {rows.filter(([, value]) => Boolean(value)).map(([label, value]) => (
        <Typography key={label} variant="caption" color="text.secondary">
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 900 }}>{label}: </Box>{value}
        </Typography>
      ))}
    </Box>
  );
}

function Metric({ icon, label, value }) {
  return (
    <Chip icon={icon} label={`${label}: ${value}`} sx={{ bgcolor: '#f8fafc', border: 1, borderColor: 'divider', fontWeight: 800 }} />
  );
}

function LoadingState() {
  return (
    <ResponsiveGrid>
      {Array.from({ length: 6 }).map((_, index) => (
        <Paper key={`marketplace-loading-${index}`} variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 1, boxShadow: 1 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton width="52%" />
              <Skeleton width="38%" />
            </Box>
            <Stack direction="row" spacing={0.5}>
              <Skeleton variant="rounded" width={76} height={24} />
              <Skeleton variant="rounded" width={88} height={24} />
            </Stack>
          </Stack>
          <Skeleton variant="rounded" height={74} />
          <Stack direction="row" spacing={0.75} justifyContent="flex-end">
            <Skeleton variant="rounded" width={92} height={32} />
            <Skeleton variant="rounded" width={92} height={32} />
          </Stack>
        </Paper>
      ))}
    </ResponsiveGrid>
  );
}

function statusChip(status) {
  return (
    <Chip
      key={status}
      label={labelize(status)}
      size="small"
      sx={{
        bgcolor: statusColor(status).bg,
        color: statusColor(status).fg,
        fontWeight: 800,
      }}
    />
  );
}

function statusColor(status) {
  if (['approved', 'confirmed', 'completed', 'offer_accepted', 'paid'].includes(status)) return { bg: '#dcfce7', fg: '#166534' };
  if (['rejected', 'suspended', 'declined', 'cancelled', 'failed', 'blocked', 'no_show'].includes(status)) return { bg: '#fee2e2', fg: '#991b1b' };
  if (['needs_info', 'pending', 'pending_confirmation', 'requested', 'offer_tracking'].includes(status)) return { bg: '#fff7ed', fg: '#9a3412' };
  return { bg: '#eff6ff', fg: '#1d4ed8' };
}

function pendingReviewCount(participants, interviews, callers) {
  return [...participants, ...interviews, ...callers].filter((row) => row.reviewStatus === 'pending').length;
}

function labelize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchFormFromMatch(match) {
  return {
    status: match.status || 'suggested',
    callerConfirmationStatus: match.callerConfirmationStatus || 'pending',
    interviewConfirmationStatus: match.interviewConfirmationStatus || 'pending',
    outcomeStatus: match.outcomeStatus || 'pending',
    offerStatus: match.offerStatus || 'none',
    paymentStatus: match.paymentStatus || 'not_started',
    payoutStatus: match.payoutStatus || 'not_started',
    scheduledAt: toDatetimeLocal(match.scheduledAt),
    meetingLink: match.meetingLink || '',
    internalNotes: match.internalNotes || '',
    offerAmount: match.offerAmount || '',
    offerTerms: match.offerTerms || '',
    platformFee: match.platformFee || '',
    callerPayout: match.callerPayout || '',
  };
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

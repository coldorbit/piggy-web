import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CollaborationPanel from '../components/collaboration/CollaborationPanel.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  useCreateProfileStory,
  useDeleteProfileStory,
  useGeocodeProfileLocation,
  useProfileHub,
  useUpdateProfileIntelligence,
  useUpdateProfilePrepPlan,
  useUpdateProfileStory,
} from '../lib/api.js';
import { formatDateTimeInDefaultTimezone } from '../lib/formatters.js';

const HUB_TABS = ['overview', 'career-story', 'interview-prep', 'location-context', 'activity'];
const HUB_TAB_LABELS = {
  overview: 'Overview',
  'career-story': 'Career Story',
  'interview-prep': 'Interview Prep',
  'location-context': 'Location Context',
  activity: 'Activity',
};
const TARGET_LEVELS = [
  { value: '', label: 'Not set' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'senior_staff', label: 'Senior Staff' },
  { value: 'principal', label: 'Principal' },
  { value: 'distinguished', label: 'Distinguished' },
];
const SCORE_OPTIONS = [
  { value: 0, label: '0 · Not assessed' },
  { value: 1, label: '1 · Needs evidence' },
  { value: 2, label: '2 · Interview ready' },
  { value: 3, label: '3 · Signature strength' },
];
const EMPTY_STORY = {
  title: '',
  situation: '',
  responsibility: '',
  actions: '',
  result: '',
  metrics: '',
  lessons: '',
  competencies: [],
  verificationStatus: 'draft',
};

export default function ProfileHubPage({ currentUser }) {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'overview';
  const activeTab = HUB_TABS.includes(requestedTab) ? requestedTab : 'overview';
  const { data: hub, isLoading, error, refetch } = useProfileHub(profileId);
  const [detailsDraft, setDetailsDraft] = useState(null);
  const [prepDraft, setPrepDraft] = useState(null);
  const [storyDraft, setStoryDraft] = useState(null);
  const [residentAddress, setResidentAddress] = useState('');
  const [notice, setNotice] = useState('');
  const updateIntelligence = useUpdateProfileIntelligence();
  const geocodeLocation = useGeocodeProfileLocation();
  const createStory = useCreateProfileStory();
  const updateStory = useUpdateProfileStory();
  const deleteStory = useDeleteProfileStory();
  const updatePrep = useUpdateProfilePrepPlan();

  useEffect(() => {
    if (hub?.intelligence) setDetailsDraft({ ...hub.intelligence });
  }, [hub?.intelligence]);

  useEffect(() => {
    if (hub?.prepPlan) setPrepDraft({ ...hub.prepPlan });
  }, [hub?.prepPlan]);

  const mutationError = [updateIntelligence, geocodeLocation, createStory, updateStory, deleteStory, updatePrep]
    .map((mutation) => mutation.error?.message)
    .find(Boolean);

  function changeTab(_event, value) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  }

  function saveDetails(event) {
    event.preventDefault();
    setNotice('');
    updateIntelligence.mutate(
      { profileId, intelligence: detailsDraft },
      { onSuccess: () => setNotice('Profile intelligence saved.') },
    );
  }

  function verifyAddress(event) {
    event.preventDefault();
    setNotice('');
    geocodeLocation.mutate(
      { profileId, address: residentAddress, countryCode: detailsDraft?.countryCode || 'US' },
      {
        onSuccess: (result) => {
          setResidentAddress('');
          setNotice(`Location verified${result.matchedAddress ? ` as ${result.matchedAddress}` : ''}. The street address was not saved.`);
        },
      },
    );
  }

  function submitStory(event) {
    event.preventDefault();
    const mutation = storyDraft?.id ? updateStory : createStory;
    mutation.mutate(
      storyDraft?.id
        ? { profileId, storyId: storyDraft.id, story: storyDraft }
        : { profileId, story: storyDraft },
      {
        onSuccess: () => {
          setStoryDraft(null);
          setNotice('Career story saved.');
        },
      },
    );
  }

  function removeStory(story) {
    if (!window.confirm(`Delete “${story.title}”?`)) return;
    deleteStory.mutate({ profileId, storyId: story.id }, { onSuccess: () => setNotice('Career story deleted.') });
  }

  function savePrep(event) {
    event.preventDefault();
    setNotice('');
    updatePrep.mutate(
      { profileId, prepPlan: prepDraft },
      { onSuccess: () => setNotice('Interview preparation plan saved.') },
    );
  }

  if (isLoading) return <ProfileHubLoading />;
  if (error || !hub) {
    return (
      <Alert severity="error" action={<Button onClick={() => refetch()}>Retry</Button>}>
        {error?.message || 'Profile could not be loaded.'}
      </Alert>
    );
  }

  const profile = hub.profile;
  const locationLabel = [hub.intelligence.city, hub.intelligence.region, hub.intelligence.countryCode].filter(Boolean).join(', ') || profile.location;

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Paper variant="outlined" sx={{ overflow: 'hidden', boxShadow: 1 }}>
        <Box sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(currentUser?.role === 'caller' ? '/interviews' : '/profiles')}>
            Back
          </Button>
          <Divider flexItem orientation="vertical" />
          <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
            <Typography variant="h5" fontWeight={600} noWrap>{profile.name}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {[levelLabel(hub.intelligence.targetLevel), profile.profileBadge, locationLabel].filter(Boolean).join(' · ') || 'Profile intelligence'}
            </Typography>
          </Box>
          <Chip label={profile.profileStatus || 'active'} color={profile.profileStatus === 'active' ? 'success' : 'default'} />
          <Chip label={`${hub.readiness.percent}% ready`} color={hub.readiness.percent >= 70 ? 'success' : 'primary'} variant="outlined" />
          <Button component={RouterLink} to={`/interviews?profileId=${encodeURIComponent(profile.id)}`} startIcon={<OpenInNewIcon />} variant="outlined">
            Interviews
          </Button>
        </Box>
        <Tabs value={activeTab} onChange={changeTab} variant="scrollable" scrollButtons="auto" sx={{ borderTop: 1, borderColor: 'divider' }}>
          {HUB_TABS.map((tab) => <Tab key={tab} value={tab} label={HUB_TAB_LABELS[tab]} />)}
        </Tabs>
      </Paper>

      {notice ? <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert> : null}
      {mutationError ? <Alert severity="error">{mutationError}</Alert> : null}

      {activeTab === 'overview' ? (
        <OverviewSection
          canEdit={hub.canEdit}
          draft={detailsDraft}
          isSaving={updateIntelligence.isPending}
          profile={profile}
          readiness={hub.readiness}
          onChange={setDetailsDraft}
          onSubmit={saveDetails}
        />
      ) : null}
      {activeTab === 'career-story' ? (
        <CareerStorySection
          canEdit={hub.canEdit}
          isDeleting={deleteStory.isPending}
          profile={profile}
          stories={hub.stories}
          onAdd={() => setStoryDraft({ ...EMPTY_STORY })}
          onDelete={removeStory}
          onEdit={(story) => setStoryDraft({ ...story })}
        />
      ) : null}
      {activeTab === 'interview-prep' ? (
        <InterviewPrepSection
          canEdit={hub.canEdit}
          draft={prepDraft}
          interviews={hub.interviews}
          isSaving={updatePrep.isPending}
          playbook={hub.playbook}
          stories={hub.stories}
          onChange={setPrepDraft}
          onSubmit={savePrep}
        />
      ) : null}
      {activeTab === 'location-context' ? (
        <LocationContextSection
          canEdit={hub.canEdit}
          draft={detailsDraft}
          geocodeResult={geocodeLocation.data}
          isGeocoding={geocodeLocation.isPending}
          isSaving={updateIntelligence.isPending}
          privacy={hub.privacy}
          residentAddress={residentAddress}
          onAddressChange={setResidentAddress}
          onChange={setDetailsDraft}
          onSave={saveDetails}
          onVerify={verifyAddress}
        />
      ) : null}
      {activeTab === 'activity' ? (
        <ActivitySection currentUser={currentUser} interviews={hub.interviews} profile={profile} />
      ) : null}

      <StoryDialog
        draft={storyDraft}
        isSaving={createStory.isPending || updateStory.isPending}
        playbook={hub.playbook}
        onChange={setStoryDraft}
        onClose={() => setStoryDraft(null)}
        onSubmit={submitStory}
      />
    </Box>
  );
}

function OverviewSection({ canEdit, draft, isSaving, profile, readiness, onChange, onSubmit }) {
  if (!draft) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' }, gap: 1.5, alignItems: 'start' }}>
      <Paper component="form" onSubmit={onSubmit} variant="outlined" sx={{ p: 2, display: 'grid', gap: 2, boxShadow: 1 }}>
        <SectionHeading title="Candidate narrative" detail="The reusable facts and positioning that should guide applications and interviews." />
        <Box sx={twoColumnGridSx}>
          <FormControl disabled={!canEdit}>
            <InputLabel>Target level</InputLabel>
            <Select label="Target level" value={draft.targetLevel || ''} onChange={(event) => onChange({ ...draft, targetLevel: event.target.value })}>
              {TARGET_LEVELS.map((level) => <MenuItem key={level.value || 'none'} value={level.value}>{level.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField disabled={!canEdit} label="Target titles" helperText="Comma-separated" value={(draft.targetTitles || []).join(', ')} onChange={(event) => onChange({ ...draft, targetTitles: splitList(event.target.value) })} />
          <TextField disabled={!canEdit} label="ML specializations" helperText="For example: ranking, NLP, forecasting" value={(draft.specializations || []).join(', ')} onChange={(event) => onChange({ ...draft, specializations: splitList(event.target.value) })} />
          <TextField disabled={!canEdit} label="Work authorization" value={draft.workAuthorization || ''} onChange={(event) => onChange({ ...draft, workAuthorization: event.target.value })} />
          <FormControl disabled={!canEdit}>
            <InputLabel>Work location</InputLabel>
            <Select label="Work location" value={draft.remotePreference || ''} onChange={(event) => onChange({ ...draft, remotePreference: event.target.value })}>
              <MenuItem value="">Not set</MenuItem><MenuItem value="remote">Remote</MenuItem><MenuItem value="hybrid">Hybrid</MenuItem><MenuItem value="onsite">Onsite</MenuItem><MenuItem value="flexible">Flexible</MenuItem>
            </Select>
          </FormControl>
          <FormControl disabled={!canEdit}>
            <InputLabel>Relocation</InputLabel>
            <Select label="Relocation" value={draft.relocationPreference || ''} onChange={(event) => onChange({ ...draft, relocationPreference: event.target.value })}>
              <MenuItem value="">Not set</MenuItem><MenuItem value="not_open">Not open</MenuItem><MenuItem value="open">Open</MenuItem><MenuItem value="case_by_case">Case by case</MenuItem><MenuItem value="already_relocating">Already relocating</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <TextField disabled={!canEdit} label="Professional summary" multiline minRows={5} value={draft.professionalSummary || ''} onChange={(event) => onChange({ ...draft, professionalSummary: event.target.value })} helperText="Keep this factual: scope, specialties, leadership leverage, and measurable outcomes." />
        {canEdit ? <Box><Button type="submit" variant="contained" disabled={isSaving}>Save overview</Button></Box> : null}
        <Divider />
        <SectionHeading title="Source profile" detail="Existing profile details used for applications and resume tailoring." />
        <Box sx={twoColumnGridSx}>
          <ReadOnlyField label="Email" value={profile.email} />
          <ReadOnlyField label="Phone" value={profile.phone} />
          <ReadOnlyField label="LinkedIn" value={profile.linkedin} />
          <ReadOnlyField label="Experience" value={profile.yearsOfExperience ? `${profile.yearsOfExperience} years` : ''} />
        </Box>
        {profile.resumeText ? <ReadOnlyText label="Resume text" value={profile.resumeText} /> : null}
      </Paper>
      <ReadinessCard readiness={readiness} />
    </Box>
  );
}

function ReadinessCard({ readiness }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5, boxShadow: 1 }}>
      <SectionHeading title="Interview readiness" detail="Completion is a preparation signal, not an employment evaluation." />
      <Box>
        <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
          <Typography fontWeight={600}>{readiness.percent}%</Typography>
          <Typography variant="body2" color="text.secondary">Profile coverage</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={readiness.percent} sx={{ height: 8, borderRadius: 999 }} />
      </Box>
      <Stack spacing={1}>
        {readiness.sections.map((section) => (
          <Box key={section.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutlineIcon color={section.complete >= section.total ? 'success' : 'disabled'} fontSize="small" />
            <Typography variant="body2" sx={{ flex: 1 }}>{section.label}</Typography>
            <Chip label={`${section.complete}/${section.total}`} variant="outlined" />
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function CareerStorySection({ canEdit, isDeleting, stories, onAdd, onDelete, onEdit }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1, boxShadow: 1 }}>
        <SectionHeading title="Career story bank" detail="Verified examples supply evidence for Staff+ behavioral and technical interviews." />
        {canEdit ? <Button startIcon={<AddIcon />} variant="contained" onClick={onAdd}>Add story</Button> : null}
      </Paper>
      {!stories.length ? <EmptyState title="No career stories yet" detail="Add four to six stories covering strategy, systems, influence, execution, and learning." /> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {stories.map((story) => (
            <Card key={story.id} variant="outlined" sx={{ boxShadow: 1 }}>
              <CardContent sx={{ display: 'grid', gap: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Box minWidth={0}>
                    <Typography fontWeight={600}>{story.title}</Typography>
                    <Typography variant="caption" color="text.secondary">Updated {formatShortDate(story.updatedAt)}</Typography>
                  </Box>
                  <Chip label={story.verificationStatus} color={story.verificationStatus === 'verified' ? 'success' : 'default'} variant="outlined" />
                </Box>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  {(story.competencies || []).map((item) => <Chip key={item} label={humanize(item)} />)}
                </Stack>
                <StoryExcerpt label="Situation" value={story.situation} />
                <StoryExcerpt label="Action" value={story.actions} />
                <StoryExcerpt label="Result" value={[story.result, story.metrics].filter(Boolean).join(' · ')} />
                {canEdit ? (
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Button startIcon={<EditOutlinedIcon />} onClick={() => onEdit(story)}>Edit</Button>
                    <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={isDeleting} onClick={() => onDelete(story)}>Delete</Button>
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

function InterviewPrepSection({ canEdit, draft, interviews, isSaving, playbook, stories, onChange, onSubmit }) {
  const competencyOptions = useMemo(() => [...new Set(playbook.modules.map((module) => module.competency))], [playbook.modules]);
  if (!draft) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' }, gap: 1.5, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Paper component="form" onSubmit={onSubmit} variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5, boxShadow: 1 }}>
          <SectionHeading title="Preparation plan" detail="Score evidence readiness from 0–3, then focus practice on the weakest areas." />
          <FormControl disabled={!canEdit}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={draft.status || 'draft'} onChange={(event) => onChange({ ...draft, status: event.target.value })}>
              <MenuItem value="draft">Draft</MenuItem><MenuItem value="in_progress">In progress</MenuItem><MenuItem value="ready">Ready</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {competencyOptions.map((competency) => (
              <Box key={competency} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 190px' }, gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={600}>{humanize(competency)}</Typography>
                <FormControl disabled={!canEdit}>
                  <Select value={Number(draft.competencyScores?.[competency] || 0)} onChange={(event) => onChange({ ...draft, competencyScores: { ...(draft.competencyScores || {}), [competency]: Number(event.target.value) } })}>
                    {SCORE_OPTIONS.map((score) => <MenuItem key={score.value} value={score.value}>{score.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            ))}
          </Box>
          <TextField disabled={!canEdit} label="Focus areas" helperText="Comma-separated" value={(draft.focusAreas || []).join(', ')} onChange={(event) => onChange({ ...draft, focusAreas: splitList(event.target.value) })} />
          <TextField disabled={!canEdit} label="Next mock interview" type="datetime-local" value={toDateTimeLocal(draft.nextMockAt)} onChange={(event) => onChange({ ...draft, nextMockAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField disabled={!canEdit} label="Preparation notes" multiline minRows={5} value={draft.notes || ''} onChange={(event) => onChange({ ...draft, notes: event.target.value })} />
          {canEdit ? <Box><Button type="submit" variant="contained" disabled={isSaving}>Save preparation plan</Button></Box> : null}
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.25, boxShadow: 1 }}>
          <SectionHeading title="Candidate evidence" detail={`${stories.filter((story) => story.verificationStatus === 'verified').length} verified stories available for interview answers.`} />
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {stories.filter((story) => story.verificationStatus === 'verified').map((story) => <Chip key={story.id} label={story.title} color="success" variant="outlined" />)}
          </Stack>
        </Paper>
      </Box>
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Paper variant="outlined" sx={{ overflow: 'hidden', boxShadow: 1 }}>
          <Box sx={{ p: 2 }}><SectionHeading title={playbook.title} detail={playbook.description} /></Box>
          <Divider />
          {playbook.modules.map((module) => (
            <Accordion key={module.id} disableGutters elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', borderRadius: '0 !important' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box><Typography fontWeight={600}>{module.title}</Typography><Typography variant="body2" color="text.secondary">{module.summary}</Typography></Box>
              </AccordionSummary>
              <AccordionDetails sx={{ display: 'grid', gap: 1.25 }}>
                <PlaybookList title="Practice questions" items={module.questions} />
                <PlaybookList title="Strong signals" items={module.strongSignals} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, boxShadow: 1 }}>
          <PlaybookList title="Day-of checklist" items={playbook.dayOfChecklist} />
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1, boxShadow: 1 }}>
          <SectionHeading title="Interview schedule" detail="Open the interview board for stage notes, calls, and meeting links." />
          {!interviews.length ? <Typography variant="body2" color="text.secondary">No interviews are registered for this profile.</Typography> : interviews.map((interview) => (
            <Box key={interview.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <Typography variant="body2" fontWeight={600}>{interview.title || 'Untitled role'} · {interview.company || 'Unknown company'}</Typography>
              <Typography variant="caption" color="text.secondary">{humanize(interview.interviewStage)}{interview.interviewNextAt ? ` · ${formatDateTimeInDefaultTimezone(interview.interviewNextAt)}` : ''}</Typography>
            </Box>
          ))}
        </Paper>
      </Box>
    </Box>
  );
}

function LocationContextSection({ canEdit, draft, isGeocoding, isSaving, privacy, residentAddress, onAddressChange, onChange, onSave, onVerify }) {
  if (!draft) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, gap: 1.5, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Paper component="form" onSubmit={onSave} variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5, boxShadow: 1 }}>
          <SectionHeading title="Location context" detail="Use community-level facts for logistics and conversation—not to infer a candidate’s behavior or identity." />
          <Box sx={twoColumnGridSx}>
            <TextField disabled={!canEdit} label="City" value={draft.city || ''} onChange={(event) => onChange({ ...draft, city: event.target.value })} />
            <TextField disabled={!canEdit} label="State or region" value={draft.region || ''} onChange={(event) => onChange({ ...draft, region: event.target.value })} />
            <TextField disabled={!canEdit} label="Country code" value={draft.countryCode || ''} onChange={(event) => onChange({ ...draft, countryCode: event.target.value.toUpperCase() })} inputProps={{ maxLength: 2 }} />
            <TextField disabled={!canEdit} label="Postal code" value={draft.postalCode || ''} onChange={(event) => onChange({ ...draft, postalCode: event.target.value })} />
            <TextField disabled={!canEdit} label="Timezone" placeholder="America/Los_Angeles" value={draft.timezone || ''} onChange={(event) => onChange({ ...draft, timezone: event.target.value })} />
            <ReadOnlyField label="Approximate coordinates" value={draft.coarseLatitude != null && draft.coarseLongitude != null ? `${draft.coarseLatitude}, ${draft.coarseLongitude}` : ''} />
          </Box>
          <TextField disabled={!canEdit} label="Regional context notes" multiline minRows={6} value={draft.regionalContextNotes || ''} onChange={(event) => onChange({ ...draft, regionalContextNotes: event.target.value })} helperText="Record sourced facts: local industries, tech ecosystem, travel considerations, work-hour overlap, and relocation context." />
          <TextField disabled={!canEdit} label="Source URLs" multiline minRows={3} value={(draft.regionalContextSources || []).map((source) => source.url || source).join('\n')} onChange={(event) => onChange({ ...draft, regionalContextSources: event.target.value.split(/\r?\n/).filter(Boolean).map((url) => ({ label: url, url })) })} helperText="One public source URL per line." />
          {canEdit ? <Box><Button type="submit" variant="contained" disabled={isSaving}>Save location context</Button></Box> : null}
        </Paper>
        {canEdit ? (
          <Paper component="form" onSubmit={onVerify} variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.25, boxShadow: 1 }}>
            <SectionHeading title="Verify a U.S. resident address" detail="The address is sent server-side to the U.S. Census Geocoder, then discarded. Only rounded coordinates and locality metadata are saved." />
            <TextField label="Resident street address" autoComplete="off" value={residentAddress} onChange={(event) => onAddressChange(event.target.value)} placeholder="Street, city, state, ZIP" required />
            <Box><Button type="submit" startIcon={<LocationOnOutlinedIcon />} variant="outlined" disabled={isGeocoding || !residentAddress.trim()}>{isGeocoding ? 'Verifying…' : 'Verify and discard address'}</Button></Box>
          </Paper>
        ) : null}
      </Box>
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.25, boxShadow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}><ShieldOutlinedIcon color="primary" /><Typography fontWeight={600}>Privacy boundary</Typography></Stack>
          <Typography variant="body2" color="text.secondary">{privacy.statement}</Typography>
          <ReadOnlyField label="Street address retained" value={privacy.addressStored ? 'Yes' : 'No'} />
          <ReadOnlyField label="Exact coordinates retained" value={privacy.exactCoordinatesStored ? 'Yes' : 'No'} />
          <ReadOnlyField label="Lookup provider" value={draft.locationProvider} />
          <ReadOnlyField label="Verified" value={draft.locationVerifiedAt ? formatDateTimeInDefaultTimezone(draft.locationVerifiedAt) : ''} />
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1, boxShadow: 1 }}>
          <SectionHeading title="Regional sources" detail="Keep facts reviewable and time-bound." />
          {(draft.regionalContextSources || []).length ? draft.regionalContextSources.map((source, index) => (
            <Button key={`${source.url || source}-${index}`} component="a" href={source.url || source} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon />} sx={{ justifyContent: 'space-between' }}>{source.label || source.url || source}</Button>
          )) : <Typography variant="body2" color="text.secondary">No regional sources recorded.</Typography>}
        </Paper>
      </Box>
    </Box>
  );
}

function ActivitySection({ currentUser, interviews, profile }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' }, gap: 1.5, alignItems: 'start' }}>
      <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1, boxShadow: 1 }}>
        <SectionHeading title="Interview activity" detail={`${interviews.length} recent interview records`} />
        {interviews.length ? interviews.map((interview) => (
          <Box key={interview.id} sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}>
            <Typography variant="body2" fontWeight={600}>{interview.title || 'Untitled role'}</Typography>
            <Typography variant="caption" color="text.secondary">{[interview.company, humanize(interview.interviewStage), interview.interviewNextAt ? formatDateTimeInDefaultTimezone(interview.interviewNextAt) : 'Unscheduled'].filter(Boolean).join(' · ')}</Typography>
          </Box>
        )) : <Typography variant="body2" color="text.secondary">No interview activity yet.</Typography>}
      </Paper>
      {currentUser?.role === 'caller' ? (
        <Alert severity="info">Callers receive a preparation-safe profile view. Internal collaboration history remains limited to profile workspace members.</Alert>
      ) : (
        <CollaborationPanel entityType="profile" entityId={profile.id} profileId={profile.id} assignableUsers={[]} />
      )}
    </Box>
  );
}

function StoryDialog({ draft, isSaving, playbook, onChange, onClose, onSubmit }) {
  if (!draft) return null;
  const competencies = [...new Set(playbook.modules.map((module) => module.competency))];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={onSubmit}>
        <DialogTitle>{draft.id ? 'Edit career story' : 'Add career story'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
          <TextField autoFocus required label="Story title" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
          <Box sx={twoColumnGridSx}>
            <FormControl>
              <InputLabel>Competencies</InputLabel>
              <Select multiple label="Competencies" value={draft.competencies || []} onChange={(event) => onChange({ ...draft, competencies: event.target.value })} renderValue={(selected) => selected.map(humanize).join(', ')}>
                {competencies.map((competency) => <MenuItem key={competency} value={competency}><Checkbox checked={(draft.competencies || []).includes(competency)} />{humanize(competency)}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>Verification</InputLabel>
              <Select label="Verification" value={draft.verificationStatus || 'draft'} onChange={(event) => onChange({ ...draft, verificationStatus: event.target.value })}>
                <MenuItem value="draft">Draft</MenuItem><MenuItem value="verified">Verified facts</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField label="Situation and constraints" multiline minRows={3} value={draft.situation || ''} onChange={(event) => onChange({ ...draft, situation: event.target.value })} />
          <TextField label="Candidate responsibility and scope" multiline minRows={3} value={draft.responsibility || ''} onChange={(event) => onChange({ ...draft, responsibility: event.target.value })} />
          <TextField label="Actions, decisions, and trade-offs" multiline minRows={4} value={draft.actions || ''} onChange={(event) => onChange({ ...draft, actions: event.target.value })} />
          <TextField label="Result" multiline minRows={3} value={draft.result || ''} onChange={(event) => onChange({ ...draft, result: event.target.value })} />
          <TextField label="Verified metrics" multiline minRows={2} value={draft.metrics || ''} onChange={(event) => onChange({ ...draft, metrics: event.target.value })} helperText="Do not record a metric unless the candidate can defend it." />
          <TextField label="Lessons and what changed next" multiline minRows={3} value={draft.lessons || ''} onChange={(event) => onChange({ ...draft, lessons: event.target.value })} />
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={isSaving}>Save story</Button></DialogActions>
      </form>
    </Dialog>
  );
}

function SectionHeading({ title, detail }) {
  return <Box minWidth={0}><Typography fontWeight={600}>{title}</Typography>{detail ? <Typography variant="body2" color="text.secondary">{detail}</Typography> : null}</Box>;
}

function ReadOnlyField({ label, value }) {
  return <Box sx={{ display: 'grid', gap: 0.25 }}><Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography><Typography variant="body2">{value || 'Not set'}</Typography></Box>;
}

function ReadOnlyText({ label, value }) {
  return <Box sx={{ display: 'grid', gap: 0.75 }}><Typography variant="subtitle2">{label}</Typography><Box sx={{ maxHeight: 260, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25, bgcolor: 'rgba(247,249,251,0.72)' }}><Typography component="pre" variant="body2" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{value}</Typography></Box></Box>;
}

function StoryExcerpt({ label, value }) {
  if (!value) return null;
  return <Box><Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography><Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{value}</Typography></Box>;
}

function PlaybookList({ title, items }) {
  return <Box sx={{ display: 'grid', gap: 0.5 }}><Typography variant="subtitle2">{title}</Typography><Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.5 }}>{items.map((item) => <Typography component="li" variant="body2" key={item}>{item}</Typography>)}</Box></Box>;
}

function ProfileHubLoading() {
  return <Paper variant="outlined" sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><Stack alignItems="center" spacing={1}><CircularProgress /><Typography color="text.secondary">Loading profile intelligence…</Typography></Stack></Paper>;
}

function splitList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function humanize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function levelLabel(value) {
  return TARGET_LEVELS.find((level) => level.value === value)?.label || '';
}

function formatShortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString();
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const twoColumnGridSx = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 };

import { useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
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
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ProfileCard from '../components/profiles/ProfileCard.jsx';
import CollaborationPanel from '../components/collaboration/CollaborationPanel.jsx';
import ProfileDialog from '../components/profiles/ProfileDialog.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_PROFILE } from '../components/profiles/profileConstants.js';
import {
  useBidProfiles,
  useCreateBidProfile,
  useDeleteBidProfile,
  useProfileShareRecipients,
  useProfileShareRequests,
  useRespondToProfileShare,
  useShareBidProfile,
  useUpdateBidProfile,
  useUpdateBidProfileStatus,
} from '../lib/api.js';
import { BIDDER_ROLES, PRIVILEGED_USER_ROLES, isAdminRole, isSuperadmin } from '../lib/roles.js';

const PROFILE_STATUS_ORDER = ['active', 'draft', 'legacy'];
const PROFILE_STATUS_META = {
  active: {
    label: 'Active',
    emptyTitle: 'No active profiles',
    emptyDetail: 'Profiles ready for bidding and tailoring will appear here.',
    color: { main: '#16a34a', dark: '#166534', soft: '#dcfce7' },
  },
  draft: {
    label: 'Draft',
    emptyTitle: 'No draft profiles',
    emptyDetail: 'Profiles that are not ready for bidding yet will appear here.',
    color: { main: '#d97706', dark: '#92400e', soft: '#fef3c7' },
  },
  legacy: {
    label: 'Legacy',
    emptyTitle: 'No legacy profiles',
    emptyDetail: 'Archived profiles that should stay available for history will appear here.',
    color: { main: '#64748b', dark: '#334155', soft: '#e2e8f0' },
  },
  closed: {
    label: 'Closed',
    emptyTitle: 'No closed profiles',
    emptyDetail: 'Closed profiles with retained history will appear here.',
    color: { main: '#475569', dark: '#334155', soft: '#e2e8f0' },
  },
};

export default function ProfilesPage({ currentUser }) {
  const [searchParams] = useSearchParams();
  const [dialogMode, setDialogMode] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [sharingProfile, setSharingProfile] = useState(null);
  const [closingProfile, setClosingProfile] = useState(null);
  const [legacyProfile, setLegacyProfile] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [shareUsernames, setShareUsernames] = useState([]);
  const [closeReason, setCloseReason] = useState('');
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [error, setError] = useState('');
  const [activeStatus, setActiveStatus] = useState('active');

  const { data: profiles = [], isLoading, error: loadError, refetch } = useBidProfiles(
    isAdminRole(currentUser) ? { scope: 'manage' } : {},
  );
  const { data: shareRequests = {}, error: sharesError } = useProfileShareRequests();
  const { data: shareRecipients = [], isLoading: recipientsLoading, error: recipientsError } = useProfileShareRecipients();
  const { mutate: createProfile, isPending: creating } = useCreateBidProfile();
  const { mutate: updateProfile, isPending: updating } = useUpdateBidProfile();
  const { mutate: deleteProfile, isPending: deleting } = useDeleteBidProfile();
  const { mutate: shareProfile, isPending: sharing } = useShareBidProfile();
  const { mutate: updateProfileStatus, isPending: updatingStatus } = useUpdateBidProfileStatus();
  const { mutate: respondToShare, isPending: respondingToShare } = useRespondToProfileShare();

  function openCreateDialog() {
    setError('');
    setForm(EMPTY_PROFILE);
    setEditingProfileId(null);
    setDialogMode('create');
  }

  function openEditDialog(profile) {
    setError('');
    setForm({
      name: profile.name || '',
      location: profile.location || '',
      phone: profile.phone || '',
      email: profile.email || '',
      forwardingEmail: profile.forwardingEmail || '',
      linkedin: profile.linkedin || '',
      yearsOfExperience: profile.yearsOfExperience || '',
      resumeText: profile.resumeText || '',
      resumeTemplate: profile.resumeTemplate || 'classic',
      colorScheme: profile.colorScheme || 'green',
      profileBadge: profile.profileBadge || 'SWE',
      dailyBidGoal: profile.dailyBidGoal ?? '',
    });
    setEditingProfileId(profile.id);
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingProfileId(null);
    setForm(EMPTY_PROFILE);
  }

  function openShareDialog(profile) {
    setError('');
    setSharingProfile(profile);
    setShareUsernames(
      (profile.sharedWith || [])
        .filter((share) => ['accepted', 'pending'].includes(share.status))
        .map((share) => share.username)
        .filter(Boolean),
    );
  }

  function closeShareDialog() {
    setSharingProfile(null);
    setShareUsernames([]);
  }

  function openCloseDialog(profile) {
    setError('');
    setClosingProfile(profile);
    setCloseReason('');
  }

  function closeCloseDialog() {
    setClosingProfile(null);
    setCloseReason('');
  }

  function openLegacyDialog(profile) {
    setError('');
    setLegacyProfile(profile);
  }

  function closeLegacyDialog() {
    setLegacyProfile(null);
  }

  function submitProfile(event) {
    event.preventDefault();
    setError('');
    const mutation = dialogMode === 'edit' ? updateProfile : createProfile;
    const payload = dialogMode === 'edit' ? { profileId: editingProfileId, profileData: form } : form;
    mutation(payload, {
      onSuccess: closeDialog,
      onError: (profileError) => setError(profileError.message),
    });
  }

  function removeProfile(profileId) {
    setError('');
    deleteProfile(profileId, {
      onError: (deleteError) => setError(deleteError.message),
    });
  }

  function submitProfileStatus(event) {
    event.preventDefault();
    if (!closingProfile) return;
    setError('');
    updateProfileStatus(
      { profileId: closingProfile.id, status: 'closed', reason: closeReason },
      {
        onSuccess: closeCloseDialog,
        onError: (statusError) => setError(statusError.message),
      },
    );
  }

  function reopenProfile(profile) {
    setError('');
    updateProfileStatus(
      { profileId: profile.id, status: 'active' },
      {
        onError: (statusError) => setError(statusError.message),
      },
    );
  }

  function markProfileDraft(profile) {
    setError('');
    updateProfileStatus(
      { profileId: profile.id, status: 'draft' },
      {
        onError: (statusError) => setError(statusError.message),
      },
    );
  }

  function submitLegacyStatus(event) {
    event.preventDefault();
    if (!legacyProfile) return;
    setError('');
    updateProfileStatus(
      { profileId: legacyProfile.id, status: 'legacy' },
      {
        onSuccess: closeLegacyDialog,
        onError: (statusError) => setError(statusError.message),
      },
    );
  }

  function submitShare(event) {
    event.preventDefault();
    if (!sharingProfile) return;
    setError('');
    shareProfile(
      { profileId: sharingProfile.id, usernames: shareUsernames },
      {
        onSuccess: closeShareDialog,
        onError: (shareError) => setError(shareError.message),
      },
    );
  }

  function respondToRequest(shareId, status) {
    setError('');
    respondToShare(
      { shareId, status },
      {
        onError: (shareError) => setError(shareError.message),
      },
    );
  }

  const incomingShares = shareRequests.incoming || [];
  const shareRecipientOptions = shareRecipients.filter(
    (user) => String(user.id) !== String(currentUser?.id) && String(user.id) !== String(sharingProfile?.userId),
  );
  const pageError = error || loadError?.message || sharesError?.message || recipientsError?.message || '';
  const canManageProfiles = !BIDDER_ROLES.includes(currentUser?.role);
  const canUpdateProfileStatus = PRIVILEGED_USER_ROLES.includes(currentUser?.role);
  const canRestoreProfiles = isAdminRole(currentUser);
  const canManageLegacyProfiles = isSuperadmin(currentUser);
  const highlightedProfileId = searchParams.get('profileId') || '';
  const profileStatusSections = useMemo(() => profileStatusSectionsForProfiles(profiles), [profiles]);
  const activeStatusSection = profileStatusSections.find((section) => section.status === activeStatus) || profileStatusSections[0];
  const visibleProfiles = useMemo(
    () => profiles.filter((profile) => normalizedProfileStatus(profile.profileStatus) === activeStatusSection.status),
    [activeStatusSection.status, profiles],
  );

  useEffect(() => {
    if (!highlightedProfileId || isLoading) return;
    const element = document.getElementById(`profile-card-${highlightedProfileId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeStatusSection.status, highlightedProfileId, isLoading]);

  useEffect(() => {
    if (!highlightedProfileId || !profiles.length) return;
    const highlightedProfile = profiles.find((profile) => String(profile.id) === String(highlightedProfileId));
    if (!highlightedProfile) return;
    setActiveStatus(normalizedProfileStatus(highlightedProfile.profileStatus));
  }, [highlightedProfileId, profiles]);

  function handleStatusChange(status) {
    setActiveStatus(status);
    setError('');
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start', '& .MuiChip-root': { fontWeight: 400 } }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

      {incomingShares.length ? (
        <Card variant="outlined" sx={{ boxShadow: 1 }}>
          <CardContent sx={{ display: 'grid', gap: 1 }}>
            <Typography fontWeight={900}>Profile sharing requests</Typography>
            {incomingShares.map((share) => (
              <Box
                key={share.id}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography color="text.secondary">
                  {share.owner?.username} shared {share.profile?.name}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={respondingToShare}
                    onClick={() => respondToRequest(share.id, 'accepted')}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    disabled={respondingToShare}
                    onClick={() => respondToRequest(share.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </Stack>
              </Box>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)', xl: '240px minmax(0, 1fr)' },
          gap: 1.5,
          alignItems: 'stretch',
          height: { xs: 'auto', md: incomingShares.length ? 'calc(100vh - 244px)' : 'calc(100vh - 108px)', xl: incomingShares.length ? 'calc(100vh - 260px)' : 'calc(100vh - 124px)' },
          minHeight: { md: 0 },
          minWidth: 0,
        }}
      >
        <ProfileStatusTabs
          activeStatus={activeStatusSection.status}
          isLoading={isLoading}
          statuses={profileStatusSections}
          onStatusChange={handleStatusChange}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, minWidth: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              px: 1.25,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
              boxShadow: 1,
              flexShrink: 0,
            }}
          >
            <Box minWidth={0}>
              <Typography fontWeight={900}>{activeStatusSection.label} profiles</Typography>
              <Typography variant="body2" color="text.secondary">
                {visibleProfiles.length.toLocaleString()} of {profiles.length.toLocaleString()} profiles
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <IconButton type="button" onClick={() => refetch()} title="Refresh profiles" aria-label="Refresh profiles">
                <RefreshIcon />
              </IconButton>
              {canManageProfiles ? (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                  Add profile
                </Button>
              ) : null}
            </Stack>
          </Paper>

          {!isLoading && profiles.length === 0 ? (
            <EmptyState
              title={canManageProfiles ? 'No profiles yet' : 'No profiles available'}
              detail={canManageProfiles ? 'Create your first profile to use it for tailored applications.' : 'Profiles shared with you will appear here.'}
            />
          ) : !isLoading && visibleProfiles.length === 0 ? (
            <EmptyState title={activeStatusSection.emptyTitle} detail={activeStatusSection.emptyDetail} />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 360px))',
                alignContent: 'start',
                justifyContent: 'start',
                gap: 1.5,
                minHeight: 0,
                overflow: { md: 'auto' },
                pb: 0.5,
              }}
            >
              {isLoading && !profiles.length ? <ProfileSkeletonCards /> : null}
              {visibleProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  isDeleting={deleting}
                  isHighlighted={String(profile.id) === String(highlightedProfileId)}
                  isUpdatingStatus={updatingStatus}
                  canManage={canManageProfiles}
                  canManageLegacy={canManageLegacyProfiles}
                  canUpdateStatus={canUpdateProfileStatus}
                  canRestore={canRestoreProfiles}
                  profile={profile}
                  onCloseProfile={openCloseDialog}
                  onDelete={removeProfile}
                  onEdit={openEditDialog}
                  onMarkDraft={markProfileDraft}
                  onMarkLegacy={openLegacyDialog}
                  onReopenProfile={reopenProfile}
                  onShare={openShareDialog}
                  onView={setViewingProfile}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <ProfileDialog
        canEditDailyBidGoal={isAdminRole(currentUser)}
        form={form}
        isOpen={Boolean(dialogMode)}
        isSaving={creating || updating}
        mode={dialogMode}
        onChange={setForm}
        onClose={closeDialog}
        onSubmit={submitProfile}
      />

      <Dialog open={Boolean(sharingProfile)} onClose={closeShareDialog} fullWidth maxWidth="xs">
        <form onSubmit={submitShare}>
          <DialogTitle>Share profile</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Users</InputLabel>
              <Select
                autoFocus
                label="Users"
                multiple
                value={shareUsernames}
                onChange={(event) => {
                  const value = event.target.value;
                  setShareUsernames(typeof value === 'string' ? value.split(',') : value);
                }}
                disabled={recipientsLoading || !shareRecipientOptions.length}
                renderValue={(selected) => selected.join(', ')}
              >
                {shareRecipientOptions.map((user) => (
                  <MenuItem key={user.id} value={user.username}>
                    <Checkbox checked={shareUsernames.includes(user.username)} />
                    <ListItemText primary={user.username} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {shareRecipientOptions.length
                ? sharingProfile
                  ? `Sharing ${sharingProfile.name}`
                  : ''
                : recipientsLoading
                  ? 'Loading users...'
                  : 'No other users are available to share with.'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeShareDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={sharing || recipientsLoading || !sharingProfile}>
              Save sharing
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(legacyProfile)} onClose={closeLegacyDialog} fullWidth maxWidth="xs">
        <form onSubmit={submitLegacyStatus}>
          <DialogTitle>Mark profile as legacy</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Users will not be able to bid or tailor with this profile, but interviews and calendar entries will remain available.
            </Typography>
            <Typography variant="body2" fontWeight={900} sx={{ mt: 1 }}>
              {legacyProfile ? legacyProfile.name : ''}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeLegacyDialog}>Cancel</Button>
            <Button type="submit" variant="contained" color="warning" disabled={updatingStatus}>
              Mark legacy
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(closingProfile)} onClose={closeCloseDialog} fullWidth maxWidth="xs">
        <form onSubmit={submitProfileStatus}>
          <DialogTitle>Close profile</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField
              autoFocus
              fullWidth
              label="Reason"
              value={closeReason}
              onChange={(event) => setCloseReason(event.target.value)}
              required
              multiline
              minRows={3}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {closingProfile ? `Closing ${closingProfile.name}` : ''}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" color="warning" disabled={updatingStatus}>
              Close profile
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ProfileReadOnlyDialog
        assignableUsers={shareRecipientOptions}
        profile={viewingProfile}
        onClose={() => setViewingProfile(null)}
      />
    </Box>
  );
}

function ProfileSkeletonCards() {
  return Array.from({ length: 6 }).map((_, index) => (
    <Card key={`profile-loading-${index}`} variant="outlined" sx={{ boxShadow: 1 }}>
      <CardContent sx={{ display: 'grid', gap: 1.25 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton width="58%" />
            <Skeleton width="38%" />
          </Box>
          <Skeleton variant="rounded" width={72} height={24} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
          <Skeleton variant="rounded" height={54} />
          <Skeleton variant="rounded" height={54} />
        </Box>
        <Skeleton variant="rounded" height={96} />
        <Stack direction="row" spacing={0.75} justifyContent="flex-end">
          <Skeleton variant="rounded" width={74} height={30} />
          <Skeleton variant="rounded" width={74} height={30} />
        </Stack>
      </CardContent>
    </Card>
  ));
}

function ProfileStatusTabs({ activeStatus, isLoading, statuses, onStatusChange }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const activeColor = profileStatusColor(activeStatus);

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        overflow: 'hidden',
        boxShadow: 1,
        alignSelf: 'stretch',
        height: { xs: 'auto', md: '100%' },
        minHeight: 0,
      }}
    >
      <Box sx={{ px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
          Status
        </Typography>
      </Box>
      {isLoading && !statuses.some((status) => status.count) ? (
        <ProfileStatusSkeletons />
      ) : (
        <Tabs
          orientation={isDesktop ? 'vertical' : 'horizontal'}
          value={activeStatus}
          onChange={(_event, value) => onStatusChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            bgcolor: 'rgba(255, 255, 255, 0.72)',
            '& .MuiTabs-indicator': { backgroundColor: activeColor.main },
            '& .MuiTabs-scroller': {
              overflowY: { md: 'auto !important' },
            },
            '& .MuiTabs-flexContainer': {
              alignItems: 'stretch',
            },
            '& .MuiTab-root': {
              minHeight: 64,
              alignItems: isDesktop ? 'stretch' : 'center',
              borderRadius: 0,
              borderBottom: isDesktop ? 1 : 0,
              borderRight: isDesktop ? 0 : 1,
              borderColor: 'divider',
              px: 1.25,
              py: 1,
            },
          }}
        >
          {statuses.map((status) => {
            const color = profileStatusColor(status.status);
            return (
              <Tab
                key={status.status}
                value={status.status}
                label={<ProfileStatusTabLabel status={status} />}
                sx={{
                  color: color.dark,
                  fontWeight: 800,
                  textAlign: 'left',
                  '&.Mui-selected': {
                    color: color.dark,
                    backgroundColor: color.soft,
                  },
                }}
              />
            );
          })}
        </Tabs>
      )}
    </Paper>
  );
}

function ProfileStatusTabLabel({ status }) {
  const color = profileStatusColor(status.status);

  return (
    <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'stretch', minWidth: 0, width: '100%' }}>
      <Typography component="span" variant="body2" fontWeight={900} noWrap sx={{ minWidth: 0 }}>
        {status.label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        <Chip
          label={`${status.count.toLocaleString()} total`}
          size="small"
          sx={{ height: 20, fontSize: 11, fontWeight: 900, bgcolor: color.soft, color: color.dark, '& .MuiChip-label': { px: 0.75 } }}
        />
      </Box>
    </Box>
  );
}

function ProfileStatusSkeletons() {
  return (
    <Box sx={{ display: 'grid', alignContent: 'start' }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Box key={`profile-status-loading-${index}`} sx={{ minHeight: 64, px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton width="68%" />
          <Skeleton width="46%" />
        </Box>
      ))}
    </Box>
  );
}

function profileStatusSectionsForProfiles(profiles) {
  const counts = new Map();
  for (const profile of profiles) {
    const status = normalizedProfileStatus(profile.profileStatus);
    counts.set(status, (counts.get(status) || 0) + 1);
  }

  const statuses = [...PROFILE_STATUS_ORDER];
  if (counts.get('closed')) statuses.push('closed');

  return statuses.map((status) => ({
    status,
    count: counts.get(status) || 0,
    ...PROFILE_STATUS_META[status],
  }));
}

function normalizedProfileStatus(status) {
  const value = String(status || 'active').toLowerCase();
  return PROFILE_STATUS_META[value] ? value : 'active';
}

function profileStatusColor(status) {
  return PROFILE_STATUS_META[status]?.color || PROFILE_STATUS_META.active.color;
}

function ProfileReadOnlyDialog({ assignableUsers = [], profile, onClose }) {
  if (!profile) return null;
  return <ProfileReadOnlyDialogContent assignableUsers={assignableUsers} profile={profile} onClose={onClose} />;
}

function ProfileReadOnlyDialogContent({ assignableUsers, profile, onClose }) {
  return (
    <Dialog open={Boolean(profile)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{profile.name || 'Profile'}</DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <ReadOnlyField label="Location" value={profile.location} />
            <ReadOnlyField label="Email" value={profile.email} />
            <ReadOnlyField label="Forwarding alias" value={profile.forwardingEmail} />
            <ReadOnlyField label="Phone" value={profile.phone} />
            <ReadOnlyField label="LinkedIn" value={profile.linkedin} />
            <ReadOnlyField label="Years of experience" value={profile.yearsOfExperience} />
            <ReadOnlyField label="Badge" value={profile.profileBadge || 'SWE'} />
            <ReadOnlyField label="Color" value={profile.colorScheme} />
            <ReadOnlyField label="Status" value={profile.profileStatus || 'active'} />
          </Box>

          <Divider />
          <ReadOnlySection label="Resume text" value={profile.resumeText} preserveText />
          <Divider />
          <CollaborationPanel
            entityType="profile"
            entityId={profile.id}
            profileId={profile.id}
            assignableUsers={assignableUsers}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.25 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        {label}
      </Typography>
      <Typography variant="body2">{formatProfileValue(value)}</Typography>
    </Box>
  );
}

function ReadOnlySection({ label, value, preserveText = false }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <Typography variant="subtitle2" fontWeight={900}>
        {label}
      </Typography>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'rgba(247, 249, 251, 0.72)',
          p: 1.25,
          maxHeight: 260,
          overflow: 'auto',
        }}
      >
        <Typography
          component="pre"
          variant="body2"
          sx={{ m: 0, whiteSpace: preserveText ? 'pre-wrap' : 'pre-wrap', fontFamily: preserveText ? 'inherit' : 'monospace' }}
        >
          {formatProfileValue(value, true)}
        </Typography>
      </Box>
    </Box>
  );
}

function formatProfileValue(value, multiline = false) {
  if (value === undefined || value === null || value === '') return 'Not set';
  if (Array.isArray(value) || typeof value === 'object') {
    return multiline ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  }
  return String(value);
}

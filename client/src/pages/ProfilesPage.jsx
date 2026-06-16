import { useEffect, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import InboxIcon from '@mui/icons-material/Inbox';
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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ProfileCard from '../components/profiles/ProfileCard.jsx';
import ProfileDialog from '../components/profiles/ProfileDialog.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_PROFILE } from '../components/profiles/profileConstants.js';
import {
  useBidProfiles,
  useCreateBidProfile,
  useDeleteBidProfile,
  useForwardedProfileMessages,
  useForwardingMailboxStatus,
  useProfileShareRecipients,
  useProfileShareRequests,
  useRespondToProfileShare,
  useShareBidProfile,
  useUpdateBidProfile,
  useUpdateBidProfileStatus,
} from '../lib/api.js';
import { BIDDER_ROLES, PRIVILEGED_USER_ROLES, isAdminRole, isSuperadmin } from '../lib/roles.js';

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

  const { data: profiles = [], isLoading, error: loadError } = useBidProfiles(
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

  useEffect(() => {
    if (!highlightedProfileId || isLoading) return;
    const element = document.getElementById(`profile-card-${highlightedProfileId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedProfileId, isLoading]);

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start', '& .MuiChip-root': { fontWeight: 400 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
        {canManageProfiles ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            Add profile
          </Button>
        ) : null}
      </Box>

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

      {!isLoading && profiles.length === 0 ? (
        <EmptyState
          title={canManageProfiles ? 'No profiles yet' : 'No profiles available'}
          detail={canManageProfiles ? 'Create your first profile to use it for tailored applications.' : 'Profiles shared with you will appear here.'}
        />
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 360px))',
          justifyContent: 'start',
          gap: 1.5,
        }}
      >
        {isLoading && !profiles.length ? <ProfileSkeletonCards /> : null}
        {profiles.map((profile) => (
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
            onMarkLegacy={openLegacyDialog}
            onReopenProfile={reopenProfile}
            onShare={openShareDialog}
            onView={setViewingProfile}
          />
        ))}
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
          <DialogContent sx={{ pt: 1 }}>
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
          <DialogContent sx={{ pt: 1 }}>
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
          <DialogContent sx={{ pt: 1 }}>
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

      <ProfileReadOnlyDialog profile={viewingProfile} onClose={() => setViewingProfile(null)} />
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

function ProfileReadOnlyDialog({ profile, onClose }) {
  if (!profile) return null;
  return <ProfileReadOnlyDialogContent profile={profile} onClose={onClose} />;
}

function ProfileReadOnlyDialogContent({ profile, onClose }) {
  return (
    <Dialog open={Boolean(profile)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{profile.name || 'Profile'}</DialogTitle>
      <DialogContent dividers>
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
          <ForwardingMailboxPanel profile={profile} />
          <Divider />
          <ReadOnlySection label="Resume text" value={profile.resumeText} preserveText />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function ForwardingMailboxPanel({ profile }) {
  const [showMessages, setShowMessages] = useState(false);
  const {
    data: mailboxStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useForwardingMailboxStatus();
  const configured = mailboxStatus?.configured !== false;
  const mailboxEmail = mailboxStatus?.email || 'service@co-bounce.com';
  const {
    data: inboxData,
    isFetching: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useForwardedProfileMessages(profile.id, {
    enabled: showMessages && configured,
  });

  useEffect(() => {
    setShowMessages(false);
  }, [profile.id]);

  function loadMessages() {
    setShowMessages(true);
    if (showMessages) refetchMessages();
  }

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={900}>
            Forwarding inbox
          </Typography>
          {statusLoading ? <CircularProgress size={16} /> : null}
          {configured ? (
            <Chip label={mailboxEmail} size="small" color="success" variant="outlined" />
          ) : (
            <Chip label="Not configured" size="small" variant="outlined" />
          )}
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            size="small"
            startIcon={messagesLoading ? <CircularProgress size={16} /> : showMessages ? <RefreshIcon /> : <InboxIcon />}
            disabled={statusLoading || !configured}
            onClick={loadMessages}
          >
            {showMessages ? 'Refresh' : 'Inbox'}
          </Button>
        </Stack>
      </Box>

      {!configured ? <Alert severity="warning">Forwarding mailbox is not configured.</Alert> : null}
      {!profile.forwardingEmail && !profile.email ? <Alert severity="warning">Add a profile email or forwarding alias before classifying messages.</Alert> : null}
      {statusError ? <Alert severity="error">{statusError.message}</Alert> : null}
      {messagesError ? <Alert severity="error">{messagesError.message}</Alert> : null}

      {showMessages && configured ? (
        <ForwardingMessageList
          isLoading={messagesLoading && !inboxData}
          messages={inboxData?.messages || []}
        />
      ) : null}
    </Box>
  );
}

function ForwardingMessageList({ isLoading, messages }) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Skeleton height={44} />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </Box>
    );
  }

  if (!messages.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No recent inbox messages.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'grid', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      {messages.map((message) => (
        <Box
          key={message.id}
          sx={{
            display: 'grid',
            gap: 0.35,
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: message.isRead ? 'background.paper' : 'rgba(219, 234, 254, 0.35)',
            '&:last-of-type': { borderBottom: 0 },
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: 'space-between', minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={message.isRead ? 700 : 900} noWrap>
                {message.subject || '(No subject)'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {messageSender(message)} · {formatMessageDate(message.receivedAt)}
              </Typography>
            </Box>
          </Box>
          {message.bodyPreview ? (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {message.bodyPreview}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
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

function messageSender(message) {
  const from = message.from || {};
  return [from.name, from.address].filter(Boolean).join(' <') + (from.name && from.address ? '>' : '') || 'Unknown sender';
}

function formatMessageDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatProfileValue(value, multiline = false) {
  if (value === undefined || value === null || value === '') return 'Not set';
  if (Array.isArray(value) || typeof value === 'object') {
    return multiline ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  }
  return String(value);
}

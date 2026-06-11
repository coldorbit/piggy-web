import { useEffect, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ProfileCard from '../components/profiles/ProfileCard.jsx';
import ProfileDialog from '../components/profiles/ProfileDialog.jsx';
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
import { BIDDER_ROLES, PRIVILEGED_USER_ROLES, isAdminRole } from '../lib/roles.js';

export default function ProfilesPage({ currentUser }) {
  const [searchParams] = useSearchParams();
  const [dialogMode, setDialogMode] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [sharingProfile, setSharingProfile] = useState(null);
  const [closingProfile, setClosingProfile] = useState(null);
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
      linkedin: profile.linkedin || '',
      yearsOfExperience: profile.yearsOfExperience || '',
      resumeText: profile.resumeText || '',
      resumeTemplate: profile.resumeTemplate || 'classic',
      colorScheme: profile.colorScheme || 'green',
      profileBadge: profile.profileBadge || 'SWE',
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
        <Card variant="outlined" sx={{ boxShadow: 1 }}>
          <CardContent>
            <Typography color="text.secondary">
              {canManageProfiles ? 'Create your first profile to use it for tailored applications.' : 'No profiles are available.'}
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 360px))',
          justifyContent: 'start',
          gap: 1.5,
        }}
      >
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            isDeleting={deleting}
            isHighlighted={String(profile.id) === String(highlightedProfileId)}
            isUpdatingStatus={updatingStatus}
            canManage={canManageProfiles}
            canUpdateStatus={canUpdateProfileStatus}
            canRestore={canRestoreProfiles}
            profile={profile}
            onCloseProfile={openCloseDialog}
            onDelete={removeProfile}
            onEdit={openEditDialog}
            onReopenProfile={reopenProfile}
            onShare={openShareDialog}
            onView={setViewingProfile}
          />
        ))}
      </Box>

      <ProfileDialog
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

function ProfileReadOnlyDialog({ profile, onClose }) {
  if (!profile) return null;

  return (
    <Dialog open={Boolean(profile)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{profile.name || 'Profile'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <ReadOnlyField label="Location" value={profile.location} />
            <ReadOnlyField label="Email" value={profile.email} />
            <ReadOnlyField label="Phone" value={profile.phone} />
            <ReadOnlyField label="LinkedIn" value={profile.linkedin} />
            <ReadOnlyField label="Years of experience" value={profile.yearsOfExperience} />
            <ReadOnlyField label="Badge" value={profile.profileBadge || 'SWE'} />
            <ReadOnlyField label="Color" value={profile.colorScheme} />
            <ReadOnlyField label="Status" value={profile.profileStatus || 'active'} />
          </Box>

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

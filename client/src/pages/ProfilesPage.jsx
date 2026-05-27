import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  useProfileShareRequests,
  useRespondToProfileShare,
  useShareBidProfile,
  useUpdateBidProfile,
  useUpdateBidProfileStatus,
} from '../lib/api.js';

export default function ProfilesPage({ currentUser }) {
  const [dialogMode, setDialogMode] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [sharingProfile, setSharingProfile] = useState(null);
  const [closingProfile, setClosingProfile] = useState(null);
  const [shareUsername, setShareUsername] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [error, setError] = useState('');

  const { data: profiles = [], isLoading, error: loadError } = useBidProfiles(
    currentUser?.role === 'admin' ? { scope: 'manage' } : {},
  );
  const { data: shareRequests = {}, error: sharesError } = useProfileShareRequests();
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
      companies: JSON.stringify(profile.companies || [], null, 2),
      education: JSON.stringify(profile.education || [], null, 2),
      resumeText: profile.resumeText || '',
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
    setShareUsername('');
  }

  function closeShareDialog() {
    setSharingProfile(null);
    setShareUsername('');
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
      { profileId: sharingProfile.id, username: shareUsername },
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
  const pageError = error || loadError?.message || sharesError?.message || '';
  const canManageProfiles = !['bidder', 'readonly_bidder', 'editable_bidder'].includes(currentUser?.role);
  const canUpdateProfileStatus = ['admin', 'user'].includes(currentUser?.role);
  const canRestoreProfiles = currentUser?.role === 'admin';

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start', '& .MuiChip-root': { fontWeight: 400 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
      >
        <Typography color="text.secondary" fontWeight={800}>
          {isLoading ? 'Loading profiles...' : `${profiles.length.toLocaleString()} profiles`}
        </Typography>
        {canManageProfiles ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add profile
          </Button>
        ) : null}
      </Stack>

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

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 1.5 }}>
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            isDeleting={deleting}
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
            <TextField
              autoFocus
              fullWidth
              label="User email"
              value={shareUsername}
              onChange={(event) => setShareUsername(event.target.value)}
              required
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {sharingProfile ? `Sharing ${sharingProfile.name}` : ''}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeShareDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={sharing}>
              Share
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
    </Box>
  );
}

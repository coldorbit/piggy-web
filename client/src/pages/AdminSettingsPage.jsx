import { useEffect, useMemo, useState } from 'react';
import InboxIcon from '@mui/icons-material/Inbox';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  TextField,
} from '@mui/material';
import { ALL_WORKSPACES, UNASSIGNED_WORKSPACE, workspaceLabel } from '../components/admin/SuperadminWorkspaceLens.jsx';
import { useWorkspaceFilter } from '../components/admin/WorkspaceFilterContext.jsx';
import {
  useAdminWorkspaceInboxSettings,
  useUpdateAdminWorkspaceInboxSettings,
} from '../lib/api.js';

export default function AdminSettingsPage() {
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const {
    activeWorkspaceId,
    workspaceError,
    workspaces,
    workspacesLoading,
  } = useWorkspaceFilter();
  const hasWorkspaceSelection = ![ALL_WORKSPACES, UNASSIGNED_WORKSPACE].includes(String(activeWorkspaceId));
  const workspaceId = hasWorkspaceSelection ? String(activeWorkspaceId) : '';
  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useAdminWorkspaceInboxSettings(workspaceId);
  const { mutate: updateSettings, isPending } = useUpdateAdminWorkspaceInboxSettings();

  useEffect(() => {
    if (!settings) return;
    setSelectedProfileIds(settings.selectedProfileIds.map(String));
    setNotice('');
    setError('');
  }, [settings]);

  const profiles = settings?.profiles || [];
  const selectedProfiles = useMemo(() => {
    const selectedIds = new Set(selectedProfileIds);
    return profiles.filter((profile) => selectedIds.has(String(profile.id)));
  }, [profiles, selectedProfileIds]);
  const isDirty = settings
    ? !sameProfileSelection(selectedProfileIds, settings.selectedProfileIds)
    : false;
  const pageError = error || settingsError?.message || workspaceError?.message || '';

  function saveProfileIds(profileIds, successMessage) {
    if (!workspaceId) return;
    setError('');
    setNotice('');
    updateSettings(
      { workspaceId, profileIds },
      {
        onSuccess: (nextSettings) => {
          setSelectedProfileIds(nextSettings.selectedProfileIds.map(String));
          setNotice(successMessage);
        },
        onError: (requestError) => setError(requestError.message),
      },
    );
  }

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}

      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          boxShadow: 2,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(239,246,255,0.92))',
          borderColor: 'rgba(37, 99, 235, 0.18)',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1,
              bgcolor: '#0f172a',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <SettingsIcon />
          </Box>
          <Box minWidth={0}>
            <Typography fontWeight={600}>Workspace settings</Typography>
            <Typography variant="body2" color="text.secondary">
              Configure shared behavior for everyone in a workspace.
            </Typography>
          </Box>
        </Stack>
        <Chip
          label={hasWorkspaceSelection ? workspaceLabel(workspaces, activeWorkspaceId) : 'Select a workspace above'}
          color={hasWorkspaceSelection ? 'primary' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, display: 'grid', gap: 1.5, boxShadow: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: '#E0ECFF', color: '#005A9E', display: 'grid', placeItems: 'center' }}>
            <InboxIcon fontSize="small" />
          </Box>
          <Box>
            <Typography fontWeight={600}>Visible inbox emails</Typography>
            <Typography variant="body2" color="text.secondary">
              This selection controls the unified inbox, profile inbox list, unread counts, and notifications for every user with access to this workspace.
            </Typography>
          </Box>
        </Stack>

        {!hasWorkspaceSelection && !workspacesLoading ? (
          <Alert severity="info">
            Choose a specific workspace from the global workspace dropdown to configure its visible Inbox emails.
          </Alert>
        ) : null}

        {hasWorkspaceSelection && (settingsLoading || workspacesLoading) ? (
          <Box sx={{ minHeight: 120, display: 'grid', placeItems: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : null}

        {hasWorkspaceSelection && !settingsLoading && settings && profiles.length ? (
          <>
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={profiles}
              value={selectedProfiles}
              disabled={isPending}
              getOptionLabel={profileInboxAddress}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              onChange={(_event, nextProfiles) => {
                setSelectedProfileIds(nextProfiles.map((profile) => String(profile.id)));
                setNotice('');
              }}
              renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;
                return (
                  <Box component="li" key={key} {...optionProps}>
                    <Checkbox checked={selected} sx={{ mr: 1 }} />
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={600} noWrap>{profileInboxAddress(option)}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {option.name || 'Unnamed profile'} - {option.profileStatus || 'active'}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderTags={(values, getTagProps) => values.map((profile, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return <Chip key={key} label={profileInboxAddress(profile)} size="small" {...tagProps} />;
              })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Emails shown in Inbox"
                  placeholder={selectedProfiles.length ? '' : 'Choose profile emails'}
                />
              )}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {isDirty
                  ? `${selectedProfileIds.length.toLocaleString()} of ${profiles.length.toLocaleString()} profile emails selected (unsaved).`
                  : settings.usesDefaultSelection
                  ? 'Using the default: all eligible profile emails are visible.'
                  : `${selectedProfileIds.length.toLocaleString()} of ${profiles.length.toLocaleString()} profile emails selected.`}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  variant="text"
                  disabled={isPending || (settings.usesDefaultSelection && !isDirty)}
                  startIcon={<RestartAltIcon />}
                  onClick={() => saveProfileIds(null, 'Inbox emails reset to the workspace default.')}
                >
                  Reset to all
                </Button>
                <Button
                  variant="contained"
                  disabled={isPending || !isDirty}
                  startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={() => saveProfileIds(selectedProfileIds, 'Inbox email selection saved.')}
                >
                  Save
                </Button>
              </Stack>
            </Stack>
          </>
        ) : null}

        {hasWorkspaceSelection && !settingsLoading && settings && !profiles.length ? (
          <Alert severity="info">
            This workspace has no active, closed, or legacy profiles with an email address.
          </Alert>
        ) : null}
      </Paper>
    </Box>
  );
}

function profileInboxAddress(profile) {
  return profile.forwardingEmail?.trim() || profile.email?.trim() || 'No email';
}

function sameProfileSelection(left = [], right = []) {
  const leftIds = left.map(String).sort();
  const rightIds = right.map(String).sort();
  return leftIds.length === rightIds.length && leftIds.every((profileId, index) => profileId === rightIds[index]);
}

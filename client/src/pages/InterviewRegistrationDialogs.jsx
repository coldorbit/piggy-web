import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { APPLICATION_WORKFLOW_STATUSES, BID_TABS, DONE_STATUSES, INTERVIEW_KANBAN_COLUMNS, INTERVIEW_STAGES } from '../components/bids/bidConstants.js';
import { filterRowsByWorkspace, workspaceLabel } from '../components/admin/SuperadminWorkspaceLens.jsx';
import { useWorkspaceFilter } from '../components/admin/WorkspaceFilterContext.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import InterviewKanbanBoard from '../components/interviews/InterviewKanbanBoard.jsx';
import InterviewLoadingState from '../components/interviews/InterviewLoadingState.jsx';
import {
  canonicalInterviewStage,
  DEFAULT_INTERVIEW_DURATION_MINUTES,
  groupJobsByStage,
  INTERVIEW_FILTERS,
  INTERVIEW_DURATION_OPTIONS,
  interviewColumnValue,
  interviewStageForColumn,
  interviewStatusForColumn,
  toDatetimeLocalValue,
} from '../components/interviews/interviewUtils.js';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import {
  downloadAuthenticatedFile,
  useBidJobs,
  useBidProfiles,
  useCreateInterviewCall,
  useCreateManualInterview,
  useDeleteInterview,
  useUpdateInterviewCall,
  useUpdateJobBid,
} from '../lib/api.js';
import { formatDateTimeInDefaultTimezone } from '../lib/formatters.js';
import { canAccessProfileHub, canRegisterManualInterviewCalls, isAdminRole, isSuperadmin } from '../lib/roles.js';
import { DEFAULT_TIME_ZONE_LABEL, fromDefaultTimezoneDatetimeLocal } from '../lib/timezone.js';

import { applicationOptionLabel, formatShortDate, stageLabel, statusLabel } from './InterviewPageUtils.js';

export function InterviewRegistrationDialogs({
  activeColor,
  activeProfile,
  applicationOptions,
  applicationPickerLoading,
  applicationSearch,
  callerUsers,
  canRegisterCalls,
  closeManualCallDialog,
  closeManualDialog,
  closePendingStepChangeDialog,
  confirmPendingStepChange,
  creatingInterviewCall,
  creatingManualInterview,
  isManualCallDialogOpen,
  isManualDialogOpen,
  manualCall,
  manualInterview,
  pendingStepChangeSave,
  selectedApplicationJob,
  selectedJob,
  setApplicationSearch,
  setManualCall,
  setManualInterview,
  setSelectedApplicationJob,
  submitManualCall,
  submitManualInterview,
  updateManualCallStage,
  updatingBid,
}) {
  return (
    <>
      <Dialog open={isManualDialogOpen} onClose={closeManualDialog} fullWidth maxWidth="sm">
        <form onSubmit={submitManualInterview}>
          <DialogTitle>Register interview</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
            <Autocomplete
              autoFocus
              clearOnBlur={false}
              filterOptions={(options) => options}
              getOptionLabel={applicationOptionLabel}
              isOptionEqualToValue={(option, value) => String(option?.bid?.id || '') === String(value?.bid?.id || '')}
              loading={applicationPickerLoading}
              noOptionsText={applicationSearch ? 'No done applications found' : 'No done applications'}
              options={applicationOptions}
              value={selectedApplicationJob}
              inputValue={applicationSearch}
              onChange={(_event, option) => {
                setSelectedApplicationJob(option);
                if (option) {
                  setApplicationSearch(applicationOptionLabel(option));
                  setManualInterview((current) => ({
                    ...current,
                    title: option.title || '',
                    company: option.company || '',
                    location: option.location || '',
                    jobUrl: option.url || '',
                  }));
                }
              }}
              onInputChange={(_event, value, reason) => {
                setApplicationSearch(value);
                if (reason === 'clear' || reason === 'input') setSelectedApplicationJob(null);
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'grid', gap: 0.25 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {option.title || 'Untitled role'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[option.company, option.location, statusLabel(option.bid?.status)].filter(Boolean).join(' · ') || 'Done application'}
                  </Typography>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Application"
                  placeholder="Search done applications"
                  helperText="Done-tab applications for this profile"
                />
              )}
              sx={{ mt: 1 }}
            />
            {selectedApplicationJob ? (
              <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 0.75, bgcolor: 'rgba(246, 248, 251, 0.86)' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Box minWidth={0}>
                    <Typography fontWeight={600} noWrap>
                      {selectedApplicationJob.title || 'Untitled role'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {[selectedApplicationJob.company, selectedApplicationJob.location, statusLabel(selectedApplicationJob.bid?.status)].filter(Boolean).join(' · ') || 'Done application'}
                    </Typography>
                  </Box>
                  <Chip label="From application" sx={{ bgcolor: activeColor.soft, color: activeColor.dark, fontWeight: 600 }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {[statusLabel(selectedApplicationJob.bid?.status), selectedApplicationJob.bid?.bidAt ? `Applied ${formatShortDate(selectedApplicationJob.bid.bidAt)}` : 'Done application'].filter(Boolean).join(' · ')}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedApplicationJob(null);
                      setApplicationSearch('');
                      setManualInterview((current) => ({
                        ...current,
                        title: '',
                        company: '',
                        location: '',
                        jobUrl: '',
                      }));
                    }}
                  >
                    Use manual
                  </Button>
                </Box>
              </Paper>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  <TextField
                    label="Job title"
                    required
                    value={manualInterview.title}
                    onChange={(event) => setManualInterview((current) => ({ ...current, title: event.target.value }))}
                  />
                  <TextField
                    label="Company"
                    required
                    value={manualInterview.company}
                    onChange={(event) => setManualInterview((current) => ({ ...current, company: event.target.value }))}
                  />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  <TextField
                    label="Location"
                    value={manualInterview.location}
                    onChange={(event) => setManualInterview((current) => ({ ...current, location: event.target.value }))}
                  />
                  <TextField
                    label="Job link"
                    type="url"
                    value={manualInterview.jobUrl}
                    onChange={(event) => setManualInterview((current) => ({ ...current, jobUrl: event.target.value }))}
                  />
                </Box>
              </>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                label={`Next interview (${DEFAULT_TIME_ZONE_LABEL})`}
                type="datetime-local"
                required
                value={toDatetimeLocalValue(manualInterview.interviewNextAt)}
                onChange={(event) => setManualInterview((current) => ({ ...current, interviewNextAt: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormControl>
                <InputLabel>Step</InputLabel>
                <Select
                  label="Step"
                  value={manualInterview.interviewStage}
                  onChange={(event) => setManualInterview((current) => ({ ...current, interviewStage: event.target.value }))}
                >
                  {INTERVIEW_STAGES.filter((stage) => stage.value !== 'todo').map((stage) => (
                    <MenuItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <FormControl>
              <InputLabel>Duration</InputLabel>
              <Select
                label="Duration"
                value={manualInterview.interviewDurationMinutes}
                onChange={(event) =>
                  setManualInterview((current) => ({ ...current, interviewDurationMinutes: Number(event.target.value) }))
                }
              >
                {INTERVIEW_DURATION_OPTIONS.map((duration) => (
                  <MenuItem key={duration.value} value={duration.value}>
                    {duration.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {canRegisterCalls ? (
              <FormControl>
                <InputLabel>Assignee</InputLabel>
                <Select
                  label="Assignee"
                  value={manualInterview.callerUserId}
                  onChange={(event) => setManualInterview((current) => ({ ...current, callerUserId: event.target.value }))}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {callerUsers.map((caller) => (
                    <MenuItem key={caller.id} value={caller.id}>
                      {caller.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <TextField
              label={`${stageLabel(manualInterview.interviewStage)} meeting link`}
              type="url"
              value={manualInterview.interviewMeetingLink}
              onChange={(event) => setManualInterview((current) => ({ ...current, interviewMeetingLink: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Notes"
              multiline
              minRows={3}
              value={manualInterview.interviewNotes}
              onChange={(event) => setManualInterview((current) => ({ ...current, interviewNotes: event.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeManualDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creatingManualInterview || updatingBid || !manualInterview.interviewNextAt}>
              {selectedApplicationJob ? 'Register from application' : 'Register manually'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog open={isManualCallDialogOpen} onClose={closeManualCallDialog} fullWidth maxWidth="sm">
        <form onSubmit={submitManualCall}>
          <DialogTitle>Register call</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
            {selectedJob ? (
              <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 0.35, bgcolor: 'rgba(246, 248, 251, 0.86)' }}>
                <Typography fontWeight={600} noWrap>
                  {selectedJob.title || 'Untitled role'}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {[selectedJob.company, activeProfile?.name].filter(Boolean).join(' · ') || 'Interview'}
                </Typography>
              </Paper>
            ) : null}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                autoFocus
                label={`Call time (${DEFAULT_TIME_ZONE_LABEL})`}
                required
                type="datetime-local"
                value={toDatetimeLocalValue(manualCall.scheduledAt)}
                onChange={(event) => setManualCall((current) => ({ ...current, scheduledAt: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormControl>
                <InputLabel>Step</InputLabel>
                <Select
                  label="Step"
                  value={manualCall.interviewStage}
                  onChange={(event) => updateManualCallStage(event.target.value)}
                >
                  {INTERVIEW_STAGES.filter((stage) => stage.value !== 'todo').map((stage) => (
                    <MenuItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: callerUsers.length ? '1fr 1fr' : '1fr' }, gap: 1.5 }}>
              <FormControl>
                <InputLabel>Duration</InputLabel>
                <Select
                  label="Duration"
                  value={manualCall.durationMinutes}
                  onChange={(event) => setManualCall((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
                >
                  {INTERVIEW_DURATION_OPTIONS.map((duration) => (
                    <MenuItem key={duration.value} value={duration.value}>
                      {duration.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {callerUsers.length ? (
                <FormControl>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    label="Assignee"
                    value={manualCall.callerUserId}
                    onChange={(event) => setManualCall((current) => ({ ...current, callerUserId: event.target.value }))}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {callerUsers.map((caller) => (
                      <MenuItem key={caller.id} value={caller.id}>
                        {caller.username}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
            </Box>
            <TextField
              label={`${stageLabel(manualCall.interviewStage)} meeting link`}
              type="url"
              value={manualCall.meetingLink}
              onChange={(event) => setManualCall((current) => ({ ...current, meetingLink: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Call notes"
              multiline
              minRows={3}
              value={manualCall.notes}
              onChange={(event) => setManualCall((current) => ({ ...current, notes: event.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeManualCallDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creatingInterviewCall || updatingInterviewCall || !manualCall.scheduledAt}>
              {manualCall.id ? 'Update call' : 'Register call'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog open={Boolean(pendingStepChangeSave)} onClose={closePendingStepChangeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Confirm step change</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1, pt: 2 }}>
          <Typography variant="body2">
            Move this interview from {pendingStepChangeSave?.fromLabel || 'the current step'} to {pendingStepChangeSave?.toLabel || 'the next step'}?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pendingStepChangeSave?.willRegisterCall && pendingStepChangeSave?.bidData?.interviewNextAt
              ? 'A calendar call will be registered for the new step using the next interview time.'
              : pendingStepChangeSave?.willRegisterCall
                ? 'No calendar call will be registered for this move because no next interview time is set.'
                : 'No calendar call will be registered for this move.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePendingStepChangeDialog}>Keep editing</Button>
          <Button disabled={updatingBid} onClick={confirmPendingStepChange} variant="contained">
            Confirm move
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

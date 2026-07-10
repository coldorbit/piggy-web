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


export function externalJobUrl(job) {
  const url = job?.rawJob?.originalUrl || job?.url || '';
  return externalUrl(url);
}

export function externalUrl(url) {
  return /^https?:\/\//i.test(String(url)) ? url : '';
}

export function resumeDownloadUrl(resume) {
  if (resume?.status !== 'ready' || !resume?.filePath || !resume?.id) return '';
  return `/api/bid/tailored-resumes/${encodeURIComponent(resume.id)}/download`;
}

export function callForStage(job, stage) {
  const calls = Array.isArray(job?.bid?.calls) ? job.bid.calls : [];
  return calls.find((call) => String(call.interviewStage || '') === String(stage || '')) || null;
}

export function sortedInterviewCalls(calls) {
  if (!Array.isArray(calls)) return [];
  return [...calls].sort((left, right) => {
    const leftTime = sortableTime(left.scheduledAt);
    const rightTime = sortableTime(right.scheduledAt);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(left.id || 0) - Number(right.id || 0);
  });
}

export function sortableTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

export function resumeFileName(filePath) {
  return filePath ? String(filePath).split('/').pop() || 'tailored-resume.docx' : 'tailored-resume.docx';
}

export function hasMeetingLink(job, draft) {
  const stage = canonicalInterviewStage(draft?.interviewStage || job?.bid?.interviewStage);
  const stageLinks = draft?.stageMeetingLinks || job?.bid?.stageMeetingLinks || {};
  return Boolean(String(stageLinks[stage] || draft?.meetingLink || job?.bid?.meetingLink || '').trim());
}

export function interviewStepChange(job, bidData) {
  const fromStage = canonicalInterviewStage(job?.bid?.interviewStage || 'todo');
  const toStage = canonicalInterviewStage(bidData?.interviewStage || fromStage);
  if (fromStage === toStage) return null;
  return {
    fromStage,
    toStage,
    fromLabel: stageLabel(fromStage),
    toLabel: stageLabel(toStage),
    willRegisterCall: shouldRegisterCallForStepChange(fromStage, toStage, bidData?.status),
  };
}

export function shouldRegisterCallForStepChange(fromStage, toStage, nextStatus = 'interviewing') {
  if (['failed', 'lost'].includes(String(nextStatus || '').trim())) return false;
  if (fromStage === 'todo' && toStage === 'screening') return false;
  return fromStage !== toStage;
}

export function applicationOptionLabel(option) {
  if (!option || typeof option === 'string') return option || '';
  return [option.title || 'Untitled role', option.company].filter(Boolean).join(' · ');
}

export function statusLabel(status) {
  if (status === 'won') return 'Won';
  if (status === 'lost') return 'Lost';
  const workflowStatus = APPLICATION_WORKFLOW_STATUSES.find((option) => option.value === status);
  if (workflowStatus) return workflowStatus.label;
  return '';
}

export function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return '';
  if (value < 60) return `${value} min`;
  const hours = value / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

export function callAssigneeLabel(call, callerUsers, selectedDraft, currentUser) {
  const callerUserId = String(call?.callerUserId || '');
  if (!callerUserId) return 'Unassigned';
  const caller = callerUsers.find((user) => String(user.id) === callerUserId);
  if (caller?.username) return caller.username;
  if (String(selectedDraft?.callerUser?.id || '') === callerUserId && selectedDraft?.callerUser?.username) return selectedDraft.callerUser.username;
  if (String(currentUser?.id || '') === callerUserId && currentUser?.username) return currentUser.username;
  return `Caller #${callerUserId}`;
}

export function callSourceLabel(sourceType) {
  return {
    created: 'Created',
    current_schedule: 'Current schedule',
    manual: 'Manual',
    schedule_update: 'Schedule update',
  }[sourceType] || sourceType;
}

export function stageLabel(value) {
  return INTERVIEW_STAGES.find((stage) => stage.value === value)?.label || 'Stage';
}

export function interviewColumnLabel(value) {
  return INTERVIEW_KANBAN_COLUMNS.find((column) => column.value === value)?.label || stageLabel(value);
}

export function formatJourneyLog(log) {
  const stage = log.metadata?.stage ? stageLabel(log.metadata.stage) : '';
  const scheduledAt = log.metadata?.scheduledAt ? formatDateTimeInDefaultTimezone(log.metadata.scheduledAt) : '';
  return {
    created: 'Created',
    first_scheduled: 'First interview scheduled',
    interview_occurrence: `${stage || 'Interview'} kept as completed${scheduledAt ? ` (${scheduledAt})` : ''}`,
    schedule_changed: 'Schedule changed',
    stage_changed: `Moved ${stageLabel(log.fromValue)} -> ${stageLabel(log.toValue)}`,
    stage_note_changed: `${stage || 'Stage'} note updated`,
    stage_meeting_link_changed: `${stage || 'Stage'} meeting link updated`,
  }[log.eventType] || log.eventType;
}

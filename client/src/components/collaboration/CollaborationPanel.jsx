import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import HistoryIcon from '@mui/icons-material/History';
import LowPriorityIcon from '@mui/icons-material/LowPriority';
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useCollaborationEvents, useCreateCollaborationEvent, useUpdateCollaborationEvent } from '../../lib/api.js';
import { formatDateTime } from '../../lib/formatters.js';

const EVENT_TYPES = [
  { value: 'comment', label: 'Comment', icon: <ChatBubbleOutlineIcon fontSize="small" /> },
  { value: 'task', label: 'Task', icon: <AssignmentTurnedInIcon fontSize="small" /> },
  { value: 'handoff', label: 'Handoff', icon: <LowPriorityIcon fontSize="small" /> },
];

export default function CollaborationPanel({ entityType = 'profile', entityId, profileId, assignableUsers = [] }) {
  const filters = entityType && entityId ? { entityType, entityId } : { profileId };
  const { data: events = [], isLoading, error } = useCollaborationEvents(filters);
  const { mutate: createEvent, isPending: isCreating } = useCreateCollaborationEvent();
  const { mutate: updateEvent, isPending: isUpdating } = useUpdateCollaborationEvent();
  const [eventType, setEventType] = useState('comment');
  const [body, setBody] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [formError, setFormError] = useState('');
  const sortedEvents = useMemo(() => [...events].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)), [events]);

  function submitEvent(event) {
    event.preventDefault();
    setFormError('');
    createEvent(
      {
        entityType,
        entityId,
        profileId,
        eventType,
        body,
        assignedToUserId: eventType === 'task' || eventType === 'handoff' ? assignedToUserId || null : null,
      },
      {
        onSuccess: () => {
          setBody('');
          setAssignedToUserId('');
          setEventType('comment');
        },
        onError: (createError) => setFormError(createError.message),
      },
    );
  }

  function toggleResolved(collaborationEvent) {
    updateEvent({
      eventId: collaborationEvent.id,
      updates: { resolved: !collaborationEvent.resolvedAt },
    });
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <HistoryIcon fontSize="small" color="action" />
        <Typography fontWeight={900}>Collaboration</Typography>
        <Chip size="small" label={`${events.length} updates`} variant="outlined" />
      </Stack>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {formError ? <Alert severity="error">{formError}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
        <Box component="form" onSubmit={submitEvent} sx={{ display: 'grid', gap: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={eventType}
            onChange={(_event, nextType) => {
              if (nextType) setEventType(nextType);
            }}
            sx={{ flexWrap: 'wrap' }}
          >
            {EVENT_TYPES.map((type) => (
              <ToggleButton key={type.value} value={type.value} sx={{ gap: 0.75 }}>
                {type.icon}
                {type.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={eventType === 'handoff' ? 'Handoff note' : eventType === 'task' ? 'Task' : 'Comment'}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Use @username to mention someone"
          />
          {eventType === 'task' || eventType === 'handoff' ? (
            <FormControl fullWidth size="small">
              <InputLabel>Assignee</InputLabel>
              <Select
                label="Assignee"
                value={assignedToUserId}
                onChange={(event) => setAssignedToUserId(event.target.value)}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {assignableUsers.map((user) => (
                  <MenuItem key={user.id} value={String(user.id)}>
                    {user.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={isCreating || !body.trim()}>
              Add
            </Button>
          </Box>
        </Box>
      </Paper>

      <Stack spacing={0.75}>
        {isLoading && !sortedEvents.length ? (
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">Loading collaboration history...</Typography>
          </Paper>
        ) : null}
        {!isLoading && !sortedEvents.length ? (
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, bgcolor: '#F8FAFC' }}>
            <Typography variant="body2" color="text.secondary">No collaboration notes yet.</Typography>
          </Paper>
        ) : null}
        {sortedEvents.map((event) => (
          <Paper key={event.id} variant="outlined" sx={{ p: 1.25, borderRadius: 1, bgcolor: event.resolvedAt ? '#F8FAFC' : 'background.paper' }}>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                <Chip size="small" label={eventLabel(event.eventType)} color={event.eventType === 'change' ? 'default' : 'primary'} variant={event.eventType === 'change' ? 'outlined' : 'filled'} />
                {event.assignedTo ? <Chip size="small" label={`Assigned ${event.assignedTo.username}`} variant="outlined" /> : null}
                {event.resolvedAt ? <Chip size="small" label="Resolved" color="success" variant="outlined" /> : null}
                <Typography variant="caption" color="text.secondary">
                  {event.author?.username || 'System'} · {formatDateTime(event.createdAt)}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {event.body}
              </Typography>
              {event.mentions?.length ? (
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  {event.mentions.map((mention) => <Chip key={mention.id || mention.username} size="small" label={`@${mention.username}`} />)}
                </Stack>
              ) : null}
              {event.eventType === 'task' || event.eventType === 'handoff' ? (
                <Box>
                  <Button size="small" onClick={() => toggleResolved(event)} disabled={isUpdating}>
                    {event.resolvedAt ? 'Reopen' : 'Resolve'}
                  </Button>
                </Box>
              ) : null}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

function eventLabel(value) {
  if (value === 'task') return 'Task';
  if (value === 'handoff') return 'Handoff';
  if (value === 'change') return 'Change';
  return 'Comment';
}

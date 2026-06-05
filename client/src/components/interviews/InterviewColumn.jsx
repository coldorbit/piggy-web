import { useDroppable } from '@dnd-kit/core';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import InterviewCard from './InterviewCard.jsx';

export default function InterviewColumn({
  accent,
  callerUsers,
  canAssignCallers,
  canDeleteInterviews,
  currentUser,
  draftFor,
  isActiveDrop,
  isDeleting,
  isSaving,
  jobs,
  onDraftChange,
  onDelete,
  onSave,
  stage,
}) {
  const { setNodeRef } = useDroppable({
    id: stage.value,
    data: { stage: stage.value },
  });

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: isActiveDrop ? accent.soft : '#F8FAFC',
        borderColor: isActiveDrop ? accent.main : 'divider',
      }}
    >
      <Box
        sx={{
          px: 1,
          py: 0.85,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" fontWeight={900} noWrap sx={{ fontWeight: 900 }}>
          {stage.label}
        </Typography>
        <Chip
          label={jobs.length.toLocaleString()}
          size="small"
          sx={{ bgcolor: accent.soft, color: accent.dark, fontWeight: 900, height: 22 }}
        />
      </Box>
      <Stack spacing={0.85} sx={{ flex: '1 1 auto', minHeight: 0, overflowX: 'hidden', overflowY: 'auto', p: 0.85 }}>
        {!jobs.length ? (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(255, 255, 255, 0.72)' }}>
            <Typography variant="body2" color="text.secondary">
              Drop applications here.
            </Typography>
          </Paper>
        ) : null}
        {jobs.map((job) => (
          <InterviewCard
            key={job.id}
            accent={accent}
            callerUsers={callerUsers}
            canAssignCallers={canAssignCallers}
            canDeleteInterviews={canDeleteInterviews}
            currentUser={currentUser}
            draft={draftFor(job)}
            isDeleting={isDeleting}
            isSaving={isSaving}
            job={job}
            onDelete={() => onDelete(job)}
            onDraftChange={(key, value) => onDraftChange(job, key, value)}
            onSave={(overrides) => onSave(job, overrides)}
          />
        ))}
      </Stack>
    </Paper>
  );
}

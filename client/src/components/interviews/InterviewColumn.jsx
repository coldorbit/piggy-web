import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import InterviewCard from './InterviewCard.jsx';

export default function InterviewColumn({
  accent,
  currentUser,
  draftFor,
  isActiveDrop,
  isSaving,
  jobs,
  onDragEnd,
  onDragEnter,
  onDragStart,
  onDraftChange,
  onDrop,
  onSave,
  stage,
}) {
  return (
    <Paper
      variant="outlined"
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={onDrop}
      sx={{
        display: 'flex',
        flexDirection: 'column',
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
        <Typography variant="body2" fontWeight={900} noWrap>
          {stage.label}
        </Typography>
        <Chip
          label={jobs.length.toLocaleString()}
          size="small"
          sx={{ bgcolor: accent.soft, color: accent.dark, fontWeight: 900, height: 22 }}
        />
      </Box>
      <Stack spacing={0.85} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 0.85 }}>
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
            currentUser={currentUser}
            draft={draftFor(job)}
            isSaving={isSaving}
            job={job}
            onDragEnd={onDragEnd}
            onDragStart={(event) => onDragStart(event, job)}
            onDraftChange={(key, value) => onDraftChange(job, key, value)}
            onSave={(overrides) => onSave(job, overrides)}
          />
        ))}
      </Stack>
    </Paper>
  );
}

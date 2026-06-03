import { Box } from '@mui/material';
import { INTERVIEW_KANBAN_COLUMNS } from '../bids/bidConstants.js';
import InterviewColumn from './InterviewColumn.jsx';

export default function InterviewKanbanBoard({
  activeColor,
  activeDropStage,
  callerUsers,
  canAssignCallers,
  currentUser,
  draftFor,
  isSaving,
  jobsByStage,
  onDragEnd,
  onDragEnter,
  onDragStart,
  onDraftChange,
  onDrop,
  onSave,
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridAutoColumns: { xs: '82vw', sm: 340, xl: 360 },
        gridAutoFlow: 'column',
        gap: 1,
        height: '100%',
        minHeight: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        p: { xs: 1, sm: 1.5 },
      }}
    >
      {INTERVIEW_KANBAN_COLUMNS.map((stage) => (
        <InterviewColumn
          key={stage.value}
          accent={activeColor}
          callerUsers={callerUsers}
          canAssignCallers={canAssignCallers}
          currentUser={currentUser}
          isActiveDrop={activeDropStage === stage.value}
          isSaving={isSaving}
          jobs={jobsByStage[stage.value] || []}
          stage={stage}
          onDragEnd={onDragEnd}
          onDragEnter={() => onDragEnter(stage.value)}
          onDragStart={onDragStart}
          onDrop={(event) => onDrop(event, stage.value)}
          onDraftChange={onDraftChange}
          onSave={onSave}
          draftFor={draftFor}
        />
      ))}
    </Box>
  );
}

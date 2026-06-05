import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Box } from '@mui/material';
import { INTERVIEW_KANBAN_COLUMNS } from '../bids/bidConstants.js';
import InterviewColumn from './InterviewColumn.jsx';

export default function InterviewKanbanBoard({
  activeColor,
  activeDropStage,
  callerUsers,
  canAssignCallers,
  canDeleteInterviews,
  currentUser,
  draftFor,
  isDeleting,
  isSaving,
  jobsByStage,
  onDragEnd,
  onDragOver,
  onDraftChange,
  onDelete,
  onSave,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  function handleDragEnd(event) {
    onDragEnd({
      jobId: event.active?.id,
      stage: event.over?.data?.current?.stage || event.over?.id || '',
    });
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragOver={(event) => onDragOver(event.over?.data?.current?.stage || event.over?.id || '')}
      onDragCancel={() => onDragOver('')}
    >
      <Box
        sx={{
          alignItems: 'stretch',
          display: 'grid',
          gridAutoColumns: { xs: '82vw', sm: 340, xl: 360 },
          gridAutoFlow: 'column',
          gap: 1,
          height: { xs: 'calc(100vh - 176px)', md: '100%' },
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
            canDeleteInterviews={canDeleteInterviews}
            currentUser={currentUser}
            isActiveDrop={activeDropStage === stage.value}
            isDeleting={isDeleting}
            isSaving={isSaving}
            jobs={jobsByStage[stage.value] || []}
            stage={stage}
            onDelete={onDelete}
            onDraftChange={onDraftChange}
            onSave={onSave}
            draftFor={draftFor}
          />
        ))}
      </Box>
    </DndContext>
  );
}

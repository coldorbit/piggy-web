import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Box } from '@mui/material';
import { useState } from 'react';
import { INTERVIEW_KANBAN_COLUMNS } from '../bids/bidConstants.js';
import InterviewCard from './InterviewCard.jsx';
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
  onOpen,
  onSave,
}) {
  const [activeJobId, setActiveJobId] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));
  const activeJob = activeJobId
    ? INTERVIEW_KANBAN_COLUMNS.flatMap((stage) => jobsByStage[stage.value] || []).find((job) => String(job.id) === String(activeJobId))
    : null;

  function handleDragEnd(event) {
    setActiveJobId('');
    onDragEnd({
      jobId: event.active?.id,
      stage: event.over?.data?.current?.stage || event.over?.id || '',
    });
  }

  function handleDragCancel() {
    setActiveJobId('');
    onDragOver('');
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={(event) => setActiveJobId(String(event.active?.id || ''))}
      onDragEnd={handleDragEnd}
      onDragOver={(event) => onDragOver(event.over?.data?.current?.stage || event.over?.id || '')}
      onDragCancel={handleDragCancel}
    >
      <Box
        sx={{
          alignItems: 'stretch',
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(5, minmax(0, 1fr))',
          },
          gridAutoRows: { xs: 'minmax(260px, auto)', md: 'minmax(300px, 1fr)' },
          gap: 1,
          height: { xs: 'calc(100vh - 176px)', md: '100%' },
          minHeight: 0,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
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
            onOpen={onOpen}
            onSave={onSave}
            draftFor={draftFor}
          />
        ))}
      </Box>
      <DragOverlay dropAnimation={null}>
        {activeJob ? (
          <Box sx={{ width: { xs: '82vw', sm: 340, xl: 360 } }}>
            <InterviewCard
              accent={activeColor}
              callerUsers={callerUsers}
              canAssignCallers={canAssignCallers}
              canDeleteInterviews={canDeleteInterviews}
              currentUser={currentUser}
              draft={draftFor(activeJob)}
              isDeleting={isDeleting}
              isSaving={isSaving}
              job={activeJob}
              onDelete={() => {}}
              onOpen={() => {}}
              overlay
            />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

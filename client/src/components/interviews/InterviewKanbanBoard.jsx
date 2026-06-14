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

  function handleBoardWheel(event) {
    if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const board = event.currentTarget;
    const canScrollHorizontally = board.scrollWidth > board.clientWidth;
    if (!canScrollHorizontally) return;

    event.preventDefault();
    board.scrollLeft += event.deltaY;
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
        onWheelCapture={handleBoardWheel}
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

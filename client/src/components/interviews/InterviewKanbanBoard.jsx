import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Box } from '@mui/material';
import { useCallback, useState } from 'react';
import { INTERVIEW_KANBAN_COLUMNS } from '../bids/bidConstants.js';
import InterviewCard from './InterviewCard.jsx';
import InterviewColumn from './InterviewColumn.jsx';

const COLUMN_WIDTH = {
  xs: 'minmax(280px, 82vw)',
  sm: 'minmax(300px, 340px)',
  lg: 'minmax(320px, 360px)',
};

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
  const handleWheel = useCallback((event) => {
    const hasHorizontalOverflow = event.currentTarget.scrollWidth > event.currentTarget.clientWidth;
    const horizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (!hasHorizontalOverflow || !horizontalIntent) return;

    event.preventDefault();
    event.stopPropagation();
  }, []);

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
          gridAutoFlow: 'column',
          gridAutoRows: 'minmax(0, 1fr)',
          gridTemplateColumns: {
            xs: `repeat(${INTERVIEW_KANBAN_COLUMNS.length}, ${COLUMN_WIDTH.xs})`,
            sm: `repeat(${INTERVIEW_KANBAN_COLUMNS.length}, ${COLUMN_WIDTH.sm})`,
            lg: `repeat(${INTERVIEW_KANBAN_COLUMNS.length}, ${COLUMN_WIDTH.lg})`,
          },
          gap: 1,
          height: { xs: 'calc(100vh - 176px)', md: '100%' },
          minHeight: 0,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorX: 'contain',
          p: { xs: 1, sm: 1.5 },
          scrollbarGutter: 'stable',
          WebkitOverflowScrolling: 'touch',
        }}
        onWheel={handleWheel}
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

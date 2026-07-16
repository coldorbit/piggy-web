import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';

export const INTERVIEW_FAILURE_FEEDBACK_OPTIONS = [
  { value: 'bad_preparation', label: 'Bad preparation' },
  { value: 'linkedin_problem', label: 'LinkedIn problem' },
  { value: 'face_problem', label: 'Face problem' },
  { value: 'lack_of_skill', label: 'Lack of skill' },
  { value: 'other', label: 'Other' },
];

export function isFailedInterviewStatus(value) {
  return ['failed', 'lost'].includes(String(value || '').trim().toLowerCase());
}

export function failureFeedbackLabel(value) {
  return INTERVIEW_FAILURE_FEEDBACK_OPTIONS.find((option) => option.value === value)?.label || 'Feedback needed';
}

export function InterviewFailureFeedbackFields({ disabled = false, notes = '', onNotesChange, onReasonChange, reason = '', showError = false }) {
  return (
    <>
      <FormControl required size="small" error={showError && !reason}>
        <InputLabel>Interview feedback</InputLabel>
        <Select
          label="Interview feedback"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          disabled={disabled}
        >
          {INTERVIEW_FAILURE_FEEDBACK_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Feedback notes (optional)"
        minRows={3}
        multiline
        size="small"
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        disabled={disabled}
      />
    </>
  );
}

export function InterviewFailureFeedbackDialog({ interviewLabel = '', isSaving = false, onClose, onConfirm, open }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setNotes('');
    setShowError(false);
  }, [open]);

  function submit(event) {
    event.preventDefault();
    if (!reason) {
      setShowError(true);
      return;
    }
    onConfirm({ failureFeedback: reason, failureFeedbackNotes: notes.trim() || null });
  }

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Why did this interview fail?</DialogTitle>
      <DialogContent component="form" id="interview-failure-feedback-form" onSubmit={submit} sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
        <InterviewFailureFeedbackFields
          disabled={isSaving}
          notes={notes}
          onNotesChange={setNotes}
          onReasonChange={(value) => {
            setReason(value);
            setShowError(false);
          }}
          reason={reason}
          showError={showError}
        />
        {interviewLabel ? <TextField label="Interview" value={interviewLabel} size="small" disabled /> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button type="submit" form="interview-failure-feedback-form" disabled={isSaving} variant="contained">
          Mark failed/lost
        </Button>
      </DialogActions>
    </Dialog>
  );
}

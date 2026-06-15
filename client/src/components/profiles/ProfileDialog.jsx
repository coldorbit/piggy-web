import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { COLOR_OPTIONS, PROFILE_BADGE_COLORS, PROFILE_BADGE_OPTIONS, RESUME_TEMPLATE_OPTIONS } from './profileConstants.js';

export default function ProfileDialog({ canEditDailyBidGoal = false, form, isOpen, isSaving, mode = 'create', onChange, onClose, onSubmit }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={onSubmit}>
        <DialogTitle>{mode === 'edit' ? 'Edit profile' : 'Add profile'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, pt: 1 }}>
            <TextField
              label="Profile name"
              value={form.name}
              onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <TextField
              label="Location"
              value={form.location}
              onChange={(event) => onChange((current) => ({ ...current, location: event.target.value }))}
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(event) => onChange((current) => ({ ...current, phone: event.target.value }))}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))}
            />
            <TextField
              label="LinkedIn"
              value={form.linkedin}
              onChange={(event) => onChange((current) => ({ ...current, linkedin: event.target.value }))}
            />
            <TextField
              label="Years of experience"
              value={form.yearsOfExperience}
              onChange={(event) => onChange((current) => ({ ...current, yearsOfExperience: event.target.value }))}
            />
            <FormControl>
              <InputLabel>Resume template</InputLabel>
              <Select
                label="Resume template"
                value={form.resumeTemplate || 'classic'}
                onChange={(event) => onChange((current) => ({ ...current, resumeTemplate: event.target.value }))}
              >
                {RESUME_TEMPLATE_OPTIONS.map((template) => (
                  <MenuItem key={template.value} value={template.value}>
                    {template.label} - {template.description}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Rotate ATS-friendly single-column DOCX layouts by profile.</FormHelperText>
            </FormControl>
            <FormControl>
              <InputLabel>Color</InputLabel>
              <Select
                label="Color"
                value={form.colorScheme}
                onChange={(event) => onChange((current) => ({ ...current, colorScheme: event.target.value }))}
              >
                {COLOR_OPTIONS.map((color) => (
                  <MenuItem key={color} value={color}>
                    {color}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>Badge</InputLabel>
              <Select
                label="Badge"
                value={form.profileBadge || 'SWE'}
                onChange={(event) => onChange((current) => ({ ...current, profileBadge: event.target.value }))}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip label={selected} size="small" sx={PROFILE_BADGE_COLORS[selected]} />
                  </Box>
                )}
              >
                {PROFILE_BADGE_OPTIONS.map((badge) => (
                  <MenuItem key={badge.value} value={badge.value}>
                    {badge.label} - {badge.description}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Choose the primary role family for this profile.</FormHelperText>
            </FormControl>
            {canEditDailyBidGoal ? (
              <TextField
                label="Daily bid goal"
                type="number"
                value={form.dailyBidGoal ?? 60}
                onChange={(event) => onChange((current) => ({ ...current, dailyBidGoal: event.target.value }))}
                inputProps={{ min: 0, step: 1 }}
                helperText="Submitted or advanced applications expected for this profile each day."
              />
            ) : null}
            <TextField
              label="Resume text"
              multiline
              minRows={6}
              value={form.resumeText}
              onChange={(event) => onChange((current) => ({ ...current, resumeText: event.target.value }))}
              sx={{ gridColumn: { xs: 'auto', md: 'span 2' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSaving}>
            {mode === 'edit' ? 'Save profile' : 'Add profile'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

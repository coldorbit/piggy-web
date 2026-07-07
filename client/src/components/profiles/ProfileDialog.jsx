import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  COLOR_OPTIONS,
  PROFILE_BADGE_COLORS,
  PROFILE_BADGE_OPTIONS,
  PROFILE_COLORS,
  RESUME_TEMPLATE_OPTIONS,
  forwardingAliasForProfileName,
} from './profileConstants.js';

export default function ProfileDialog({ canEditDailyBidGoal = false, form, isOpen, isSaving, mode = 'create', onChange, onClose, onSubmit }) {
  async function handleStaticResumeChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const dataBase64 = await fileToBase64(file);
    onChange((current) => ({
      ...current,
      isStatic: true,
      staticResumeFilename: file.name,
      staticResumeUpload: {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        dataBase64,
      },
    }));
  }

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={onSubmit}>
        <DialogTitle>{mode === 'edit' ? 'Edit profile' : 'Add profile'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, pt: 2 }}>
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
              label="Forwarding alias"
              type="email"
              value={form.forwardingEmail}
              onChange={(event) => onChange((current) => ({ ...current, forwardingEmail: event.target.value }))}
              placeholder={forwardingAliasForProfileName(form.name)}
              helperText={`Default: ${forwardingAliasForProfileName(form.name)}`}
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
            <Box sx={{ display: 'grid', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.isStatic)}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        isStatic: event.target.checked,
                        staticResumeUpload: event.target.checked ? current.staticResumeUpload : null,
                      }))
                    }
                  />
                }
                label="Static profile"
              />
              {form.isStatic ? (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Button component="label" variant="outlined" size="small">
                    {form.staticResumeFilename ? 'Replace static resume' : 'Upload static resume'}
                    <input
                      hidden
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleStaticResumeChange}
                    />
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {form.staticResumeFilename || 'No static resume uploaded.'}
                  </Typography>
                </Box>
              ) : (
                <FormHelperText>Default profiles can tailor the original resume per job.</FormHelperText>
              )}
            </Box>
            <FormControl>
              <InputLabel>Color</InputLabel>
              <Select
                label="Color"
                value={form.colorScheme}
                onChange={(event) => onChange((current) => ({ ...current, colorScheme: event.target.value }))}
                renderValue={(selected) => <ColorOption color={selected} />}
              >
                {COLOR_OPTIONS.map((color) => (
                  <MenuItem key={color} value={color}>
                    <ColorOption color={color} />
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Unable to read resume file'));
    reader.readAsDataURL(file);
  });
}

function ColorOption({ color }) {
  const colors = PROFILE_COLORS[color] || PROFILE_COLORS.green;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: colors.main, border: '1px solid rgba(15, 23, 42, 0.16)' }} />
      <Box component="span">{colorLabel(color)}</Box>
    </Box>
  );
}

function colorLabel(color) {
  const value = String(color || '');
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : 'Green';
}

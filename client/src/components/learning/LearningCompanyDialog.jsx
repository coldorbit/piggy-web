import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useCreateLearningCompany, useUpdateLearningCompany } from '../../lib/api.js';

const EMPTY_COMPANY = { name: '', description: '', website: '', logoUrl: '', industry: '', headquarters: '' };

export default function LearningCompanyDialog({ company, open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_COMPANY);
  const [error, setError] = useState('');
  const createCompany = useCreateLearningCompany();
  const updateCompany = useUpdateLearningCompany();
  const isSaving = createCompany.isPending || updateCompany.isPending;

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_COMPANY,
      ...(company || {}),
      website: company?.website || company?.companyWebsite || '',
      logoUrl: company?.logoUrl || company?.companyLogoUrl || '',
    });
    setError('');
  }, [company, open]);

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setError('');
    const callbacks = { onSuccess: (saved) => onSaved(saved), onError: (saveError) => setError(saveError.message) };
    if (company?.id) updateCompany.mutate({ companyId: company.id, company: form }, callbacks);
    else createCompany.mutate(form, callbacks);
  }

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{company?.id ? 'Edit company directory' : 'Add company directory'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Box sx={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: 1.5, alignItems: 'center' }}>
          <Avatar alt={form.name ? `${form.name} logo preview` : 'Company logo preview'} src={form.logoUrl || undefined} variant="rounded" imgProps={{ referrerPolicy: 'no-referrer' }} sx={{ width: 64, height: 64, border: 1, borderColor: 'divider', bgcolor: '#fff', color: '#7C3AED', fontWeight: 600, '& img': { objectFit: 'contain', p: 0.5 } }}>{form.name.trim().charAt(0).toUpperCase() || '?'}</Avatar>
          <Box><Typography fontWeight={600}>Company information</Typography><Typography variant="body2" color="text.secondary">This directory metadata is shared by every article assigned to the company.</Typography></Box>
        </Box>
        <TextField label="Company name" required value={form.name} onChange={(event) => change('name', event.target.value)} />
        <TextField label="Description" required multiline minRows={3} value={form.description} onChange={(event) => change('description', event.target.value)} />
        <TextField label="Website" required type="url" value={form.website} onChange={(event) => change('website', event.target.value)} />
        <TextField label="Logo image URL" required type="url" value={form.logoUrl} onChange={(event) => change('logoUrl', event.target.value)} helperText="Use a public HTTP or HTTPS image URL." />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="Industry" value={form.industry} onChange={(event) => change('industry', event.target.value)} />
          <TextField label="Headquarters" value={form.headquarters} onChange={(event) => change('headquarters', event.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={isSaving}>{isSaving ? 'Saving…' : company?.id ? 'Save company' : 'Add company'}</Button>
      </DialogActions>
    </Dialog>
  );
}

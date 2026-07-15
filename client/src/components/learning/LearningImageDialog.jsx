import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { normalizeLearningImageUrl } from '../../pages/learningHub/learningArticleImages.js';

export default function LearningImageDialog({ initialAlt = '', initialUrl = '', onClose, onInsert, open }) {
  const [alt, setAlt] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAlt(initialAlt);
    setUrl(initialUrl);
    setError('');
    setPreviewFailed(false);
  }, [initialAlt, initialUrl, open]);

  const previewUrl = useMemo(() => {
    try { return normalizeLearningImageUrl(url); } catch { return ''; }
  }, [url]);

  function submit(event) {
    event.preventDefault();
    try {
      const normalizedUrl = normalizeLearningImageUrl(url);
      if (!alt.trim()) throw new Error('Add a short image description for accessibility.');
      setError('');
      onInsert({ alt: alt.trim(), url: normalizedUrl });
    } catch (validationError) {
      setError(validationError.message);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle>Insert image</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Use a direct, publicly accessible image URL. The image will be placed at your current cursor position.
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          autoFocus
          required
          label="Image URL"
          placeholder="https://example.com/image.png"
          value={url}
          onChange={(event) => { setUrl(event.target.value); setPreviewFailed(false); }}
          inputProps={{ inputMode: 'url', spellCheck: false }}
        />
        <TextField
          required
          label="Image description"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          helperText="Briefly describe what the image communicates for screen-reader users."
        />
        {previewUrl ? (
          <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Preview</Typography>
            {previewFailed ? <Alert severity="warning">The image could not be previewed. Check that the URL points directly to an image.</Alert> : (
              <Box
                component="img"
                src={previewUrl}
                alt=""
                onError={() => setPreviewFailed(true)}
                referrerPolicy="no-referrer"
                sx={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'contain', border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'grey.50' }}
              />
            )}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" startIcon={<ImageOutlinedIcon />}>Insert image</Button>
      </DialogActions>
    </Dialog>
  );
}

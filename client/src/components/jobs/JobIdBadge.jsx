import { useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Chip, Tooltip } from '@mui/material';
import { copyText } from '../../lib/clipboard.js';

export default function JobIdBadge({ job, sx }) {
  const [copied, setCopied] = useState(false);
  const publicJobId = job?.publicJobId;
  if (!publicJobId) return null;

  async function copyJobId(event) {
    event.stopPropagation();
    const didCopy = await copyText(publicJobId);
    if (!didCopy) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Tooltip title={copied ? 'Copied Job ID' : 'Copy Job ID'}>
      <Chip
        aria-label={`Copy Job ID ${publicJobId}`}
        icon={copied ? <CheckIcon /> : <ContentCopyIcon />}
        label={publicJobId}
        onClick={copyJobId}
        size="small"
        sx={{
          height: 22,
          maxWidth: 118,
          bgcolor: copied ? '#dcfce7' : '#eef2ff',
          color: copied ? '#166534' : '#3730a3',
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 900,
          '& .MuiChip-label': { px: 0.65 },
          '& .MuiChip-icon': {
            color: 'inherit',
            fontSize: 14,
            ml: 0.65,
            mr: -0.35,
          },
          ...sx,
        }}
      />
    </Tooltip>
  );
}

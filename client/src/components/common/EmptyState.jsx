import { Box, Paper, Typography } from '@mui/material';

export default function EmptyState({ action = null, children, detail, title, variant = 'framed', sx }) {
  const Wrapper = variant === 'plain' ? Box : Paper;
  const wrapperProps = variant === 'plain' ? {} : { variant: 'outlined' };
  const heading = title || children;

  return (
    <Wrapper
      {...wrapperProps}
      sx={{
        p: 3,
        borderRadius: 1,
        display: 'grid',
        gap: 1,
        justifyItems: 'center',
        textAlign: 'center',
        bgcolor: '#F8FAFC',
        ...sx,
      }}
    >
      <Box>
        {heading ? <Typography fontWeight={900}>{heading}</Typography> : null}
        {detail ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {detail}
          </Typography>
        ) : null}
      </Box>
      {action}
    </Wrapper>
  );
}

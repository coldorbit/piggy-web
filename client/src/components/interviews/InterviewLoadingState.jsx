import { Box, Paper, Skeleton, Stack } from '@mui/material';

export default function InterviewLoadingState() {
  return (
    <Box sx={{ m: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
      {Array.from({ length: 3 }).map((_, columnIndex) => (
        <Paper key={`interview-column-loading-${columnIndex}`} variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
          <Stack spacing={1}>
            <Skeleton width="48%" />
            {Array.from({ length: 3 }).map((__, cardIndex) => (
              <Paper key={`interview-loading-${columnIndex}-${cardIndex}`} variant="outlined" sx={{ p: 1.25 }}>
                <Stack spacing={0.75}>
                  <Skeleton width="72%" />
                  <Skeleton width="46%" />
                  <Skeleton variant="rounded" height={40} />
                  <Stack direction="row" justifyContent="space-between">
                    <Skeleton width={84} />
                    <Skeleton variant="rounded" width={72} height={24} />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

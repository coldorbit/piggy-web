import { Avatar, Box, LinearProgress, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { authPageSx } from './landingStyles.js';

const DRAWER_WIDTH = 248;
const shellLine = '#E2E8F0';

export default function ShellLoading() {
  return (
    <Box
      sx={{
        ...authPageSx,
        p: { xs: 2, sm: 3 },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: 'min(960px, 100%)',
          minHeight: { xs: 420, sm: 500 },
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.16)',
          borderColor: shellLine,
          bgcolor: 'rgba(255, 255, 255, 0.94)',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: `${DRAWER_WIDTH}px minmax(0, 1fr)` },
            minHeight: { xs: 420, sm: 500 },
          }}
        >
          <Box
            sx={{
              display: { xs: 'none', md: 'grid' },
              alignContent: 'start',
              gap: 1,
              borderRight: 1,
              borderColor: shellLine,
              bgcolor: '#FFFFFF',
            }}
            aria-hidden="true"
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minHeight: 68, px: 1.5, borderBottom: 1, borderColor: shellLine }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  display: 'grid',
                  placeItems: 'center',
                  border: 1,
                  borderColor: '#DBEAFE',
                  borderRadius: 2,
                  bgcolor: '#EFF6FF',
                  boxShadow: '0 10px 24px rgba(37, 99, 235, 0.14)',
                }}
              >
                <Avatar
                  src="/assets/applypilot-logo.png"
                  alt=""
                  variant="rounded"
                  sx={{ width: 26, height: 26, bgcolor: 'background.paper', borderRadius: 1.25 }}
                />
              </Box>
              <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
                <Skeleton width={92} height={18} />
                <Skeleton width={128} height={14} />
              </Box>
            </Stack>
            <Box sx={{ display: 'grid', gap: 0.35, px: 1, py: 1 }}>
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton
                  key={`shell-nav-loading-${index}`}
                  variant="rounded"
                  height={42}
                  width={index === 0 ? '100%' : `${74 + (index % 4) * 6}%`}
                  sx={{ borderRadius: 1 }}
                />
              ))}
            </Box>
            <Box sx={{ mt: 'auto', p: 1 }}>
              <Skeleton variant="rounded" height={84} sx={{ borderRadius: 1 }} />
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minWidth: 0 }}>
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderBottom: 1,
                borderColor: shellLine,
                bgcolor: 'rgba(255, 255, 255, 0.88)',
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar
                  src="/assets/applypilot-logo.png"
                  alt="ApplyPilot logo"
                  variant="rounded"
                  sx={{ width: 38, height: 38, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={900} sx={{ color: 'text.primary' }}>
                    Preparing ApplyPilot
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Loading your workspace
                  </Typography>
                </Box>
              </Stack>
              <LinearProgress
                aria-label="Loading ApplyPilot workspace"
                sx={{
                  mt: 2,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: '#E2E8F0',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    bgcolor: '#2563EB',
                  },
                }}
              />
            </Box>

            <Box
              sx={{ p: { xs: 2, sm: 2.5 }, display: 'grid', gap: 1.5, alignContent: 'start' }}
              aria-hidden="true"
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
                <Skeleton variant="rounded" height={78} />
                <Skeleton variant="rounded" height={78} />
                <Skeleton variant="rounded" height={78} />
              </Box>
              <Skeleton variant="rounded" height={44} />
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={`shell-row-loading-${index}`} variant="rounded" height={52} />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

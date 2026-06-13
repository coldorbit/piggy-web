import { Avatar, Box, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';

const DRAWER_WIDTH = 248;
const shellLine = '#E2E8F0';
const surface = '#FFFFFF';
const mutedSurface = '#F8FAFC';
const navWidths = ['84%', '72%', '92%', '68%', '78%', '88%', '64%', '74%'];

export default function ShellLoading() {
  return (
    <Box
      aria-busy="true"
      aria-label="Loading ApplyPilot workspace"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: mutedSurface,
        color: 'text.primary',
      }}
    >
      <Box
        component="aside"
        aria-hidden="true"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          borderRight: 1,
          borderColor: shellLine,
          bgcolor: surface,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ minHeight: 68, px: 1.5, borderBottom: 1, borderColor: shellLine, alignItems: 'center' }}
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
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={900} sx={{ color: 'primary.dark', letterSpacing: 0, lineHeight: 1.1 }}>
              ApplyPilot
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Loading workspace
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ display: 'grid', gap: 0.35, px: 1, py: 1.25 }}>
          {navWidths.map((width, index) => (
            <Box
              key={`shell-nav-loading-${index}`}
              sx={{
                minHeight: 38,
                display: 'grid',
                gridTemplateColumns: '28px minmax(0, 1fr)',
                alignItems: 'center',
                gap: 1,
                px: 1,
                borderRadius: 1,
                bgcolor: index === 0 ? '#EFF6FF' : 'transparent',
              }}
            >
              <Skeleton variant="rounded" width={22} height={22} sx={{ borderRadius: 1 }} />
              <Skeleton variant="text" width={width} height={18} />
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 'auto', p: 1 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 0.75,
              p: 1,
              border: 1,
              borderColor: shellLine,
              borderRadius: 1,
              bgcolor: mutedSurface,
            }}
          >
            <Skeleton variant="text" width="44%" height={14} />
            <Skeleton variant="text" width="82%" height={20} />
            <Skeleton variant="rounded" width={74} height={22} sx={{ borderRadius: 999 }} />
          </Box>
        </Box>
      </Box>

      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          component="header"
          sx={{
            minHeight: 68,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: { xs: 2, md: 2.5 },
            borderBottom: 1,
            borderColor: shellLine,
            bgcolor: 'rgba(255, 255, 255, 0.96)',
            position: 'relative',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
            <Avatar
              src="/assets/applypilot-logo.png"
              alt="ApplyPilot logo"
              variant="rounded"
              sx={{ width: 32, height: 32, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
            />
            <Typography fontWeight={900} sx={{ color: 'primary.dark', letterSpacing: 0 }}>
              ApplyPilot
            </Typography>
          </Stack>

          <Box sx={{ minWidth: 0, flex: 1, display: { xs: 'none', sm: 'grid' }, gap: 0.35 }}>
            <Skeleton variant="text" width="min(260px, 45%)" height={24} />
            <Skeleton variant="text" width="min(420px, 62%)" height={16} />
          </Box>

          <Stack direction="row" spacing={1} sx={{ ml: 'auto', alignItems: 'center' }} aria-hidden="true">
            <Skeleton variant="rounded" width={132} height={32} sx={{ display: { xs: 'none', sm: 'block' } }} />
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>

          <LinearProgress
            aria-label="Loading"
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -1,
              height: 2,
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'primary.main',
              },
            }}
          />
        </Box>

        <Box
          component="main"
          aria-hidden="true"
          sx={{
            flex: 1,
            minHeight: 0,
            p: { xs: 1.5, sm: 2, lg: 2.5 },
            display: 'grid',
            gap: 1.5,
            alignContent: 'start',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 280px' },
              gap: 1.5,
              alignItems: 'stretch',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                p: 1.5,
                border: 1,
                borderColor: shellLine,
                borderRadius: 1,
                bgcolor: surface,
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0, flex: 1 }}>
                  <Skeleton variant="text" width="min(320px, 72%)" height={30} />
                  <Skeleton variant="text" width="min(520px, 88%)" height={18} />
                </Box>
                <Stack direction="row" spacing={0.75}>
                  <Skeleton variant="rounded" width={82} height={30} />
                  <Skeleton variant="rounded" width={96} height={30} />
                </Stack>
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1,
                }}
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <Box
                    key={`shell-metric-loading-${index}`}
                    sx={{ display: 'grid', gap: 0.75, p: 1, border: 1, borderColor: shellLine, borderRadius: 1 }}
                  >
                    <Skeleton variant="text" width="42%" height={14} />
                    <Skeleton variant="text" width="64%" height={28} />
                    <Skeleton variant="rounded" width="78%" height={8} sx={{ borderRadius: 999 }} />
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              sx={{
                display: { xs: 'none', lg: 'grid' },
                gap: 1,
                p: 1.5,
                border: 1,
                borderColor: shellLine,
                borderRadius: 1,
                bgcolor: surface,
              }}
            >
              <Skeleton variant="text" width="46%" height={18} />
              <Skeleton variant="rounded" height={34} />
              <Skeleton variant="rounded" height={34} />
              <Skeleton variant="rounded" height={34} />
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.35fr) minmax(340px, 0.65fr)' },
              gap: 1.5,
              minHeight: 0,
            }}
          >
            <Box sx={{ border: 1, borderColor: shellLine, borderRadius: 1, bgcolor: surface, overflow: 'hidden' }}>
              <Box
                sx={{
                  minHeight: 48,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 96px 96px 76px',
                  gap: 1,
                  alignItems: 'center',
                  px: 1.5,
                  borderBottom: 1,
                  borderColor: shellLine,
                }}
              >
                <Skeleton variant="text" width="42%" height={18} />
                <Skeleton variant="text" width="80%" height={18} />
                <Skeleton variant="text" width="72%" height={18} />
                <Skeleton variant="text" width="64%" height={18} />
              </Box>
              {Array.from({ length: 7 }).map((_, index) => (
                <Box
                  key={`shell-table-row-loading-${index}`}
                  sx={{
                    minHeight: 58,
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 96px 96px 76px' },
                    gap: 1,
                    alignItems: 'center',
                    px: 1.5,
                    borderBottom: index === 6 ? 0 : 1,
                    borderColor: shellLine,
                  }}
                >
                  <Box sx={{ display: 'grid', gap: 0.35 }}>
                    <Skeleton variant="text" width={`${72 + (index % 3) * 8}%`} height={20} />
                    <Skeleton variant="text" width={`${44 + (index % 4) * 7}%`} height={14} />
                  </Box>
                  <Skeleton variant="rounded" width={72} height={22} sx={{ display: { xs: 'none', sm: 'block' }, borderRadius: 999 }} />
                  <Skeleton variant="text" width={64} height={18} sx={{ display: { xs: 'none', sm: 'block' } }} />
                  <Skeleton variant="circular" width={26} height={26} sx={{ display: { xs: 'none', sm: 'block' } }} />
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                display: { xs: 'none', xl: 'grid' },
                alignContent: 'start',
                gap: 1,
                p: 1.5,
                border: 1,
                borderColor: shellLine,
                borderRadius: 1,
                bgcolor: surface,
              }}
            >
              <Skeleton variant="text" width="52%" height={22} />
              <Skeleton variant="rounded" height={120} />
              <Skeleton variant="text" width="86%" height={18} />
              <Skeleton variant="text" width="74%" height={18} />
              <Skeleton variant="text" width="80%" height={18} />
              <Stack direction="row" spacing={0.75} sx={{ pt: 0.5 }}>
                <Skeleton variant="rounded" width={82} height={28} />
                <Skeleton variant="rounded" width={96} height={28} />
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

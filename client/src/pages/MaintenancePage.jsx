import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SecurityIcon from '@mui/icons-material/Security';
import { Avatar, Box, Chip, Paper, Stack, Typography } from '@mui/material';

const maintenanceItems = [
  { icon: <BuildIcon />, label: 'Platform upgrades in progress' },
  { icon: <SecurityIcon />, label: 'Security and reliability checks are running' },
  { icon: <ScheduleIcon />, label: 'The workspace will return as soon as maintenance is complete' },
];

export default function MaintenancePage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: { xs: 2, sm: 3 },
        py: { xs: 5, md: 7 },
        bgcolor: '#07111F',
        color: '#FFFFFF',
        background:
          'linear-gradient(135deg, rgba(7, 17, 31, 0.98) 0%, rgba(15, 23, 42, 0.96) 46%, rgba(12, 74, 110, 0.84) 100%)',
      }}
    >
      <Box sx={{ width: 'min(980px, 100%)', display: 'grid', gap: 2.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            src="/assets/applypilot-logo.png"
            alt="ApplyPilot logo"
            variant="rounded"
            sx={{
              width: 42,
              height: 42,
              bgcolor: '#FFFFFF',
              boxShadow: '0 18px 42px rgba(37, 99, 235, 0.28)',
            }}
          />
          <Box minWidth={0}>
            <Typography fontWeight={950} lineHeight={1}>
              ApplyPilot
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.72)' }}>
              Software engineering firm
            </Typography>
          </Box>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            overflow: 'hidden',
            borderRadius: 1.5,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            bgcolor: 'rgba(255, 255, 255, 0.92)',
            boxShadow: '0 34px 100px rgba(0, 0, 0, 0.34)',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' },
              gap: 0,
            }}
          >
            <Box sx={{ p: { xs: 2.5, sm: 4, md: 5 } }}>
              <Chip
                icon={<AutoAwesomeIcon />}
                label="Maintenance mode"
                sx={{
                  mb: 2.5,
                  bgcolor: '#EEF2FF',
                  color: '#3730A3',
                  '& .MuiChip-icon': { color: '#0067C0' },
                }}
              />
              <Typography
                component="h1"
                sx={{
                  maxWidth: 620,
                  color: 'text.primary',
                  fontSize: { xs: 36, sm: 48, md: 58 },
                  lineHeight: 1,
                  fontWeight: 950,
                }}
              >
                We are making the platform stronger.
              </Typography>
              <Typography
                sx={{
                  mt: 2,
                  maxWidth: 600,
                  color: 'text.secondary',
                  fontSize: { xs: 16, md: 18 },
                  lineHeight: 1.65,
                }}
              >
                The workspace is temporarily offline while we perform planned maintenance. No action
                is needed from you; access will return when the work is complete.
              </Typography>

              <Stack spacing={1.25} sx={{ mt: 3 }}>
                {maintenanceItems.map((item) => (
                  <Stack
                    key={item.label}
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    sx={{ color: 'text.secondary' }}
                  >
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1,
                        bgcolor: 'rgba(0, 103, 192, 0.10)',
                        color: 'primary.main',
                        flexShrink: 0,
                        '& svg': { fontSize: 20 },
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography fontWeight={850}>{item.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                display: 'grid',
                alignContent: 'space-between',
                gap: 2,
                p: { xs: 2.5, md: 3 },
                bgcolor: '#1B1B1B',
                color: '#FFFFFF',
              }}
            >
              <Box>
                <Typography variant="overline" fontWeight={950} sx={{ color: '#93C5FD' }}>
                  System status
                </Typography>
                <Typography variant="h5" fontWeight={950} sx={{ mt: 0.5 }}>
                  Temporarily unavailable
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gap: 1 }}>
                {['Application access paused', 'Background services protected', 'No API connection required'].map(
                  (label) => (
                    <Stack key={label} direction="row" spacing={1} alignItems="center">
                      <CheckCircleIcon sx={{ color: '#86EFAC', fontSize: 20 }} />
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.82)' }}>{label}</Typography>
                    </Stack>
                  ),
                )}
              </Box>

              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.68)' }}>
                Thank you for your patience while we complete the work.
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import InsightsIcon from '@mui/icons-material/Insights';
import LockIcon from '@mui/icons-material/Lock';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SpeedIcon from '@mui/icons-material/Speed';
import TuneIcon from '@mui/icons-material/Tune';
import WorkIcon from '@mui/icons-material/Work';
import { Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import SignInCard from './SignInCard.jsx';
import {
  audienceBandSx,
  audienceCardSx,
  commandCenterSx,
  dashboardCardSx,
  dashboardHeaderSx,
  dashboardListItemSx,
  featureCardSx,
  featureGridSx,
  featureIconSx,
  heroActionsSx,
  heroBackdropSx,
  heroContentSx,
  heroDashboardSx,
  heroSx,
  landingPageSx,
  metricItemSx,
  metricStripSx,
  phaseCardSx,
  phaseGridSx,
  sectionHeaderSx,
  sectionSx,
  signinBandSx,
  topbarSx,
} from './landingStyles.js';

const heroMetrics = [
  { value: '01', label: 'single place to run the search' },
  { value: '03', label: 'connected workspaces' },
  { value: '92%', label: 'example role fit signal' },
];

const features = [
  {
    title: 'Signal-rich job review',
    copy: 'Filter noisy job feeds into the roles worth real attention, with context preserved as you move.',
    icon: <FilterAltIcon />,
  },
  {
    title: 'Profile-aware tailoring',
    copy: 'Keep candidate strengths, resume details, and job requirements connected before every bid.',
    icon: <AutoAwesomeIcon />,
  },
  {
    title: 'Application momentum',
    copy: 'See what is new, what is ready, and what needs review without bouncing across tools.',
    icon: <SpeedIcon />,
  },
];

const pipelineRows = [
  { role: 'Senior frontend engineer', company: 'Northstar Labs', score: '92%', status: 'Ready' },
  { role: 'Product platform engineer', company: 'Lumen Works', score: '87%', status: 'Tailoring' },
  { role: 'Design systems lead', company: 'Arc Studio', score: '81%', status: 'Review' },
];

const phases = [
  { label: 'Discover', title: 'Review matched roles', copy: 'Bring promising jobs into a clean, scannable queue.' },
  { label: 'Shape', title: 'Tune the candidate story', copy: 'Align profile signals with what each role actually asks for.' },
  { label: 'Launch', title: 'Submit with confidence', copy: 'Track each tailored bid from draft to decision.' },
];

const audiences = [
  'Independent job seekers managing a serious pipeline',
  'Bid teams tailoring applications across profiles',
  'Admins keeping users, roles, and application flow organized',
];

export default function MarketingLandingPage() {
  return (
    <Box sx={landingPageSx}>
      <Box sx={heroBackdropSx} />
      <Box component="header" sx={topbarSx}>
        <Stack direction="row" alignItems="center" spacing={1.25} minWidth={0}>
          <Avatar
            src="/assets/applypilot-logo.png"
            alt="ApplyPilot logo"
            variant="rounded"
            sx={{ width: 40, height: 40, bgcolor: 'background.paper', boxShadow: 2 }}
          />
          <Box minWidth={0}>
            <Typography fontWeight={950} lineHeight={1} color="#FFFFFF">
              ApplyPilot
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.72)' }}>
              Career command center
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Button href="/pricing" sx={{ color: 'rgba(255, 255, 255, 0.84)', fontWeight: 900 }}>
            Pricing
          </Button>
          <Button
            href="#signin"
            variant="outlined"
            startIcon={<LockIcon />}
            sx={{
              color: '#FFFFFF',
              borderColor: 'rgba(255, 255, 255, 0.42)',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255, 255, 255, 0.16)' },
            }}
          >
            Sign in
          </Button>
        </Stack>
      </Box>

      <Box component="main">
        <Box sx={heroSx}>
          <Box sx={heroContentSx}>
            <Chip
              icon={<RocketLaunchIcon />}
              label="For focused, high-intent application work"
              sx={{
                width: 'fit-content',
                maxWidth: '100%',
                bgcolor: 'rgba(255, 255, 255, 0.14)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.32)',
                backdropFilter: 'blur(18px)',
                '& .MuiChip-icon': { color: '#A7F3D0' },
              }}
            />
            <Stack spacing={2.25}>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: 48, sm: 70, lg: 96 },
                  lineHeight: { xs: 0.98, md: 0.92 },
                  fontWeight: 950,
                  maxWidth: 860,
                  color: '#FFFFFF',
                  textShadow: '0 20px 60px rgba(0, 0, 0, 0.38)',
                }}
              >
                ApplyPilot
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 20, md: 25 },
                  lineHeight: 1.55,
                  color: 'rgba(255, 255, 255, 0.84)',
                  maxWidth: 720,
                }}
              >
                A polished command center for discovering stronger-fit roles, shaping candidate
                stories, tailoring resumes, and moving every application forward.
              </Typography>
            </Stack>
            <Stack sx={heroActionsSx}>
              <Button href="#signin" variant="contained" size="large" startIcon={<FlightTakeoffIcon />}>
                Open workspace
              </Button>
              <Button
                href="/pricing"
                variant="outlined"
                size="large"
                startIcon={<InsightsIcon />}
                sx={{
                  color: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.38)',
                  bgcolor: 'rgba(15, 23, 42, 0.22)',
                  '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(15, 23, 42, 0.34)' },
                }}
              >
                View pricing
              </Button>
            </Stack>
            <Box sx={metricStripSx}>
              {heroMetrics.map((metric) => (
                <Box key={metric.label} sx={metricItemSx}>
                  <Typography fontWeight={950} fontSize={24}>
                    {metric.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metric.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Paper variant="outlined" sx={heroDashboardSx}>
            <Box sx={dashboardHeaderSx}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#EF4444' }} />
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#F59E0B' }} />
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#22C55E' }} />
              </Stack>
              <Chip label="Live pipeline" size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534' }} />
            </Box>
            <Box sx={commandCenterSx}>
              <Box sx={dashboardCardSx}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WorkIcon sx={{ color: '#2563EB' }} />
                  <Typography fontWeight={950}>Priority roles</Typography>
                </Stack>
                <Stack spacing={1.1}>
                  {pipelineRows.map((row) => (
                    <Box key={row.role} sx={dashboardListItemSx}>
                      <Box minWidth={0}>
                        <Typography fontWeight={900} noWrap>
                          {row.role}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {row.company}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5}>
                        <Typography fontWeight={950} color="primary.main">
                          {row.score}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.status}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Box sx={{ ...dashboardCardSx, bgcolor: '#F0FDFA', borderColor: '#99F6E4' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <AutoAwesomeIcon sx={{ color: '#0F766E' }} />
                  <Typography fontWeight={950}>Tailoring status</Typography>
                </Stack>
                {['Resume angle selected', 'Profile proof points synced', 'Bid package ready'].map((item) => (
                  <Stack key={item} direction="row" alignItems="center" spacing={1}>
                    <CheckCircleIcon sx={{ color: '#16A34A', fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      {item}
                    </Typography>
                  </Stack>
                ))}
                <Button href="#signin" variant="contained" size="small" sx={{ mt: 0.5 }}>
                  Continue review
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Box sx={audienceBandSx}>
          {audiences.map((audience) => (
            <Box key={audience} sx={audienceCardSx}>
              <CheckCircleIcon sx={{ color: '#A7F3D0', fontSize: 20 }} />
              <Typography>{audience}</Typography>
            </Box>
          ))}
        </Box>

        <Box id="workflow" sx={sectionSx}>
          <Box sx={sectionHeaderSx}>
            <Typography variant="overline" fontWeight={950} color="secondary.main">
              Workflow
            </Typography>
            <Typography variant="h3" fontWeight={950}>
              From job feed to finished bid, without the scatter.
            </Typography>
            <Typography color="text.secondary">
              ApplyPilot gives every stage a clear place to live, so the search feels less like
              tab juggling and more like forward motion.
            </Typography>
          </Box>
          <Box sx={phaseGridSx}>
            {phases.map((phase, index) => (
              <Paper key={phase.label} variant="outlined" sx={phaseCardSx}>
                <Typography variant="overline" fontWeight={950} color="primary.main">
                  {String(index + 1).padStart(2, '0')} / {phase.label}
                </Typography>
                <Typography variant="h5" fontWeight={950}>
                  {phase.title}
                </Typography>
                <Typography color="text.secondary">{phase.copy}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>

        <Box sx={sectionSx}>
          <Box sx={sectionHeaderSx}>
            <Typography variant="overline" fontWeight={950} color="secondary.main">
              Product edge
            </Typography>
            <Typography variant="h3" fontWeight={950}>
              Designed to feel calm even when the pipeline is busy.
            </Typography>
            <Typography color="text.secondary">
              The interface stays operational: compact enough to scan, rich enough to guide the
              next best action.
            </Typography>
          </Box>
          <Box sx={featureGridSx}>
            {features.map((feature) => (
              <Paper key={feature.title} variant="outlined" sx={featureCardSx}>
                <Box sx={featureIconSx}>{feature.icon}</Box>
                <Typography fontWeight={950}>{feature.title}</Typography>
                <Typography color="text.secondary">{feature.copy}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>

        <Box sx={signinBandSx}>
          <Box sx={{ maxWidth: 520 }}>
            <Chip
              icon={<TuneIcon />}
              label="Designed for focused application work"
              sx={{ mb: 2, bgcolor: '#EEF2FF', color: '#3730A3' }}
            />
            <Typography variant="h3" fontWeight={950} gutterBottom>
              Pick up exactly where you left off.
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.65 }}>
              Your saved jobs, profiles, tailored resumes, and application status are ready as soon
              as you sign in.
            </Typography>
          </Box>
          <SignInCard />
        </Box>
      </Box>
    </Box>
  );
}

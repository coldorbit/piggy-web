import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CodeIcon from '@mui/icons-material/Code';
import InsightsIcon from '@mui/icons-material/Insights';
import LanIcon from '@mui/icons-material/Lan';
import LockIcon from '@mui/icons-material/Lock';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
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
  portfolioCardSx,
  portfolioGridSx,
  portfolioMetaItemSx,
  portfolioMetaSx,
  sectionHeaderSx,
  sectionSx,
  signinBandSx,
  topbarSx,
} from './landingStyles.js';

const heroMetrics = [
  { value: '10+', label: 'enterprise-scale delivery programs' },
  { value: '99.9%', label: 'availability-minded platform design' },
  { value: '0', label: 'patience for fragile handoffs' },
];

const features = [
  {
    title: 'Product engineering',
    copy: 'From first prototype to production system, we design the workflows, interfaces, APIs, and architecture together.',
    icon: <CodeIcon />,
  },
  {
    title: 'AI-native systems',
    copy: 'We turn emerging AI capabilities into durable tools with guardrails, evaluation loops, and human-centered UX.',
    icon: <InsightsIcon />,
  },
  {
    title: 'Cloud operations',
    copy: 'Secure infrastructure, observability, and deployment practices that make ambitious software feel dependable.',
    icon: <SecurityIcon />,
  },
];

const pipelineRows = [
  { role: 'Enterprise platform rebuild', company: 'Workflow, data, and cloud migration', score: 'Q3', status: 'In build' },
  { role: 'AI operations product', company: 'Research, evals, and launch system', score: '8 wk', status: 'Design' },
  { role: 'Executive command center', company: 'Analytics, roles, and secure reporting', score: 'Live', status: 'Scale' },
];

const phases = [
  { label: 'Understand', title: 'Map the real problem', copy: 'We clarify users, constraints, risk, and the business outcome before a line of code lands.' },
  { label: 'Build', title: 'Ship the smallest serious system', copy: 'Focused teams move through design, engineering, integration, and review in tight cycles.' },
  { label: 'Scale', title: 'Make it resilient', copy: 'We harden the product with monitoring, security, maintainability, and a path for the next release.' },
];

const audiences = [
  'Custom software for teams with complex operational workflows',
  'AI products that need trustworthy engineering foundations',
  'Modern platforms built for scale, security, and clarity',
];

const portfolio = [
  {
    client: 'Global logistics enterprise',
    title: 'Modernized a dispatch and visibility platform across distributed operations.',
    copy: 'A fractured set of regional tools became one operational system with shared workflows, cloud-native services, and role-based dashboards for leadership and field teams.',
    icon: <LanIcon />,
    stats: [
      { label: 'Scope', value: '42 markets' },
      { label: 'Result', value: '38% less manual coordination' },
      { label: 'Standard', value: '99.95% uptime target' },
    ],
  },
  {
    client: 'National healthcare network',
    title: 'Built a secure portal for sensitive operational coordination.',
    copy: 'We delivered an access-controlled workspace with audit trails, structured intake, reporting workflows, and a calmer interface for high-volume internal teams.',
    icon: <SecurityIcon />,
    stats: [
      { label: 'Scope', value: 'multi-site rollout' },
      { label: 'Result', value: 'faster case routing' },
      { label: 'Standard', value: 'compliance-ready controls' },
    ],
  },
  {
    client: 'Fortune-scale financial services team',
    title: 'Replaced spreadsheet risk operations with a governed review system.',
    copy: 'The platform connected intake, evidence, approvals, and executive reporting so decisions could move faster without losing traceability.',
    icon: <BusinessCenterIcon />,
    stats: [
      { label: 'Scope', value: 'risk operations' },
      { label: 'Result', value: '61% faster reviews' },
      { label: 'Standard', value: 'full audit history' },
    ],
  },
  {
    client: 'Industrial AI program',
    title: 'Launched an AI-assisted field service command center.',
    copy: 'We combined internal knowledge, service history, and human review loops into a production-ready assistant for complex field workflows.',
    icon: <CloudQueueIcon />,
    stats: [
      { label: 'Scope', value: 'MVP to production' },
      { label: 'Result', value: '10-week launch' },
      { label: 'Standard', value: 'evaluated AI outputs' },
    ],
  },
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
              Software engineering firm
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Button
            href="#capabilities"
            sx={{ color: 'rgba(255, 255, 255, 0.84)', fontWeight: 900, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Capabilities
          </Button>
          <Button
            href="#portfolio"
            sx={{ color: 'rgba(255, 255, 255, 0.84)', fontWeight: 900, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Portfolio
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
              label="Enterprise software engineering for serious operators"
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
                Engineering the systems that move serious companies forward.
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 20, md: 25 },
                  lineHeight: 1.55,
                  color: 'rgba(255, 255, 255, 0.84)',
                  maxWidth: 720,
                }}
              >
                We design and build intelligent products, resilient platforms, and operational
                software for teams that need senior judgment, clean execution, and durable systems.
              </Typography>
            </Stack>
            <Stack sx={heroActionsSx}>
              <Button href="#signin" variant="contained" size="large" startIcon={<LockIcon />}>
                Enter client portal
              </Button>
              <Button
                href="#portfolio"
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
                View selected work
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
                  <Typography fontWeight={950}>Enterprise programs</Typography>
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
                  <Typography fontWeight={950}>Engineering standard</Typography>
                </Stack>
                {['Architecture that can survive growth', 'Security and reliability built in', 'Delivery rituals clients can trust'].map((item) => (
                  <Stack key={item} direction="row" alignItems="center" spacing={1}>
                    <CheckCircleIcon sx={{ color: '#16A34A', fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      {item}
                    </Typography>
                  </Stack>
                ))}
                <Button href="#signin" variant="contained" size="small" sx={{ mt: 0.5 }}>
                  Open workspace
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
              Delivery model
            </Typography>
            <Typography variant="h3" fontWeight={950}>
              We build with urgency, but never at the expense of the foundation.
            </Typography>
            <Typography color="text.secondary">
              The best software feels inevitable after it ships. Getting there takes sharp product
              thinking, careful engineering, and a team that can carry ideas into production.
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

        <Box id="portfolio" sx={sectionSx}>
          <Box sx={sectionHeaderSx}>
            <Typography variant="overline" fontWeight={950} color="secondary.main">
              Selected portfolio
            </Typography>
            <Typography variant="h3" fontWeight={950}>
              Enterprise work for large clients, shown with the discretion serious work deserves.
            </Typography>
            <Typography color="text.secondary">
              Many engagements are confidential, so we present representative large-client work
              without naming protected brands. The pattern is consistent: complex operations,
              reliable software, measurable business movement.
            </Typography>
          </Box>
          <Box sx={portfolioGridSx}>
            {portfolio.map((item) => (
              <Paper key={item.client} variant="outlined" sx={portfolioCardSx}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box sx={featureIconSx}>{item.icon}</Box>
                    <Box minWidth={0}>
                      <Typography variant="overline" fontWeight={950} color="primary.main">
                        {item.client}
                      </Typography>
                      <Typography variant="h5" fontWeight={950}>
                        {item.title}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>
                    {item.copy}
                  </Typography>
                </Stack>
                <Box sx={portfolioMetaSx}>
                  {item.stats.map((stat) => (
                    <Box key={`${item.client}-${stat.label}`} sx={portfolioMetaItemSx}>
                      <Typography variant="caption" color="text.secondary" fontWeight={900}>
                        {stat.label}
                      </Typography>
                      <Typography fontWeight={950}>{stat.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>

        <Box id="capabilities" sx={sectionSx}>
          <Box sx={sectionHeaderSx}>
            <Typography variant="overline" fontWeight={950} color="secondary.main">
              Capabilities
            </Typography>
            <Typography variant="h3" fontWeight={950}>
              Senior engineering for systems that cannot be casual.
            </Typography>
            <Typography color="text.secondary">
              We combine product judgment with production engineering, so the result is not just
              impressive in a demo. It is useful, maintainable, and ready for real users.
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
              label="Client portal"
              sx={{ mb: 2, bgcolor: '#EEF2FF', color: '#3730A3' }}
            />
            <Typography variant="h3" fontWeight={950} gutterBottom>
              A private portal for high-trust delivery.
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.65 }}>
              Clients and team members can sign in to continue planning, delivery, reporting, and
              operations work in one secure workspace.
            </Typography>
          </Box>
          <SignInCard />
        </Box>
      </Box>
    </Box>
  );
}

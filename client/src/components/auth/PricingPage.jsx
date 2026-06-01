import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalculateIcon from '@mui/icons-material/Calculate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { Avatar, Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import SignInCard from './SignInCard.jsx';

const pricingPlans = [
  { name: 'Starter', price: 29, includedJobs: 250, overage: 0.07, note: 'Best for individual job searches' },
  { name: 'Pro', price: 79, includedJobs: 1500, overage: 0.06, note: 'Best for active application pipelines' },
  { name: 'Team', price: 249, includedJobs: 6000, overage: 0.04, note: 'Best for small teams and shared profiles' },
];

const pricingExamples = [100, 500, 1000, 5000, 10000].map(calculateBestPrice);

export default function PricingPage() {
  return (
    <Box sx={pageSx}>
      <Box component="header" sx={headerSx}>
        <Button href="/" startIcon={<ArrowBackIcon />} sx={{ color: '#DBEAFE', fontWeight: 900 }}>
          Back
        </Button>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Avatar
            src="/assets/applypilot-logo.png"
            alt="ApplyPilot logo"
            variant="rounded"
            sx={{ width: 40, height: 40, bgcolor: 'background.paper', boxShadow: 2 }}
          />
          <Box>
            <Typography fontWeight={950} lineHeight={1} color="#FFFFFF">
              ApplyPilot
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.72)' }}>
              Pricing
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box component="main" sx={mainSx}>
        <Box sx={heroSx}>
          <Stack spacing={2.5}>
            <Chip
              icon={<CalculateIcon />}
              label="Usage-based pricing"
              sx={{
                width: 'fit-content',
                bgcolor: 'rgba(255, 255, 255, 0.14)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.26)',
                '& .MuiChip-icon': { color: '#A7F3D0' },
              }}
            />
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 44, sm: 64, lg: 78 },
                lineHeight: 0.98,
                fontWeight: 950,
                color: '#FFFFFF',
                maxWidth: 820,
              }}
            >
              Simple pricing for a real application pipeline.
            </Typography>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.78)', fontSize: { xs: 18, md: 22 }, maxWidth: 720, lineHeight: 1.55 }}>
              Monthly cost combines simple platform access with per-job tailoring usage. Shared
              platform infrastructure is included in every plan.
            </Typography>
          </Stack>

          <Paper variant="outlined" sx={priceCardSx}>
            <Stack spacing={2.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ReceiptLongIcon color="primary" />
                <Typography fontWeight={950}>Pricing formula</Typography>
              </Stack>
              <Box>
                <Typography sx={{ fontSize: { xs: 38, md: 48 }, fontWeight: 950, lineHeight: 1 }}>
                  Starts at $29/mo
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Includes 250 tailored jobs, then $0.07 for each additional tailored job.
                </Typography>
              </Box>
              <Divider />
              <Stack spacing={1}>
                <LineItem label="Starter" value="$29/mo" />
                <LineItem label="Pro" value="$79/mo" />
                <LineItem label="Team" value="$249/mo" />
              </Stack>
              <Button href="#signin" variant="contained" size="large" startIcon={<LockIcon />}>
                Sign in to workspace
              </Button>
            </Stack>
          </Paper>
        </Box>

        <Box sx={planGridSx}>
          {pricingPlans.map((plan, index) => (
            <Paper key={plan.name} variant="outlined" sx={{ ...planCardSx, ...(index === 1 ? featuredPlanSx : {}) }}>
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography variant="h5" fontWeight={950}>
                      {plan.name}
                    </Typography>
                    {index === 1 ? <Chip label="Popular" color="secondary" /> : null}
                  </Stack>
                  <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                    {plan.note}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 42, lineHeight: 1, fontWeight: 950 }}>
                    {formatUsd(plan.price)}
                    <Typography component="span" color="text.secondary" fontWeight={800}>
                      /mo
                    </Typography>
                  </Typography>
                </Box>
                <Stack spacing={1}>
                  <LineItem label="Included tailored jobs" value={plan.includedJobs.toLocaleString()} />
                  <LineItem label="Additional jobs" value={`${formatUsd(plan.overage)}/job`} />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Box>

        <Paper variant="outlined" sx={calculatorSx}>
          <Stack spacing={2.25}>
            <Box>
              <Typography variant="overline" color="secondary.main" fontWeight={950}>
                Calculated examples
              </Typography>
              <Typography variant="h4" fontWeight={950}>
                What you pay at common monthly volumes
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                The table picks the cheapest matching plan and overage combination for each volume.
              </Typography>
            </Box>
            <Box sx={tableSx}>
              <Box sx={tableHeaderSx}>Tailored jobs</Box>
              <Box sx={tableHeaderSx}>Best plan</Box>
              <Box sx={tableHeaderSx}>Monthly total</Box>
              <Box sx={tableHeaderSx}>Effective cost/job</Box>
              {pricingExamples.map((row) => (
                <PricingRow key={row.jobs} row={row} />
              ))}
            </Box>
          </Stack>
        </Paper>

        <Box sx={detailGridSx}>
          <Paper variant="outlined" sx={detailCardSx}>
            <CheckCircleIcon sx={{ color: 'success.main' }} />
            <Typography fontWeight={950}>At 1,000 jobs/month</Typography>
            <Typography color="text.secondary">
              Pro is $79/month and includes 1,500 tailored jobs, so 1,000 jobs stays at $79/month.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={detailCardSx}>
            <CheckCircleIcon sx={{ color: 'success.main' }} />
            <Typography fontWeight={950}>At 10,000 jobs/month</Typography>
            <Typography color="text.secondary">
              Team plus overage is $409/month at 10,000 jobs, or about $0.04 effective cost per job.
            </Typography>
          </Paper>
        </Box>

        <Box id="signin" sx={signinSx}>
          <Box sx={{ maxWidth: 520 }}>
            <Typography variant="h3" fontWeight={950} gutterBottom>
              Ready to work from the numbers?
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.65 }}>
              Sign in to run tailoring, review bids, and keep the application pipeline moving.
            </Typography>
          </Box>
          <SignInCard />
        </Box>
      </Box>
    </Box>
  );
}

function LineItem({ label, value }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography fontWeight={950}>{value}</Typography>
    </Stack>
  );
}

function PricingRow({ row }) {
  return (
    <>
      <Box sx={tableCellSx}>{row.jobs.toLocaleString()}</Box>
      <Box sx={tableCellSx}>{row.plan.name}</Box>
      <Box sx={{ ...tableCellSx, fontWeight: 950, color: 'primary.dark' }}>{formatUsd(row.total)}</Box>
      <Box sx={tableCellSx}>{formatUsd(row.effective)}</Box>
    </>
  );
}

function calculateBestPrice(jobs) {
  const pricedPlans = pricingPlans.map((plan) => {
    const overageJobs = Math.max(0, jobs - plan.includedJobs);
    const total = plan.price + overageJobs * plan.overage;
    return {
      jobs,
      plan,
      overageJobs,
      total,
      effective: total / jobs,
    };
  });
  return pricedPlans.sort((a, b) => a.total - b.total)[0];
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: value < 1 ? 2 : 2,
  }).format(value);
}

const pageSx = {
  minHeight: '100vh',
  color: 'text.primary',
  bgcolor: '#F8FAFC',
  background:
    'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 64, 175, 0.9) 34%, #F8FAFC 34%, #F8FAFC 100%)',
};

const headerSx = {
  width: 'min(1180px, calc(100% - 32px))',
  mx: 'auto',
  minHeight: 78,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 2,
};

const mainSx = {
  width: 'min(1180px, calc(100% - 32px))',
  mx: 'auto',
  pb: 7,
};

const heroSx = {
  minHeight: { xs: 'auto', md: 520 },
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(360px, 460px)' },
  gap: { xs: 3, md: 5 },
  alignItems: 'center',
  py: { xs: 5, md: 7 },
};

const priceCardSx = {
  p: { xs: 2.25, md: 3 },
  borderRadius: 1.5,
  borderColor: 'rgba(255, 255, 255, 0.34)',
  bgcolor: 'rgba(255, 255, 255, 0.94)',
  boxShadow: '0 30px 90px rgba(0, 0, 0, 0.26)',
};

const calculatorSx = {
  p: { xs: 2, md: 3 },
  borderRadius: 1.5,
  borderColor: '#D7E3F8',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.09)',
};

const planGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
  gap: 1.5,
  mb: 1.5,
};

const planCardSx = {
  p: { xs: 2.25, md: 2.5 },
  borderRadius: 1.5,
  borderColor: '#D7E3F8',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
};

const featuredPlanSx = {
  borderColor: '#2563EB',
  boxShadow: '0 24px 70px rgba(37, 99, 235, 0.18)',
};

const tableSx = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
  border: '1px solid #E2E8F0',
  borderRadius: 1,
  overflow: 'hidden',
};

const tableHeaderSx = {
  display: { xs: 'none', md: 'block' },
  p: 1.5,
  bgcolor: '#F1F5F9',
  color: '#475569',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
  borderBottom: '1px solid #E2E8F0',
};

const tableCellSx = {
  p: 1.5,
  borderBottom: '1px solid #E2E8F0',
  minWidth: 0,
};

const detailGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.5,
  mt: 1.5,
};

const detailCardSx = {
  p: 2.25,
  borderRadius: 1,
  borderColor: '#D7E3F8',
  display: 'grid',
  gap: 1,
};

const signinSx = {
  mt: { xs: 4, md: 6 },
  p: { xs: 2, md: 4 },
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(360px, 440px)' },
  gap: { xs: 3, md: 5 },
  alignItems: 'center',
  borderRadius: 1.5,
  bgcolor: '#FFFFFF',
  border: '1px solid #D7E3F8',
  boxShadow: '0 24px 70px rgba(15, 23, 42, 0.1)',
};

const imageOverlay =
  'linear-gradient(90deg, rgba(5, 10, 20, 0.86) 0%, rgba(9, 18, 32, 0.72) 42%, rgba(13, 24, 42, 0.42) 100%)';
const heroImage =
  'image-set(url("/assets/landing-workspace.webp") type("image/webp"), url("/assets/landing-workspace.jpg") type("image/jpeg"))';

export const authPageSx = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  p: 3,
  background:
    'radial-gradient(circle at 12% 8%, rgba(37, 99, 235, 0.13), transparent 24rem), radial-gradient(circle at 88% 12%, rgba(15, 118, 110, 0.12), transparent 24rem), #F8FAFC',
};

export const landingPageSx = {
  minHeight: '100vh',
  bgcolor: '#F8FAFC',
  color: 'text.primary',
  position: 'relative',
  overflowX: 'hidden',
};

export const heroBackdropSx = {
  position: 'absolute',
  inset: '0 0 auto 0',
  height: { xs: 860, md: 920 },
  backgroundImage: `${imageOverlay}, ${heroImage}`,
  backgroundSize: 'cover',
  backgroundPosition: { xs: '58% center', md: 'center' },
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 0) 72%, #F8FAFC 100%)',
  },
};

export const topbarSx = {
  width: 'min(1240px, calc(100% - 32px))',
  mx: 'auto',
  mt: 1.5,
  minHeight: 64,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 2,
  px: { xs: 1.25, sm: 1.5 },
  py: 1,
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 1.5,
  bgcolor: 'rgba(15, 23, 42, 0.58)',
  boxShadow: '0 18px 50px rgba(0, 0, 0, 0.22)',
  backdropFilter: 'blur(20px)',
  position: 'relative',
  zIndex: 2,
};

export const heroSx = {
  width: 'min(1240px, calc(100% - 32px))',
  mx: 'auto',
  minHeight: { xs: 760, md: 'calc(100vh - 78px)' },
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.95fr) minmax(420px, 0.78fr)' },
  gap: { xs: 4, lg: 6 },
  alignItems: 'center',
  pt: { xs: 5, md: 7 },
  pb: { xs: 7, md: 9 },
  position: 'relative',
  zIndex: 1,
};

export const heroContentSx = {
  minWidth: 0,
  display: 'grid',
  gap: { xs: 3, md: 4 },
};

export const heroActionsSx = {
  flexDirection: { xs: 'column', sm: 'row' },
  gap: 1.25,
  alignItems: { xs: 'stretch', sm: 'center' },
};

export const metricStripSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
  gap: 1,
  maxWidth: 760,
};

export const metricItemSx = {
  border: 1,
  borderColor: 'rgba(255, 255, 255, 0.24)',
  borderRadius: 1,
  bgcolor: 'rgba(255, 255, 255, 0.12)',
  p: 1.5,
  color: '#FFFFFF',
  backdropFilter: 'blur(16px)',
  '& .MuiTypography-root:last-child': {
    color: 'rgba(255, 255, 255, 0.72)',
  },
};

export const heroDashboardSx = {
  alignSelf: 'center',
  p: { xs: 1.25, sm: 1.5 },
  borderRadius: 1.5,
  borderColor: 'rgba(255, 255, 255, 0.28)',
  bgcolor: 'rgba(255, 255, 255, 0.86)',
  boxShadow: '0 34px 100px rgba(0, 0, 0, 0.36)',
  backdropFilter: 'blur(22px)',
  transform: { lg: 'translateY(32px)' },
};

export const dashboardHeaderSx = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  px: 1,
};

export const commandCenterSx = {
  display: 'grid',
  gap: 1.25,
};

export const dashboardCardSx = {
  border: 1,
  borderColor: '#DBEAFE',
  borderRadius: 1,
  bgcolor: '#FFFFFF',
  p: 1.5,
  display: 'grid',
  gap: 1.25,
};

export const dashboardListItemSx = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 1.5,
  p: 1.25,
  borderRadius: 1,
  bgcolor: '#F8FAFC',
  border: '1px solid #E2E8F0',
};

export const audienceBandSx = {
  width: 'min(1240px, calc(100% - 32px))',
  mx: 'auto',
  mt: { xs: -3, md: -5 },
  mb: { xs: 3, md: 4 },
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
  gap: 1,
  position: 'relative',
  zIndex: 1,
};

export const audienceCardSx = {
  minHeight: 74,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 2,
  py: 1.5,
  borderRadius: 1,
  bgcolor: '#0F172A',
  color: '#FFFFFF',
  boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
};

export const sectionSx = {
  width: 'min(1180px, calc(100% - 32px))',
  mx: 'auto',
  py: { xs: 5.5, md: 8 },
};

export const sectionHeaderSx = {
  display: 'grid',
  gap: 1,
  maxWidth: 780,
  mb: 3,
};

export const phaseGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
  gap: 1.5,
};

export const phaseCardSx = {
  minHeight: 220,
  p: 2.5,
  borderRadius: 1,
  borderColor: '#C7D2FE',
  bgcolor: '#FFFFFF',
  display: 'grid',
  alignContent: 'space-between',
  gap: 2,
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
};

export const featureGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
  gap: 1.5,
};

export const featureCardSx = {
  p: 2.25,
  borderRadius: 1,
  borderColor: '#D7E3F8',
  bgcolor: 'rgba(255, 255, 255, 0.9)',
  display: 'grid',
  gap: 1.25,
  boxShadow: '0 14px 36px rgba(15, 23, 42, 0.06)',
};

export const featureIconSx = {
  width: 42,
  height: 42,
  borderRadius: 1,
  display: 'grid',
  placeItems: 'center',
  bgcolor: '#EEF2FF',
  color: 'primary.main',
};

export const portfolioGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.5,
};

export const portfolioCardSx = {
  minHeight: 300,
  p: { xs: 2.25, md: 2.75 },
  borderRadius: 1,
  borderColor: '#CBD5E1',
  bgcolor: '#FFFFFF',
  display: 'grid',
  gap: 2,
  alignContent: 'space-between',
  boxShadow: '0 18px 54px rgba(15, 23, 42, 0.08)',
};

export const portfolioMetaSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
  gap: 1,
};

export const portfolioMetaItemSx = {
  p: 1.25,
  borderRadius: 1,
  border: '1px solid #E2E8F0',
  bgcolor: '#F8FAFC',
  minWidth: 0,
};

export const signinBandSx = {
  width: 'min(1180px, calc(100% - 32px))',
  mx: 'auto',
  my: { xs: 4, md: 7 },
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

export const signinCardSx = {
  p: { xs: 2.25, sm: 3 },
  width: '100%',
  boxShadow: 'none',
  borderColor: '#D7E3F8',
  backdropFilter: 'blur(18px)',
  bgcolor: 'rgba(255, 255, 255, 0.95)',
};

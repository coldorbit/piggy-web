const imageOverlay =
  'linear-gradient(90deg, rgba(12, 24, 39, 0.78) 0%, rgba(24, 48, 76, 0.58) 46%, rgba(243, 246, 250, 0.18) 100%)';
const heroImage =
  'image-set(url("/assets/landing-workspace.webp") type("image/webp"), url("/assets/landing-workspace.jpg") type("image/jpeg"))';

export const authPageSx = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  p: 3,
  background:
    'linear-gradient(145deg, rgba(255,255,255,0.88), rgba(244,247,251,0.78) 46%, rgba(235,241,248,0.9)), #F3F3F3',
};

export const landingPageSx = {
  minHeight: '100vh',
  bgcolor: '#F3F3F3',
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
      'linear-gradient(180deg, rgba(243, 243, 243, 0) 0%, rgba(243, 243, 243, 0) 72%, #F3F3F3 100%)',
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
  border: '1px solid rgba(255, 255, 255, 0.34)',
  borderRadius: 1.5,
  bgcolor: 'rgba(26, 34, 44, 0.48)',
  boxShadow: '0 18px 50px rgba(0, 0, 0, 0.18)',
  backdropFilter: 'blur(26px) saturate(1.25)',
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
  bgcolor: 'rgba(255, 255, 255, 0.16)',
  p: 1.5,
  color: '#FFFFFF',
  backdropFilter: 'blur(22px) saturate(1.2)',
  '& .MuiTypography-root:last-child': {
    color: 'rgba(255, 255, 255, 0.72)',
  },
};

export const heroDashboardSx = {
  alignSelf: 'center',
  p: { xs: 1.25, sm: 1.5 },
  borderRadius: 1.5,
  borderColor: 'rgba(255, 255, 255, 0.48)',
  bgcolor: 'rgba(255, 255, 255, 0.72)',
  boxShadow: '0 34px 90px rgba(0, 0, 0, 0.24)',
  backdropFilter: 'blur(30px) saturate(1.32)',
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
  borderColor: 'rgba(0, 0, 0, 0.08)',
  borderRadius: 1,
  bgcolor: 'rgba(255,255,255,0.82)',
  p: 1.5,
  display: 'grid',
  gap: 1.25,
  boxShadow: '0 1px 0 rgba(255,255,255,0.75) inset',
};

export const dashboardListItemSx = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 1.5,
  p: 1.25,
  borderRadius: 1,
  bgcolor: 'rgba(246, 248, 251, 0.84)',
  border: '1px solid rgba(0, 0, 0, 0.08)',
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
  bgcolor: 'rgba(27, 27, 27, 0.92)',
  color: '#FFFFFF',
  boxShadow: '0 18px 48px rgba(0, 0, 0, 0.16)',
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
  borderColor: 'rgba(0, 103, 192, 0.18)',
  bgcolor: 'rgba(255, 255, 255, 0.84)',
  display: 'grid',
  alignContent: 'space-between',
  gap: 2,
  boxShadow: '0 18px 50px rgba(0, 0, 0, 0.07)',
  backdropFilter: 'blur(22px) saturate(1.2)',
};

export const featureGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
  gap: 1.5,
};

export const featureCardSx = {
  p: 2.25,
  borderRadius: 1,
  borderColor: 'rgba(0, 0, 0, 0.08)',
  bgcolor: 'rgba(255, 255, 255, 0.82)',
  display: 'grid',
  gap: 1.25,
  boxShadow: '0 14px 36px rgba(0, 0, 0, 0.06)',
  backdropFilter: 'blur(22px) saturate(1.2)',
};

export const featureIconSx = {
  width: 42,
  height: 42,
  borderRadius: 1,
  display: 'grid',
  placeItems: 'center',
  bgcolor: 'rgba(0, 103, 192, 0.1)',
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
  borderColor: 'rgba(0, 0, 0, 0.09)',
  bgcolor: 'rgba(255, 255, 255, 0.84)',
  display: 'grid',
  gap: 2,
  alignContent: 'space-between',
  boxShadow: '0 18px 54px rgba(0, 0, 0, 0.07)',
  backdropFilter: 'blur(22px) saturate(1.2)',
};

export const portfolioMetaSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
  gap: 1,
};

export const portfolioMetaItemSx = {
  p: 1.25,
  borderRadius: 1,
  border: '1px solid rgba(0, 0, 0, 0.08)',
  bgcolor: 'rgba(246, 248, 251, 0.82)',
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
  bgcolor: 'rgba(255, 255, 255, 0.82)',
  border: '1px solid rgba(0, 103, 192, 0.16)',
  boxShadow: '0 24px 70px rgba(0, 0, 0, 0.09)',
  backdropFilter: 'blur(24px) saturate(1.22)',
};

export const signinCardSx = {
  p: { xs: 2.25, sm: 3 },
  width: '100%',
  boxShadow: 'none',
  borderColor: 'rgba(0, 0, 0, 0.08)',
  backdropFilter: 'blur(24px) saturate(1.22)',
  bgcolor: 'rgba(255, 255, 255, 0.82)',
};

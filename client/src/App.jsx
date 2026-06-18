import { Suspense, useEffect, useRef } from 'react';
import { useFeatureIsOn, useGrowthBook } from '@growthbook/growthbook-react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthenticatedRoutes, PublicRoutes } from './app/AppRoutes.jsx';
import { ShellLoading } from './components/AuthScreens.jsx';
import { useMe, useUpdateMe } from './lib/authApi.js';
import { FEATURE_FLAGS, hasGrowthBookConfig, isLocalMaintenanceModeEnabled } from './lib/featureFlags.js';
import { DEFAULT_TIME_ZONE, FALLBACK_TIME_ZONE } from './lib/timezone.js';
import MaintenancePage from './pages/MaintenancePage.jsx';

export default function App() {
  if (isLocalMaintenanceModeEnabled()) return <MaintenanceRedirect />;
  if (hasGrowthBookConfig()) {
    return <GrowthBookMaintenanceGate />;
  }

  return <WorkspaceApp />;
}

function GrowthBookMaintenanceGate() {
  const growthbook = useGrowthBook();
  const maintenanceModeEnabled = useFeatureIsOn(FEATURE_FLAGS.maintenanceMode.key);
  if (!growthbook.ready || maintenanceModeEnabled || isLocalMaintenanceModeEnabled()) return <MaintenanceRedirect />;

  return <WorkspaceApp />;
}

function MaintenanceRedirect() {
  const location = useLocation();

  if (location.pathname === '/maintenance') return <MaintenancePage />;
  return <Navigate to="/maintenance" replace />;
}

function WorkspaceApp() {
  const { data: user, isLoading: authChecked } = useMe();
  const { mutate: updateMe } = useUpdateMe();
  const timezoneSyncAttempted = useRef(false);

  useEffect(() => {
    const isFallbackTimezone = !user?.timezone || user.timezone === FALLBACK_TIME_ZONE;
    if (!user?.id || !isFallbackTimezone || user.timezone === DEFAULT_TIME_ZONE || timezoneSyncAttempted.current) return;

    timezoneSyncAttempted.current = true;
    updateMe({ timezone: DEFAULT_TIME_ZONE });
  }, [updateMe, user?.id, user?.timezone]);

  if (authChecked) return <ShellLoading />;

  return (
    <Suspense fallback={<ShellLoading />}>
      {user ? <AuthenticatedRoutes user={user} /> : <PublicRoutes />}
    </Suspense>
  );
}

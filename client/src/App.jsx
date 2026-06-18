import { Suspense, useEffect, useRef } from 'react';
import { FeaturesReady, useFeatureIsOn } from '@growthbook/growthbook-react';
import { AuthenticatedRoutes, PublicRoutes } from './app/AppRoutes.jsx';
import { ShellLoading } from './components/AuthScreens.jsx';
import { useMe, useUpdateMe } from './lib/authApi.js';
import { FEATURE_FLAGS, hasGrowthBookConfig, isLocalMaintenanceModeEnabled } from './lib/featureFlags.js';
import { DEFAULT_TIME_ZONE, FALLBACK_TIME_ZONE } from './lib/timezone.js';
import MaintenancePage from './pages/MaintenancePage.jsx';

export default function App() {
  if (isLocalMaintenanceModeEnabled()) return <MaintenancePage />;
  if (hasGrowthBookConfig()) {
    return (
      <FeaturesReady fallback={<MaintenancePage />}>
        <GrowthBookMaintenanceGate />
      </FeaturesReady>
    );
  }

  return <WorkspaceApp />;
}

function GrowthBookMaintenanceGate() {
  const maintenanceModeEnabled = useFeatureIsOn(FEATURE_FLAGS.maintenanceMode.key);
  if (maintenanceModeEnabled || isLocalMaintenanceModeEnabled()) return <MaintenancePage />;

  return <WorkspaceApp />;
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

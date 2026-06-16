import { Suspense, useEffect, useRef } from 'react';
import { AuthenticatedRoutes, PublicRoutes } from './app/AppRoutes.jsx';
import { ShellLoading } from './components/AuthScreens.jsx';
import { useMe, useUpdateMe } from './lib/authApi.js';
import { DEFAULT_TIME_ZONE, FALLBACK_TIME_ZONE } from './lib/timezone.js';

export default function App() {
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

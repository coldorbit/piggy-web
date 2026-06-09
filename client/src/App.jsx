import { Suspense } from 'react';
import { AuthenticatedRoutes, PublicRoutes } from './app/AppRoutes.jsx';
import { ShellLoading } from './components/AuthScreens.jsx';
import { useMe } from './lib/authApi.js';

export default function App() {
  const { data: user, isLoading: authChecked } = useMe();

  if (authChecked) return <ShellLoading />;

  return (
    <Suspense fallback={<ShellLoading />}>
      {user ? <AuthenticatedRoutes user={user} /> : <PublicRoutes />}
    </Suspense>
  );
}

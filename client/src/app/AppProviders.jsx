import { useEffect, useMemo } from 'react';
import { GrowthBook, GrowthBookProvider } from '@growthbook/growthbook-react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { getGrowthBookConfig, getGrowthBookInitOptions } from '../lib/featureFlags.js';
import { queryClient } from './queryClient.js';
import { theme } from './theme.js';
import PerformanceMonitor from './PerformanceMonitor.jsx';

export default function AppProviders({ children }) {
  const growthBookConfig = useMemo(() => getGrowthBookConfig(), []);
  const growthbook = useMemo(() => (growthBookConfig ? new GrowthBook(growthBookConfig) : null), [growthBookConfig]);

  useEffect(() => {
    if (!growthbook) return undefined;

    growthbook.init(getGrowthBookInitOptions()).catch((error) => {
      console.error('Failed to load GrowthBook feature flags.', error);
    });
    return () => growthbook.destroy();
  }, [growthbook]);

  const app = growthbook ? <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider> : children;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <PerformanceMonitor />
          {app}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

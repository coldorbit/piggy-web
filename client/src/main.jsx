import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB',
      light: '#60A5FA',
      dark: '#1E40AF',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0F766E',
      dark: '#115E59',
    },
    success: {
      main: '#16A34A',
    },
    warning: {
      main: '#D97706',
    },
    error: {
      main: '#DC2626',
    },
    background: {
      default: '#F8FAFC',
      paper: '#ffffff',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
  },
  shadows: [
    'none',
    '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
    '0 4px 12px rgba(15, 23, 42, 0.07)',
    '0 8px 22px rgba(15, 23, 42, 0.08)',
    '0 12px 30px rgba(15, 23, 42, 0.09)',
    ...Array(20).fill('0 18px 42px rgba(15, 23, 42, 0.1)'),
  ],
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      letterSpacing: 0,
    },
    h5: {
      letterSpacing: 0,
    },
    button: {
      fontWeight: 800,
      letterSpacing: 0,
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            'radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 26rem), radial-gradient(circle at 90% 12%, rgba(15, 118, 110, 0.08), transparent 24rem), #F8FAFC',
        },
        '*': {
          boxSizing: 'border-box',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderColor: '#E2E8F0',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderColor: '#E2E8F0',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 36,
          borderRadius: 8,
        },
        contained: {
          boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 800,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: '#64748B',
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
        },
      },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    },
  },
});

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>,
);

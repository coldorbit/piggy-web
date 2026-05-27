import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#5f5bd8',
      light: '#8b88f2',
      dark: '#37328f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0f9f9a',
      dark: '#08716f',
    },
    success: {
      main: '#15855f',
    },
    warning: {
      main: '#b86d1f',
    },
    error: {
      main: '#b84c5a',
    },
    background: {
      default: '#f6f4fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#23223a',
      secondary: '#68657f',
    },
    divider: 'rgba(35, 34, 58, 0.11)',
  },
  shadows: [
    'none',
    '0 1px 2px rgba(42, 38, 76, 0.06), 0 1px 3px rgba(42, 38, 76, 0.08)',
    '0 4px 12px rgba(42, 38, 76, 0.08)',
    '0 8px 22px rgba(42, 38, 76, 0.09)',
    '0 12px 30px rgba(42, 38, 76, 0.1)',
    ...Array(20).fill('0 18px 42px rgba(42, 38, 76, 0.12)'),
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
            'radial-gradient(circle at top left, rgba(95, 91, 216, 0.16), transparent 28rem), radial-gradient(circle at 90% 15%, rgba(15, 159, 154, 0.12), transparent 22rem), #f6f4fb',
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
          borderColor: 'rgba(35, 34, 58, 0.11)',
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
          borderColor: 'rgba(35, 34, 58, 0.11)',
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
          boxShadow: '0 8px 18px rgba(95, 91, 216, 0.24)',
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
          color: '#68657f',
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

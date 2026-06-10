import { createTheme } from '@mui/material';

export const theme = createTheme({
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
    fontSize: 13,
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.8125rem',
    },
    caption: {
      fontSize: '0.71875rem',
    },
    h4: {
      fontSize: '1.625rem',
      letterSpacing: 0,
    },
    h5: {
      fontSize: '1.25rem',
      letterSpacing: 0,
    },
    h6: {
      fontSize: '1rem',
      letterSpacing: 0,
    },
    button: {
      fontWeight: 800,
      letterSpacing: 0,
      fontSize: '0.78125rem',
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontSize: 13,
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
        size: 'small',
      },
      styleOverrides: {
        root: {
          minHeight: 30,
          borderRadius: 8,
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 10,
          paddingRight: 10,
        },
        contained: {
          boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: 5,
        },
      },
    },
    MuiChip: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          height: 22,
          fontSize: 11,
          fontWeight: 800,
        },
        label: {
          paddingLeft: 8,
          paddingRight: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
    MuiFormControl: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiMenuItem: {
      defaultProps: {
        dense: true,
      },
      styleOverrides: {
        root: {
          fontSize: 13,
          minHeight: 32,
        },
      },
    },
    MuiListItemButton: {
      defaultProps: {
        dense: true,
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: 13,
        },
        input: {
          paddingTop: 7,
          paddingBottom: 7,
        },
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
        root: {
          fontSize: 13,
          padding: '7px 10px',
        },
        head: {
          color: '#64748B',
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          fontSize: 13,
        },
        toolbar: {
          minHeight: 44,
        },
        selectLabel: {
          fontSize: 13,
        },
        displayedRows: {
          fontSize: 13,
        },
      },
    },
  },
});

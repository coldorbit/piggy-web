import { createTheme } from '@mui/material';

const windowsBlue = '#0067C0';
const windowsBlueDark = '#004E8C';
const appSurfaceStrong = 'rgba(255, 255, 255, 0.92)';
const appLine = 'rgba(0, 0, 0, 0.11)';
const appLineSoft = 'rgba(0, 0, 0, 0.07)';
const micaBackground =
  'linear-gradient(145deg, rgba(255,255,255,0.84) 0%, rgba(247,249,253,0.72) 42%, rgba(239,244,250,0.86) 100%), #F3F3F3';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: windowsBlue,
      light: '#4CC2FF',
      dark: windowsBlueDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#486860',
      dark: '#324B45',
    },
    success: {
      main: '#0E7A3E',
    },
    warning: {
      main: '#C77700',
    },
    error: {
      main: '#C42B1C',
    },
    background: {
      default: '#F3F3F3',
      paper: '#ffffff',
    },
    text: {
      primary: '#1B1B1B',
      secondary: '#5F5F5F',
    },
    divider: appLine,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 1px rgba(255, 255, 255, 0.66) inset',
    '0 4px 12px rgba(0, 0, 0, 0.08)',
    '0 8px 22px rgba(0, 0, 0, 0.09)',
    '0 14px 34px rgba(0, 0, 0, 0.1)',
    ...Array(20).fill('0 22px 52px rgba(0, 0, 0, 0.12)'),
  ],
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      '"Segoe UI Variable Text", "Segoe UI", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
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
        ':root': {
          colorScheme: 'light',
        },
        html: {
          minHeight: '100%',
          background: '#F3F3F3',
        },
        body: {
          fontSize: 13,
          background: micaBackground,
          backgroundAttachment: 'fixed',
          color: '#1B1B1B',
        },
        '*': {
          boxSizing: 'border-box',
        },
        '*::selection': {
          backgroundColor: 'rgba(0, 103, 192, 0.24)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderColor: appLineSoft,
          backgroundColor: appSurfaceStrong,
          backdropFilter: 'blur(22px) saturate(1.25)',
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
          borderColor: appLineSoft,
          backgroundColor: appSurfaceStrong,
          backdropFilter: 'blur(22px) saturate(1.25)',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: appSurfaceStrong,
          borderColor: appLineSoft,
          '&:before': {
            display: 'none',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(28px) saturate(1.35)',
          borderColor: appLineSoft,
          color: '#1B1B1B',
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
          transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
          '&:active': {
            transform: 'scale(0.985)',
          },
        },
        contained: {
          background: 'linear-gradient(180deg, #0078D4 0%, #0067C0 100%)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.32) inset, 0 8px 18px rgba(0, 103, 192, 0.22)',
          '&:hover': {
            background: 'linear-gradient(180deg, #1083D8 0%, #005EA8 100%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.32) inset, 0 10px 22px rgba(0, 103, 192, 0.25)',
          },
        },
        outlined: {
          backgroundColor: 'rgba(255,255,255,0.62)',
          borderColor: appLine,
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.88)',
            borderColor: 'rgba(0, 103, 192, 0.36)',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(0, 103, 192, 0.08)',
          },
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
          transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 103, 192, 0.08)',
          },
          '&:active': {
            transform: 'scale(0.96)',
          },
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
          fontWeight: 700,
          borderRadius: 999,
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
    MuiDialogContent: {
      styleOverrides: {
        root: {
          marginTop: 8,
          '& .MuiTextField-root, & .MuiFormControl-root': {
            overflow: 'visible',
          },
        },
      },
    },
    MuiFormControl: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          backgroundColor: 'rgba(255,255,255,0.86)',
          paddingLeft: 4,
          paddingRight: 4,
          maxWidth: 'calc(100% - 20px)',
        },
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
          borderRadius: 6,
          marginLeft: 4,
          marginRight: 4,
          '&.Mui-selected': {
            backgroundColor: 'rgba(0, 103, 192, 0.12)',
          },
          '&.Mui-selected:hover': {
            backgroundColor: 'rgba(0, 103, 192, 0.18)',
          },
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
          backgroundColor: 'rgba(255,255,255,0.72)',
          borderRadius: 8,
          transition: 'background-color 120ms ease, box-shadow 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.9)',
          },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
            boxShadow: '0 0 0 3px rgba(0, 103, 192, 0.14)',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: appLine,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 103, 192, 0.44)',
          },
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
          color: '#616161',
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: appSurfaceStrong,
          backdropFilter: 'blur(22px) saturate(1.25)',
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
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
          backgroundColor: windowsBlue,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 38,
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 8,
          '&.Mui-selected': {
            color: windowsBlueDark,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: `1px solid ${appLineSoft}`,
          borderRadius: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(30px) saturate(1.3)',
          boxShadow: '0 32px 84px rgba(0, 0, 0, 0.22)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(26px) saturate(1.25)',
          border: `1px solid ${appLineSoft}`,
          boxShadow: '0 18px 46px rgba(0, 0, 0, 0.16)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          paddingTop: 4,
          paddingBottom: 4,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(32, 32, 32, 0.94)',
          fontSize: 12,
          borderRadius: 6,
        },
      },
    },
  },
});

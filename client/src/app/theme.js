import { createTheme } from '@mui/material';

const windowsBlue = '#0067C0';
const windowsBlueHover = '#005FB8';
const windowsBluePressed = '#005A9E';
const windowsBlueDark = '#004E8C';
const appSurfaceStrong = 'rgba(255, 255, 255, 0.92)';
const appLine = 'rgba(0, 0, 0, 0.11)';
const appLineSoft = 'rgba(0, 0, 0, 0.07)';
const controlRadius = 4;
const layerRadius = 8;
const pillRadius = 999;
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
    borderRadius: controlRadius,
  },
  typography: {
    fontFamily:
      '"Segoe UI Variable Text", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 14,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    body1: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.43,
    },
    body2: {
      fontSize: '0.8125rem',
      fontWeight: 400,
      lineHeight: 1.38,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.33,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: 0,
      lineHeight: 1.33,
      textTransform: 'none',
    },
    h3: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.15,
      letterSpacing: 0,
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: 0,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.28,
      letterSpacing: 0,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: 0,
    },
    subtitle1: {
      fontSize: '0.9375rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: 0,
    },
    button: {
      fontWeight: 600,
      letterSpacing: 0,
      fontSize: '0.875rem',
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
          fontSize: 14,
          background: micaBackground,
          backgroundAttachment: 'fixed',
          color: '#1B1B1B',
          fontFamily:
            '"Segoe UI Variable Text", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 400,
          lineHeight: 1.43,
        },
        '*': {
          boxSizing: 'border-box',
          scrollbarColor: 'rgba(96, 96, 96, 0.54) transparent',
          scrollbarWidth: 'thin',
        },
        '*::-webkit-scrollbar': {
          width: 12,
          height: 12,
        },
        '*::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(96, 96, 96, 0.48)',
          border: '3px solid transparent',
          borderRadius: controlRadius,
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 'rgba(96, 96, 96, 0.68)',
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
          borderRadius: layerRadius,
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
          borderRadius: layerRadius,
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
          borderRadius: layerRadius,
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
          minHeight: 32,
          borderRadius: controlRadius,
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 10,
          paddingRight: 10,
          transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
          '&:active': {
            transform: 'scale(0.985)',
          },
          '&.Mui-focusVisible': {
            outline: `2px solid ${windowsBlue}`,
            outlineOffset: 2,
          },
          '&.MuiButton-containedPrimary': {
            backgroundColor: windowsBlue,
            backgroundImage: 'none',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            color: '#FFFFFF',
            boxShadow: '0 1px 0 rgba(255,255,255,0.24) inset, 0 2px 4px rgba(0, 0, 0, 0.12)',
            '&:hover': {
              backgroundColor: windowsBlueHover,
              backgroundImage: 'none',
              boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 5px rgba(0, 0, 0, 0.14)',
            },
            '&:active': {
              backgroundColor: windowsBluePressed,
              backgroundImage: 'none',
            },
          },
        },
        contained: {
          boxShadow: '0 1px 0 rgba(255,255,255,0.24) inset, 0 2px 4px rgba(0, 0, 0, 0.12)',
          '&:hover': {
            boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 5px rgba(0, 0, 0, 0.14)',
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
          width: 32,
          height: 32,
          borderRadius: controlRadius,
          padding: 5,
          transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 103, 192, 0.08)',
          },
          '&:active': {
            transform: 'scale(0.96)',
          },
          '&.Mui-focusVisible': {
            outline: `2px solid ${windowsBlue}`,
            outlineOffset: 2,
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
          fontSize: 12,
          fontWeight: 600,
          borderRadius: pillRadius,
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
          fontSize: 14,
          minHeight: 32,
          borderRadius: controlRadius,
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
          fontSize: 14,
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
          borderRadius: controlRadius,
          minHeight: 32,
          transition: 'background-color 120ms ease, box-shadow 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.9)',
          },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
            boxShadow: '0 0 0 3px rgba(0, 103, 192, 0.14)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: windowsBlue,
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
          fontSize: 14,
          padding: '7px 10px',
        },
        head: {
          color: '#616161',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'none',
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
          fontSize: 14,
        },
        toolbar: {
          minHeight: 44,
        },
        selectLabel: {
          fontSize: 14,
        },
        displayedRows: {
          fontSize: 14,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: controlRadius,
        },
        bar: {
          borderRadius: controlRadius,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: layerRadius,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: pillRadius,
          backgroundColor: windowsBlue,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 38,
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: controlRadius,
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
          borderRadius: layerRadius,
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
          borderRadius: layerRadius,
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
          borderRadius: controlRadius,
        },
      },
    },
  },
});

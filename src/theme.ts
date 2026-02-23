export type Theme = {
  colors: {
    bgBase: string;
    bgSurface: string;
    sceneBackground: string;
    borderDefault: string;
    textPrimary: string;
    textSecondary: string;
    accentPrimary: string;
    statusSuccess: string;
    statusWarning: string;
    statusError: string;
    fileCode: string;
    fileImage: string;
    fileDocument: string;
    fileArchive: string;
    fileUnknown: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
};

export const theme: Theme = {
  colors: {
    bgBase: '#F7F5F2',
    bgSurface: '#FFFFFF',
    sceneBackground: '#F0ECE6',
    borderDefault: '#E8E4DF',
    textPrimary: '#2D2B2A',
    textSecondary: '#6B6661',
    accentPrimary: '#D46B4E',
    statusSuccess: '#6B8E67',
    statusWarning: '#C98A4B',
    statusError: '#C94A46',
    fileCode: '#5C7C8A', // Muted teal/blue
    fileImage: '#A87C9F', // Muted purple/mauve
    fileDocument: '#D4A373', // Muted tan/orange
    fileArchive: '#8A7E72', // Muted brown/gray
    fileUnknown: '#9E9E9E', // Neutral gray
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(45, 43, 42, 0.05)',
    md: '0 4px 6px -1px rgba(45, 43, 42, 0.1), 0 2px 4px -1px rgba(45, 43, 42, 0.06)',
    lg: '0 10px 15px -3px rgba(45, 43, 42, 0.1), 0 4px 6px -2px rgba(45, 43, 42, 0.05)',
  },
  fonts: {
    sans: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
};

export function injectThemeVariables() {
  const root = document.documentElement;

  // Inject colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    root.style.setProperty(`--color-${kebabKey}`, value);
  });

  // Inject shadows
  Object.entries(theme.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });

  // Inject fonts
  Object.entries(theme.fonts).forEach(([key, value]) => {
    root.style.setProperty(`--font-${key}`, value);
  });
}

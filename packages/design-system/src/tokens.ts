export const lightTokens = {
  "--paper": "#FBFAF6",
  "--paper-2": "#F4F1E9",
  "--paper-3": "#ECE8DD",
  "--ink": "#1B1A16",
  "--ink-2": "#423F38",
  "--muted": "#756F62",
  "--faint": "#A39C8C",
  "--rule": "#E2DDD0",
  "--rule-strong": "#D2CBB9",
  "--accent": "#4D6BFE",
  "--accent-hover": "#3A57E0",
  "--accent-soft": "#E7EBFF",
  "--rust": "#9A4A22",
  "--rust-soft": "#F1E5DC",
  "--success": "#297A4A",
  "--success-soft": "#E2F0E7",
  "--warning": "#9A6A13",
  "--warning-soft": "#F5EDD8",
} as const;

export const darkTokens = {
  "--paper": "#14130F",
  "--paper-2": "#1C1B16",
  "--paper-3": "#25231C",
  "--ink": "#EFEBDF",
  "--ink-2": "#C7C2B4",
  "--muted": "#948E7F",
  "--faint": "#6B665A",
  "--rule": "#2B281F",
  "--rule-strong": "#3A372C",
  "--accent": "#93A6FF",
  "--accent-hover": "#7A90FF",
  "--accent-soft": "#1C2444",
  "--rust": "#D08A5E",
  "--rust-soft": "#2B2017",
  "--success": "#5CB87A",
  "--success-soft": "#1A2B20",
  "--warning": "#D4A44C",
  "--warning-soft": "#2B2417",
} as const;

export const methodColors = {
  GET: "var(--accent)",
  POST: "var(--success)",
  PUT: "var(--warning)",
  PATCH: "var(--warning)",
  DELETE: "var(--rust)",
  HEAD: "var(--muted)",
  OPTIONS: "var(--muted)",
} as const;

export const fontFamilies = {
  ui: 'Inter, "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif',
  mono: 'JetBrains Mono, "Cascadia Code", "SFMono-Regular", monospace',
} as const;

export const fontSizes = {
  pageTitle: "24px",
  sectionTitle: "16px",
  body: "14px",
  table: "13px",
  techLabel: "11px",
} as const;

export const radii = {
  small: "4px",
  medium: "6px",
  large: "8px",
} as const;

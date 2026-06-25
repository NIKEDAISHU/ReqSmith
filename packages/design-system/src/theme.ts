/* Tokens are now defined in the renderer's styles.css using :root / [data-theme].
   This module only re-exports the theme-mode helper for programmatic switching. */

export type ThemeMode = "light" | "dark";

export function applyTheme(root: HTMLElement, mode: ThemeMode) {
  root.dataset.theme = mode;
}

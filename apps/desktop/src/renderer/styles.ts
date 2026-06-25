import type { CSSProperties } from "react";

/** Style map for components that need inline styles.
 *  Token values are pulled from CSS custom properties via `var()`. */
export const s = {
  /* ── Top nav ── */
  nav: {
    height: "var(--nav-h)",
    borderBottom: "1px solid var(--rule)",
    background: "var(--paper)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: "28px",
    position: "sticky",
    top: 0,
    zIndex: 50,
  } satisfies CSSProperties,

  navInner: {
    display: "flex",
    alignItems: "center",
    gap: "22px",
    maxWidth: "var(--maxw)",
    width: "100%",
    margin: "0 auto",
  } satisfies CSSProperties,

  logo: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    letterSpacing: "-0.03em",
    fontWeight: 600,
    color: "var(--ink)",
    textDecoration: "none",
  } satisfies CSSProperties,

  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  } satisfies CSSProperties,

  navLink: {
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    letterSpacing: "-0.01em",
    fontWeight: 400,
    color: "var(--muted)",
    background: "transparent",
    border: "none",
    borderRadius: "var(--r-pill)",
    padding: "7px 13px",
    cursor: "pointer",
    textDecoration: "none",
    transition: "all 0.15s",
  } satisfies CSSProperties,

  navLinkActive: {
    color: "var(--ink)",
    background: "var(--paper-3)",
  } satisfies CSSProperties,

  /* ── Main content ── */
  main: {
    maxWidth: "var(--maxw)",
    margin: "0 auto",
    paddingInline: "28px",
    paddingTop: "64px",
    paddingBottom: "80px",
    height: "calc(100vh - var(--nav-h))",
    overflowY: "auto",
  } satisfies CSSProperties,

  /* ── Page titles ── */
  pageTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(38px, 5vw, 62px)",
    fontWeight: 600,
    letterSpacing: "-0.03em",
    margin: 0,
    lineHeight: 1.1,
  } satisfies CSSProperties,

  pageSubtitle: {
    fontFamily: "var(--font-read)",
    fontSize: "18px",
    color: "var(--ink-2)",
    lineHeight: 1.65,
    maxWidth: "52ch",
    marginTop: "24px",
  } satisfies CSSProperties,

  /* ── Search bar ── */
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "30px",
    padding: "14px 18px",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--rule-strong)",
    background: "var(--paper-2)",
  } satisfies CSSProperties,

  /* ── Project list (row-based like Yopedia wiki list) ── */
  projectRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "22px",
    alignItems: "baseline",
    padding: "22px 0",
    borderTop: "1px solid var(--rule)",
    textDecoration: "none",
    color: "var(--ink)",
    cursor: "pointer",
    transition: "background 0.15s",
  } satisfies CSSProperties,

  projectTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,

  projectMeta: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "6px",
  } satisfies CSSProperties,

  /* ── Browse layout (sidebar rail + content) ── */
  browseLayout: {
    display: "grid",
    gridTemplateColumns: "210px 1fr",
    gap: "52px",
    alignItems: "start",
    marginTop: "36px",
  } satisfies CSSProperties,

  rail: {
    display: "flex",
    flexDirection: "column",
    gap: "26px",
    position: "sticky",
    top: "calc(var(--nav-h) + 88px)",
  } satisfies CSSProperties,

  /* ── Form ── */
  formRow: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  } satisfies CSSProperties,

  label: {
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--ink-2)",
  } satisfies CSSProperties,

  formInput: {
    fontFamily: "var(--font-read)",
    fontSize: "16px",
    padding: "10px 14px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--rule-strong)",
    background: "var(--paper-2)",
    color: "var(--ink)",
    outline: "none",
    width: "100%",
  } satisfies CSSProperties,

  formSelect: {
    fontFamily: "var(--font-read)",
    fontSize: "16px",
    padding: "10px 14px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--rule-strong)",
    background: "var(--paper-2)",
    color: "var(--ink)",
    outline: "none",
    width: "100%",
    appearance: "none" as const,
  } satisfies CSSProperties,

  actionBar: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "8px",
  } satisfies CSSProperties,

  /* ── Empty state ── */
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "50vh",
    gap: "16px",
    color: "var(--muted)",
    textAlign: "center" as const,
  } satisfies CSSProperties,

  emptyTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "20px",
    fontWeight: 500,
    color: "var(--ink-2)",
  } satisfies CSSProperties,
} as const;

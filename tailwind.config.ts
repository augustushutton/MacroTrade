import type { Config } from "tailwindcss";

// Colours resolve through CSS custom properties (see :root / .dark in
// globals.css), so the whole app repaints from one place. `lib` is scanned
// alongside `app`/`components` because lib/format.ts's signColor() returns
// class-name strings ("text-up", "text-down") that Tailwind needs to see in
// source to include in the build.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    // Replaces the default scale rather than extending it, so `rounded`,
    // `rounded-sm`, etc. don't compile — no rounded corners anywhere.
    borderRadius: { none: "0" },
    extend: {
      // Two named sub-4px steps for dense, tabular UI. Both used to be typed
      // as raw `py-[3px]` / `py-[1px]` arbitrary values, independently, in
      // five-plus different files — the same magic number copy-pasted
      // instead of declared once. `dense` is the standard vertical rhythm
      // for table rows and control chrome (Th/Td/Btn/GroupHeader); `hair`
      // is the tighter step used only for input chrome that sits inside a
      // dense row and can't afford dense's own padding on top of it.
      spacing: {
        dense: "3px",
        hair: "1px",
      },
      colors: {
        term: {
          bg: "rgb(var(--term-bg) / <alpha-value>)",
          panel: "rgb(var(--term-panel) / <alpha-value>)",
          raised: "rgb(var(--term-raised) / <alpha-value>)",
          zebra: "rgb(var(--term-zebra) / <alpha-value>)",
          input: "rgb(var(--term-input) / <alpha-value>)",
          line: "rgb(var(--term-line) / <alpha-value>)",
          edge: "rgb(var(--term-edge) / <alpha-value>)",
          muted: "rgb(var(--term-muted) / <alpha-value>)",
          sub: "rgb(var(--term-sub) / <alpha-value>)",
          text: "rgb(var(--term-text) / <alpha-value>)",
        },
        // Colour is reserved for direction (up/down) and status (warn/info) —
        // no per-instrument colours, so a label is never mistaken for a signal.
        up: "rgb(var(--up) / <alpha-value>)",
        down: "rgb(var(--down) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
      },
      fontSize: {
        // Fixed px, not em, so a column header renders the same size in every
        // panel regardless of that panel's base font size.
        th: "10px",
        sub: "0.85em",
      },
      fontFamily: {
        // System stacks only — no self-hosted webfonts. Segoe UI leads on
        // Windows (the common enterprise-desktop baseline); the platform
        // defaults cover macOS/Linux.
        sans: [
          "Segoe UI",
          "-apple-system",
          "BlinkMacSystemFont",
          "ui-sans-serif",
          "system-ui",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // SF Pro for every numeric figure in the app — all tabular data runs
        // through .tnum + font-mono. SF Pro's licence restricts it to
        // software running on Apple platforms, so it cannot be self-hosted
        // as a webfont the way Geist Mono was; `-apple-system` /
        // `BlinkMacSystemFont` instead pull the OS's own copy on macOS/iOS,
        // which renders true SF Pro with no font file shipped. Other
        // platforms fall through to their own system UI font (Segoe UI on
        // Windows, Roboto on ChromeOS/Android, the distro default on Linux)
        // — there is no SF Pro to fall back to off Apple hardware. `.tnum`
        // (font-feature-settings: "tnum") keeps digits column-aligned even
        // though every font in this stack is proportional, not monospace —
        // the same technique Apple's own Stocks app uses.
        mono: [
          "-apple-system",
          "BlinkMacSystemFont",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;

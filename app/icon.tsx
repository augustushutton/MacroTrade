import { ImageResponse } from "next/og";

// Browser-tab icon. Same mark and colour as the header wordmark
// (MacroTradeLogo in TopNav.tsx) so the tab and the app agree with each
// other, generated at request time rather than committed as a binary asset.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Kept identical to MacroTradeLogo's DARK_GREEN by hand, since this route
// can't import a client component's constant (ImageResponse runs in its own
// isolated renderer) — same reasoning as the shared coordinates below: one
// value, copied deliberately in the one place it can't be shared by import.
const DARK_GREEN = "#006400";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Same viewBox and same rect/path coordinates as MacroTradeLogo in
            TopNav.tsx, at a different pixel size — a previous version nested
            a 22px svg inside a 30px badge div, which shrank the glyph
            relative to the badge a second time and made this route visibly
            smaller-glyph than the on-page mark. Drawing both the badge and
            the glyph in one svg, from the same coordinates, keeps them
            identical by construction rather than by matching two numbers by
            hand. Hard corners (no rx) and an open M-only path (no closing
            baseline) — see MacroTradeLogo's comment for why. */}
        <svg width="30" height="30" viewBox="0 0 28 28">
          <rect x="1" y="1" width="26" height="26" fill="#121418" stroke={DARK_GREEN} strokeWidth="1.5" />
          <path
            d="M6.5 20.5 L10.5 8.5 L14 15 L17.5 7.5 L21.5 20.5"
            fill="none"
            stroke={DARK_GREEN}
            strokeWidth="3.2"
            strokeLinejoin="miter"
            strokeMiterlimit="4"
            strokeLinecap="square"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}

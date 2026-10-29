import { LandingHeader, SectionBanner } from "./LandingChrome";

// The public front page — "/" — separate from the scenario tool itself
// (which lives under /builder, /pnl, /sensitivity, /derivation, /trading,
// /execution; see app/(tool)/layout.tsx). A plain Server Component: unlike
// the tool's own pages, this one has no scenario state, no interactivity at
// all — six static preview images and some copy — so it needs no "use
// client" and ships no extra client JS.
//
// This is now one of four front-page routes (Home / Variables / Assets / Metrics —
// see components/LandingChrome.tsx) sharing the same header and folder-tab
// strip, added on request ("We should expand the front page... implement a
// page explaining what's behind each variable, asset... and explain what
// each chart graph table or correlation or trading index actually works").
// This file keeps exactly the content it had before that split (the
// Windows-98-era header, six-tile screenshot column, red section banners) —
// LandingChrome.tsx now owns the header/tagline/tab markup that used to live
// inline here, and SectionBanner moved there too so Reference/Metrics can
// reuse the identical divider instead of a second copy of it.
//
// This ports a page that existed only as a separate claude.ai-hosted
// artifact (linked from TopNav's logo as a stand-in "homepage" before this
// component existed — see TopNav.tsx's own comment) into the actual
// codebase as a real route, so it's versioned, type-checked, and tested
// alongside everything else instead of living somewhere this repo has no
// record of. The design — the Windows-98-era title bar, the six-tile
// screenshot column, the red section banners, the three content sections —
// is copied from that artifact as approved, not reinvented. One thing did
// change in the port: the six preview tiles were static, individually
// hand-captured screenshots embedded as base64 data URIs (~900KB of inline
// image data in the page source). Here they're real files under public/,
// captured fresh via Playwright against this app's own Stagflation preset
// (same "real output, not invented figures" convention the rest of this
// app's preview/example content already follows) — see the tools used to
// generate preview-*.png for the exact capture. They can be refreshed the
// same way any time the tool's own UI changes enough to make them stale,
// without hand-editing a giant data URI.
//
// The body copy below (What MacroTrade Has / How To Use It / Q&A) is
// supplied text, not derived from the live app — reconciled against it where
// it matters. "46 input variables" is the actual count of VARIABLES in
// lib/vars.ts: six visible 7-variable groups plus the 4-variable Yield
// Curve group VarForm.tsx excludes from display — see that file's own
// comment.
//
// The "Launch Site" button and every in-page reference to a tool tab now
// point at the real in-app routes (/builder, etc.) instead of the
// artifact's external placeholder domain, since those routes actually exist
// in this codebase now.
//
// Section banners use `bg-down` (the same red reserved elsewhere in this
// app for a negative P&L figure) as a plain decorative section divider, not
// a data value — a one-off exception to this app's own "colour means
// direction/status, never decoration" rule (see tailwind.config.ts), kept
// because it's part of the specific approved design this page ports rather
// than an original choice made here.
//
// WHAT_IT_HAS/HOW_TO_USE/FAQ below carry a full rewrite the user supplied
// (handed back as an edited copy of the Word doc exported from this same
// content — see components/ReferenceGuide.tsx/MetricsGuide.tsx for the
// matching rewrite of their own copy). On request ("check spelling, but
// leave punctuations and formatting be from what they were prior"), this is
// a spelling-only pass over that text: the user's own wording, phrasing, and
// punctuation choices are kept exactly as given (including a consistent
// switch from British to American spelling — Labour→Labor, modelled→modeled,
// realised→realized — which is a deliberate, consistent choice throughout
// their rewrite, not a typo, so it's kept rather than reverted); the only
// two changes made are genuine word-level errors: "Let's you change" →
// "Lets you change" (wrong word, not a contraction of "let us") in
// MetricsGuide.tsx's Inflation Assumption entry, and "less-riskier" →
// "less risky" (a redundant double comparative) in ReferenceGuide.tsx's HY
// BB OAS entry. Everything else — including some looser grammar ("most
// alike to the S&P 500", "This is for each allocation modeled and it
// combines...") — is left exactly as supplied, per that instruction.
const SHOTS: { label: string; src: string }[] = [
  { label: "Builder", src: "/preview-builder.png" },
  { label: "P&L", src: "/preview-pnl.png" },
  { label: "Sensitivity", src: "/preview-sensitivity.png" },
  { label: "Execution", src: "/preview-execution.png" },
  { label: "Asset Detail", src: "/preview-asset-detail.png" },
  { label: "Derivation", src: "/preview-derivation.png" },
];

const WHAT_IT_HAS: React.ReactNode[] = [
  "MacroTrade is an economic modeling website for traders, investors, and researchers.",
  <>
    You can set policy rates, inflation, growth, credit, and FX inputs manually. This platform has{" "}
    <b>46 input variables</b> in six primary categories: Monetary Policy, Inflation and Expectations, Growth and
    Labor, Financial Conditions, FX and External, and Fiscal and Structural.
  </>,
  "Every input on this website is connected through relationships that macro variables have shown across decades.",
  "The delivery of the event and scenario can be immediate or phased over 3 months to 2 years. The structure of the scenario that you set is modeled specifically through five different paths: Immediate, Linear, S-Curve, Mean Reverting, or Staged.",
  "This platform also has a set of built in scenarios covering growth, inflation, credit and liquidity, policy, and external shocks, so you can start planning from a pre-built scenario instead of tweaking every detail to match something akin to a real economic event.",
  "Scenarios can be saved, reset, and reloaded at any time.",
  "It is important to note that this is not a forecast. It shows what could realistically occur from a scenario you define but is not a complete prediction of what will happen.",
  "MacroTrade is free to use and does not require any account or login.",
];

const HOW_TO_USE: { term: string; rest: string }[] = [
  { term: "Builder.", rest: " Change every macro input directly, by category, and set the delivery timeline and the structure by what you think will happen." },
  { term: "P&L.", rest: " See the scenario's effect on P&L and across your allocations and specific asset classes." },
  { term: "Sensitivity.", rest: " See which inputs and variables drive the main scenario outcome and compare them directly." },
  { term: "Derivation.", rest: " See the factors behind every currency, asset, commodity, and other variables and how each part affects its price movement." },
  { term: "Trading.", rest: " Price a trade against the current scenario before you are in it, and see how your trading style or trading ideas would affect your profit." },
  { term: "Execution.", rest: " Review every filled order in one place, with fill price, slippage, and commission tracked for each one in order to realistically adjust for brokerage trading." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "What is MacroTrade?", a: "MacroTrade is a scenario modeling software for global macro trading." },
  {
    q: "Is this a forecast?",
    a: "It is very important to be aware that this is not a 100% accurate predictor of what will actually occur. It shows what could follow from a scenario you define and is not a prediction of what will happen.",
  },
  {
    q: "How does it turn inputs into an outcome?",
    a: "The main model behind this software is built on how macro variables have historically moved together; specifically, it uses various econometric tests to verify the statistical accuracy of these relationships and also accounts for correlations in order to provide our users a more accurate experience. It mixes both textbook formulas, correlations, and models along with our custom-built formulas to effectively model each scenario.",
  },
  {
    q: "Do I need an account?",
    a: "MacroTrade is free to use; as every investor or trader deserves a free tool to help trade, research, and invest in a growing volatile macroeconomic world.",
  },
  {
    q: "Can I save a scenario?",
    a: "Save your current scenario from the Builder page and load it again any time and set a custom name! But the scenarios are only saved locally on your browser and device.",
  },
  {
    q: "Who is this built for?",
    a: "Traders, investors, and researchers. Or curious users who want to learn global macroeconomic investing hands-on.",
  },
];

export default function Landing() {
  return (
    <div className="min-w-[1280px] border border-term-edge bg-term-bg">
      <LandingHeader active="home" />

      {/* ============ body ============ */}
      <div className="grid grid-cols-[1fr_340px]">
        <div className="px-6 py-5">
          <div className="mb-6">
            <SectionBanner>What MacroTrade Has</SectionBanner>
            <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-term-sub marker:text-term-edge">
              {WHAT_IT_HAS.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mb-6">
            <SectionBanner>How To Use It</SectionBanner>
            <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-term-sub marker:text-term-edge">
              {HOW_TO_USE.map((step) => (
                <li key={step.term}>
                  <b className="text-term-text">{step.term}</b>
                  {step.rest}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionBanner>Questions And Answers</SectionBanner>
            <div className="grid gap-x-10">
              {FAQ.map((item) => (
                <div key={item.q} className="mb-4">
                  <div className="text-[14px] font-bold text-term-text">{item.q}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-term-sub">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* flex column stretched by the grid row to the content column's
            height (CSS Grid's default align-items: stretch), then divided
            into six EQUAL tiles via flex-1 — not six tiles each sized by
            its own screenshot's native aspect ratio, which is what the
            first version of this port did. The six source screenshots
            span wildly different native aspect ratios (~2.3:1 for Builder
            up to ~10:1 for P&L, since each tab's own table is a different
            shape), so letting each <img> set its own height produced six
            tiles of wildly different heights and text scale — exactly the
            "not aligned" look that was wrong. object-cover + object-top
            crops each screenshot (anchored to its top edge, where the
            data is) to fill its equal-height box instead, matching the
            original artifact's `.shot`/`.shot-img` rule
            (height: calc((100% - 70px) / 6); object-fit: cover). */}
        <div className="flex h-full flex-col gap-3.5 border-l border-term-edge p-4">
          {SHOTS.map((s) => (
            <div key={s.label} className="flex min-h-0 flex-1 flex-col overflow-hidden border border-term-edge bg-term-panel">
              <div className="shrink-0 border-b border-term-edge bg-term-raised px-2 py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-white">{s.label}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed
                  small preview tiles; next/image's extra runtime machinery
                  buys nothing here that a plain <img> doesn't already do. */}
              <img
                src={s.src}
                alt={`${s.label} preview`}
                className="block w-full min-h-0 flex-1 object-cover object-top"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

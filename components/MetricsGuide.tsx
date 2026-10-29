import { LandingHeader, SectionBanner } from "./LandingChrome";

// Last of the four front-page routes — "/metrics" — added on request
// ("explain what each chart graph table or correlation or trading index
// actually works"). Same plain Server Component shape as Landing.tsx and
// ReferenceGuide.tsx.
//
// This is the per-panel companion to Home's own "How To Use It" section:
// that section explains each TAB in one sentence apiece (Builder, P&L, ...),
// this one goes one level deeper, naming every actual panel/table/chart
// inside each tab and saying what it shows — cross-checked against each
// tab's own Panel titles in components/*.tsx (PnlTab, SensitivityTab,
// RiskTab, NarrativeTab, TradingTab, ExecutionTab) so the names here match
// what's actually on screen rather than a paraphrase of it. Plain
// descriptions only (on request: no abundance of numbers or advanced
// metrics) — what each thing shows and why it's useful, not the formula
// behind it.
//
// The entries below carry the user's own full rewrite of this copy (the
// same rewrite applied to Landing.tsx/ReferenceGuide.tsx — see those files'
// own comments for the full provenance). On request ("check spelling, but
// leave punctuations and formatting be from what they were prior"), this is
// a spelling-only pass: wording, phrasing, and punctuation are kept exactly
// as supplied, except two literal word-level fixes: "Let's you change" →
// "Lets you change" in Inflation Assumption (wrong word, not a contraction
// of "let us"), and "modelled" → "modeled" in Asset Correlation. That second
// one is specifically per the user's own explicit follow-up instruction to
// "change it to non-British styling" — the same instruction that also
// renamed the Builder's "Growth & Labour" input-group label (lib/vars.ts,
// VAR_GROUPS) and the "Labour Recession" preset (lib/scenarios.ts) to
// "Growth & Labor" / "Labor Recession", so the Variable Groups entry below
// now matches what's actually on screen in the Builder tab.
//
// On request ("combine derivation trading and execution into one read tab
// so it isn't so red and overwhelming" — too many back-to-back red
// SectionBanners down this page), Derivation/Trading/Execution now share
// one combined banner at the bottom instead of three separate ones, taking
// this page from seven banners down to five. Presentation-only: each tab's
// own panel entries are unchanged, just grouped under one banner instead of
// three (components/VariableReference.tsx got the matching treatment for
// Financial Conditions + FX, on the same request).
//
// The page's own intro paragraph (above the Builder banner) was removed on
// request ("Remove these") — the nav tab ("METRICS") and each SectionBanner
// already say what's below, so the explanatory sentence was redundant.
type Entry = { term: string; rest: string };

function EntryList({ items }: { items: Entry[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-term-sub marker:text-term-edge">
      {items.map((e) => (
        <li key={e.term}>
          <b className="text-term-text">{e.term}</b>
          {e.rest}
        </li>
      ))}
    </ul>
  );
}

const BUILDER: Entry[] = [
  { term: "Variable Groups.", rest: " The six visible categories of macro inputs (Monetary Policy, Inflation & Expectations, Growth & Labor, Financial Conditions, FX & External, Fiscal & Structural). You can directly customize the exact number or use the + and – buttons to decrease at a linear rate." },
  { term: "Preset Library.", rest: " A set of pre-built scenarios containing policy shocks, inflation shocks, growth shocks, credit events, external shocks, and yield curve shapes." },
  { term: "My Scenarios.", rest: " Your own saved combinations of custom inputs, named and stored locally in your browser so you can reload or compare them later." },
  { term: "Delivery Path.", rest: " Controls how the scenario plays out over time: all at once (Immediate), smoothly (Linear), exponentially at first then flattening out (S-Curve), overshooting then falling back (Mean Reverting), or in discrete jumps (Staged). This is then set over a horizon anywhere from 3 months to 2 years." },
];

const PNL: Entry[] = [
  { term: "Portfolio Impact Summary.", rest: " The scenario's total return for each of the typical four model allocations including: 80/20, 60/40, 40/60, and 20/80 equity-to-bond splits. This is so you can see at a glance how portfolio mix changes the outcome and what kind of portfolio would benefit or hurt the most in your respective scenario." },
  { term: "Asset Detail.", rest: " Every priced instrument's own price change under the scenario. They are separated out by Bonds, Equities, Commodities, and FX, weighted by how much of the selected allocation it actually represents." },
  { term: "Factor Attribution.", rest: " For one chosen asset, how much of its total move came from each underlying macro driver, which allows you to see which input created the most change." },
];

const SENSITIVITY: Entry[] = [
  { term: "Two-Variable Surface.", rest: " This area shows how a chosen outcome changes as you vary two inputs at the same time, so you can see where a particular combination of the two is most or least beneficial." },
  { term: "Leave-One-Out Attribution.", rest: " Reruns the scenario with one input at a time switched back to its baseline value, to show how much of the total move that single input alone was responsible for." },
  { term: "Timeline Returns.", rest: " The scenario's return at each step along the delivery path, from the first step out to an even longer timeline." },
  { term: "Inflation Assumption.", rest: " Lets you change the preset inflation figure used by the Real Return box below, without changing the scenario's own inputs." },
  { term: "Real Return (Inflation-Adjusted).", rest: " The same timeline, restated after subtracting assumed inflation, so you can see the return in today's purchasing power rather than with nominal metrics." },
];

const RISK: Entry[] = [
  { term: "Asset Risk Ranking.", rest: " Every priced instrument, ranked by how much it tends to move across the full set of macro shocks. They are split into a High Risk and a Low-Risk group." },
  { term: "Asset Correlation.", rest: " How closely two instruments' modeled prices tend to move together, estimated from their shared sensitivity to the same macro drivers rather than from historical price history." },
  { term: "Exposure.", rest: " This is for each allocation modeled and it combines sensitivity to interest rates, credit spreads, currencies, and equities overall to show what the portfolio is mostly exposed to." },
];

const DERIVATION: Entry[] = [
  { term: "Factor Breakdown.", rest: " This is for every instrument type and shows exactly which macro inputs moved its price and by how much." },
];

const TRADING: Entry[] = [
  { term: "Order Ticket.", rest: " This area allows you to price a hypothetical trade in Shares, Bonds, or Currency against the current scenario before you place it, including the bid/ask spread, size-scaled market impact, and commission to easily simulate hypothetical trades during your scenario." },
];

const EXECUTION: Entry[] = [
  { term: "Execution Summary.", rest: " A summary of every filled order including the total notional traded and realized P&L and time." },
  { term: "Order Book.", rest: " Every individual filled order, with its fill price, slippage against the quoted price, and commission." },
];

// Derivation, Trading, and Execution render under one combined banner below
// — see this file's header comment for why (on request: "combine
// derivation trading and execution into one read tab so it isn't so red and
// overwhelming"). Kept as three separate arrays rather than merged into
// one, since DERIVATION/TRADING/EXECUTION still map 1:1 onto those three
// tool tabs' own panels — only the on-page presentation is combined.
const DERIVATION_TRADING_EXECUTION: Entry[] = [...DERIVATION, ...TRADING, ...EXECUTION];

export default function MetricsGuide() {
  return (
    <div className="min-w-[1280px] border border-term-edge bg-term-bg">
      <LandingHeader active="metrics" />

      <div className="px-6 py-5">
        <div className="mb-6">
          <SectionBanner>Builder</SectionBanner>
          <EntryList items={BUILDER} />
        </div>

        <div className="mb-6">
          <SectionBanner>P&amp;L</SectionBanner>
          <EntryList items={PNL} />
        </div>

        <div className="mb-6">
          <SectionBanner>Sensitivity</SectionBanner>
          <EntryList items={SENSITIVITY} />
        </div>

        <div className="mb-6">
          <SectionBanner>Risk</SectionBanner>
          <EntryList items={RISK} />
        </div>

        <div>
          <SectionBanner>Derivation, Trading &amp; Execution</SectionBanner>
          <EntryList items={DERIVATION_TRADING_EXECUTION} />
        </div>
      </div>
    </div>
  );
}

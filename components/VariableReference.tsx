import { LandingHeader, SectionBanner } from "./LandingChrome";

// One of the four front-page routes — "/variables" — same plain Server
// Component shape as Landing.tsx: no scenario state, static copy only, so
// no "use client" here either.
//
// This used to be the top half of a single combined "/reference" route
// (Variables stacked above an Assets section on one page — see
// components/AssetReference.tsx for the other half, and LandingChrome.tsx's
// own comment for why they're now split). On request ("Do variable
// reference and asset references and separate them"), Variables now has its
// own tab/route rather than sharing one with Assets.
//
// Splitting also dropped the old two-tier SectionBanner-then-SubHeading
// structure (one banner for "Variables" as a whole, a lighter SubHeading
// per category underneath it) in favor of one SectionBanner per category —
// Monetary Policy, Inflation & Expectations, etc. — same flat pattern
// MetricsGuide.tsx already uses for its own per-tab groups, now that the
// page's own nav tab ("VARIABLES") already says what the whole page is, so
// a second, page-level "Variables" banner was redundant.
//
// Every variable named below is a real id from lib/vars.ts (cross-checked
// against it while writing this, the same "reconciled against the live
// app" rule Landing.tsx's own comment follows for its copy) — this just
// explains in plain English what each one represents in the real world, not
// the coefficients or formulas behind it (on request: "Don't use an
// abundance of numbers or advanced metrics, just simple descriptions").
// Grouped exactly the way the live app groups them — VAR_GROUPS (VarForm's
// six categories, plus the Yield Curve group it keeps off-screen — see
// lib/vars.ts's own comment on why) — so this page reads as a key to the
// Builder's own layout rather than a reshuffled list.
//
// The copy itself is the user's own full rewrite (see Landing.tsx's comment
// for the fuller provenance of that rewrite and the spelling-only pass
// applied to it) — unchanged by this split, just moved into its own file.
// "Growth & Labor" below matches lib/vars.ts's VAR_GROUPS label and
// lib/scenarios.ts's "Labor Recession" preset (both renamed from the
// British "Labour" on request, "change it to non-British styling").
//
// On request ("combine financial conditions and fx into the same tab...
// remove the external part" — too many back-to-back red SectionBanners
// reading as "red and overwhelming"), Financial Conditions and FX
// ("FX & External" trimmed to just "FX") now share one combined banner
// instead of two, taking this page from seven banners down to six. This is
// a presentation-only merge: lib/vars.ts's own VAR_GROUPS still keeps
// "financial" and "fx" as two separate groups (that's the Builder's actual
// input layout, a bigger change than this page's copy, and wasn't asked
// for) — only how this guide groups them visually changed.
//
// The page's own intro paragraph (above the Monetary Policy banner) was
// removed on request ("Remove these") — the nav tab ("VARIABLES") and each
// SectionBanner already say what's below, so the explanatory sentence was
// redundant.
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

const MONETARY: Entry[] = [
  { term: "Fed Funds Target.", rest: " The Federal Reserve's own policy rate; also known as the base short-term interest rate for the US dollar." },
  { term: "ECB Deposit Rate.", rest: " The European Central Bank's policy rate which plays the same role as Fed Funds Target but for the euro." },
  { term: "BoJ Policy Rate.", rest: " The Bank of Japan's policy rate which has held near zero for most of the last three decades." },
  { term: "BoE Bank Rate.", rest: " The Bank of England's policy rate." },
  { term: "Fed Balance Sheet.", rest: " The size of the Federal Reserve's bond holdings as a share of GDP. A bigger balance sheet means more stimulus is still waiting in the financial system from open-market operations." },
  { term: "Forward Guidance.", rest: " How hawkish or dovish the Federal Reserve is signaling about the path of future rate moves, separate from where the rate actually sits today; it is also a widely disputed monetary tool, and its effectiveness is still largely controversial." },
  { term: "QT Pace.", rest: " How fast the Federal Reserve is shrinking its balance sheet each month by letting bonds mature (quantitative tightening). A negative value means the Fed is growing it instead and actively injecting liquidity, which is also known as quantitative easing." },
];

const INFLATION: Entry[] = [
  { term: "Headline CPI YoY.", rest: " Total consumer price inflation over the last year, including food and energy." },
  { term: "Core CPI YoY.", rest: " Consumer price inflation excluding food and energy which is often what the Federal Reserve monitors." },
  { term: "Core PCE YoY.", rest: " The Federal Reserve's own preferred inflation metric and includes personal consumption expenditures, excluding food and energy." },
  { term: "5y Breakeven.", rest: " What the bond market is pricing in for average inflation over the next five years." },
  { term: "10y Breakeven.", rest: " The same fixed income implied inflation expectation but within a 10-year timeframe." },
  { term: "Wage Growth YoY.", rest: " How fast average wages are rising." },
  { term: "10y Real Rate.", rest: " The 10-year Treasury yield after subtracting expected inflation which ultimately is an indicator of the \"true,\" inflation-adjusted cost of long-term borrowing." },
];

const GROWTH: Entry[] = [
  { term: "Real GDP QoQ SAAR.", rest: " The economy's growth rate for the quarter, annualized." },
  { term: "ISM Manufacturing.", rest: " A monthly survey of factory activity. Above 50 means the sector is expanding, below 50 means it's decreasing." },
  { term: "ISM Services.", rest: " The same kind of survey as for ISM manufacturing but for services." },
  { term: "Unemployment Rate.", rest: " The share of the labor force without a job and actively looking for one." },
  { term: "Participation Rate.", rest: " The percent of the working-age population that is either employed or looking for work." },
  { term: "Regional Fed Composite.", rest: " A reading of the regional Federal Reserve banks' own manufacturing surveys." },
  { term: "Fwd. Earnings Growth.", rest: " Wall Street analysts' forward-looking estimate for S&P 500 earnings growth over the next year." },
];

const FINANCIAL: Entry[] = [
  { term: "IG Corporate OAS.", rest: " The extra yield investment-grade corporate bonds pay over Treasuries of the same maturity. Wider means more credit stress and increases default risk." },
  { term: "HY BB OAS.", rest: " The same kind of spread, for BB-rated high-yield (\"junk\") bonds. This is still a less risky area of high-yield fixed income." },
  { term: "HY B/CCC OAS.", rest: " The same kind of credit spread but for the riskiest B- and CCC-rated bonds, which move the most in a credit shortage." },
  { term: "S&P Forward P/E.", rest: " The S&P 500's price divided by next year's expected earnings. This is commonly used as an example on how expensive the market is relative to what it's forecast to earn." },
  { term: "S&P Trailing P/E.", rest: " The same ratio, using the last twelve months of actual earnings instead of a forecast." },
  { term: "Revision Breadth.", rest: " The net share of analysts raising versus cutting their earnings estimates across the market." },
  { term: "VIX.", rest: " The options market's implied volatility for the S&P 500 over the next 30 days. Often, implied volatility is over-estimated in proportion to the actual reported volatility." },
];

const FX_VARS: Entry[] = [
  { term: "USD/CAD, EUR/USD, USD/JPY, USD/CNY, GBP/USD, USD/MXN, USD/CHF.", rest: " Each is a currency pair's exchange rate against the US dollar." },
];

// Financial Conditions and FX render under one combined banner below — see
// this file's header comment for why (on request: "combine financial
// conditions and fx into the same tab", "remove the external part"). Kept
// as two separate arrays rather than merged into one, since FINANCIAL and
// FX_VARS still map 1:1 onto lib/vars.ts's own "financial" and "fx"
// VAR_GROUPS ids — only the on-page presentation is combined, not the data.
const FINANCIAL_AND_FX: Entry[] = [...FINANCIAL, ...FX_VARS];

const FISCAL: Entry[] = [
  { term: "Federal Deficit.", rest: " US government spending minus revenue, as a share of GDP." },
  { term: "Federal Debt.", rest: " Total outstanding US government debt, as a share of GDP." },
  { term: "Current Account.", rest: " The US's combined trade and income balance with the rest of the world, as a share of GDP. Negative means the US is a net borrower from foreign countries." },
  { term: "US Terms of Trade.", rest: " The relative price of what the US exports versus what it imports. It worsens when the US has to pay more for things it buys from abroad, especially energy." },
  { term: "Energy Supply Shock.", rest: " A stand-in for a sudden change in global energy supply, like an OPEC production cut." },
  { term: "Productivity Growth.", rest: " How much output the economy produces per hour worked." },
  { term: "Education Investment.", rest: " Spending on education and workforce training as a share of GDP. This is a slow moving, structural input rather than something that swings rapidly from scenario to scenario." },
];

const CURVE: Entry[] = [
  { term: "UST 2Y / 5Y / 10Y / 30Y Yield.", rest: " The market-quoted yield on that specific US Treasury maturity." },
];

export default function VariableReference() {
  return (
    <div className="min-w-[1280px] border border-term-edge bg-term-bg">
      <LandingHeader active="variables" />

      <div className="px-6 py-5">
        <div className="mb-6">
          <SectionBanner>Monetary Policy</SectionBanner>
          <EntryList items={MONETARY} />
        </div>
        <div className="mb-6">
          <SectionBanner>Inflation &amp; Expectations</SectionBanner>
          <EntryList items={INFLATION} />
        </div>
        <div className="mb-6">
          <SectionBanner>Growth &amp; Labor</SectionBanner>
          <EntryList items={GROWTH} />
        </div>
        <div className="mb-6">
          <SectionBanner>Financial Conditions &amp; FX</SectionBanner>
          <EntryList items={FINANCIAL_AND_FX} />
        </div>
        <div className="mb-6">
          <SectionBanner>Fiscal &amp; Structural</SectionBanner>
          <EntryList items={FISCAL} />
        </div>
        <div>
          <SectionBanner>Yield Curve</SectionBanner>
          <EntryList items={CURVE} />
        </div>
      </div>
    </div>
  );
}

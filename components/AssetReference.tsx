import { LandingHeader, SectionBanner } from "./LandingChrome";

// One of the four front-page routes — "/assets" — same plain Server
// Component shape as Landing.tsx: no scenario state, static copy only, so
// no "use client" here either.
//
// This used to be the bottom half of a single combined "/reference" route
// (an Assets section stacked below a Variables section on one page — see
// components/VariableReference.tsx for the other half and its own comment
// for the fuller provenance of this split). On request ("Do variable
// reference and asset references and separate them"), Assets now has its
// own tab/route rather than sharing one with Variables.
//
// Every asset named below is a real id from lib/assets.ts (cross-checked
// against it while writing this) — this just explains in plain English what
// each one represents in the real world, not the coefficients or formulas
// behind it (on request: "Don't use an abundance of numbers or advanced
// metrics, just simple descriptions"). Grouped exactly the way the live app
// groups them — AssetGroup (Bonds/Equities/Commodities/FX — lib/assets.ts)
// — so this page reads as a key to the P&L/Derivation/Trading tables rather
// than a reshuffled list.
//
// The copy itself is the user's own full rewrite (see Landing.tsx's comment
// for the fuller provenance of that rewrite and the spelling-only pass
// applied to it) — unchanged by this split, just moved into its own file.
// The Equities entry below still deliberately says "Consumer Goods" even
// though the live app's actual asset label (lib/assets.ts, SEC_CONS) is
// just "Consumer" — asked about explicitly, and the answer was to keep this
// page's copy as "Consumer Goods" rather than change either side to match
// the other, so the two remain deliberately different wordings for the same
// asset.
//
// The page's own intro paragraph (above the Bonds banner) was removed on
// request ("Remove these") — the nav tab ("ASSETS") and each SectionBanner
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

const BONDS: Entry[] = [
  { term: "UST 2Y / 5Y / 10Y / 30Y.", rest: " US Treasury notes and bonds at that specific maturity." },
  { term: "Agency MBS.", rest: " Mortgage-backed securities issued by US government-sponsored agencies." },
  { term: "IG Corporate.", rest: " A broad basket of investment-grade corporate bonds." },
  { term: "HY BB.", rest: " High-yield corporate bonds rated BB." },
  { term: "HY B/CCC.", rest: " High-yield bonds rated B or CCC. These are the riskiest and most sensitive to credit changes." },
];

const EQUITIES: Entry[] = [
  { term: "US Large Cap.", rest: " A broad large-cap US equity index, which in this software is most alike to the S&P 500." },
  { term: "US Small Cap.", rest: " A broad small-cap US equity index." },
  { term: "Intl Developed.", rest: " Developed international equity markets outside the US (Europe, Japan, and similar)." },
  { term: "Emerging Markets.", rest: " A broad emerging-market equity index." },
  { term: "Semiconductors, Healthcare, Tech.", rest: " Individual sectors specializing in a certain product or service or both." },
  { term: "S&P Sectors.", rest: " Technology, Financials, Energy, Utilities, Industrials, Health Care, and Consumer Goods." },
];

const COMMODITIES: Entry[] = [
  { term: "WTI Crude, Brent Crude.", rest: " The two benchmark crude oil grades with WTI representing US pricing and Brent representing the international market." },
  { term: "Natural Gas.", rest: " US natural gas." },
  { term: "Gold.", rest: " The traditional safe-haven metal, which has a negative correlation with real rates and risk sentiment." },
  { term: "Copper.", rest: " An industrial metal often read as a growth measurer because so much of it goes into construction and manufacturing (and increasingly chip production and electricity-related construction)." },
  { term: "Iron Ore.", rest: " A steelmaking input, especially sensitive to Chinese industrial demand." },
  { term: "Agriculture Basket.", rest: " A basket of agricultural commodities." },
];

const FX_ASSETS: Entry[] = [
  { term: "USD/CAD, EUR/USD, USD/JPY, GBP/USD, USD/CNY, USD/MXN, USD/CHF.", rest: " The same currency pairs as the FX & External variables above but are priced here as tradable instruments in P&L, Derivation, and Trading." },
];

export default function AssetReference() {
  return (
    <div className="min-w-[1280px] border border-term-edge bg-term-bg">
      <LandingHeader active="assets" />

      <div className="px-6 py-5">
        <div className="mb-6">
          <SectionBanner>Bonds</SectionBanner>
          <EntryList items={BONDS} />
        </div>
        <div className="mb-6">
          <SectionBanner>Equities</SectionBanner>
          <EntryList items={EQUITIES} />
        </div>
        <div className="mb-6">
          <SectionBanner>Commodities</SectionBanner>
          <EntryList items={COMMODITIES} />
        </div>
        <div>
          <SectionBanner>FX</SectionBanner>
          <EntryList items={FX_ASSETS} />
        </div>
      </div>
    </div>
  );
}

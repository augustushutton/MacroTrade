// Shared x-axis geometry for every Treasury-curve chart on the Builder page
// (YieldCurveChart, RealYieldPanel, ScenarioComparisonChart). All three use
// the same left/right padding and the same log(2)..log(30) domain, so a 5Y
// or 10Y point sits at the exact same horizontal position in every one of
// them — stacked top to bottom they read as one continuous terminal "curve
// stack," the same way a real multi-pane rates screen lines its panels up,
// rather than three independently-scaled charts that happen to sit near
// each other.
export const CHART_W = 1000;
export const CHART_PAD_LEFT = 54;
export const CHART_PAD_RIGHT = 28;
export const CHART_X_MIN = Math.log(2);
export const CHART_X_MAX = Math.log(30);
const CHART_PLOT_W = CHART_W - CHART_PAD_LEFT - CHART_PAD_RIGHT;

export function xOf(maturity: number): number {
  return CHART_PAD_LEFT + ((Math.log(maturity) - CHART_X_MIN) / (CHART_X_MAX - CHART_X_MIN)) * CHART_PLOT_W;
}

export interface TreasuryCurvePoint {
  assetId: string;
  varId: string;
  maturity: number;
  label: string;
}

// The four tenors lib/assets.ts actually prices, short to long — the one
// list every Treasury-curve chart on the Builder page draws from, so
// YieldCurveChart and ScenarioComparisonChart can never quietly disagree on
// which tenors exist or which variable pins which one.
export const TREASURY_CURVE_POINTS: TreasuryCurvePoint[] = [
  { assetId: "UST2Y", varId: "ust2yYield", maturity: 2, label: "2Y" },
  { assetId: "UST5Y", varId: "ust5yYield", maturity: 5, label: "5Y" },
  { assetId: "UST10Y", varId: "ust10yYield", maturity: 10, label: "10Y" },
  { assetId: "UST30Y", varId: "ust30yYield", maturity: 30, label: "30Y" },
];

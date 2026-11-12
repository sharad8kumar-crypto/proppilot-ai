// Pure functions. The AI never does this math.

export const EMI_DEFAULTS = {
  ltv: 0.8, // loan = 80% of the price
  annualRatePct: 8.5,
  years: 20,
} as const;

// EMI = P * r * (1+r)^n / ((1+r)^n - 1)
// P = loan amount, r = annual rate / 12 / 100, n = months
export function calcEmi(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;

  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / n;

  const growth = Math.pow(1 + r, n);
  return (principal * r * growth) / (growth - 1);
}

export type EmiBreakdown = {
  loan: number;
  downPayment: number;
  emi: number;
  totalPayable: number;
  totalInterest: number;
};

export function emiForPrice(
  price: number,
  opts: { ltv?: number; annualRatePct?: number; years?: number } = {}
): EmiBreakdown {
  const ltv = opts.ltv ?? EMI_DEFAULTS.ltv;
  const rate = opts.annualRatePct ?? EMI_DEFAULTS.annualRatePct;
  const years = opts.years ?? EMI_DEFAULTS.years;

  const loan = Math.round(price * ltv);
  const emi = Math.round(calcEmi(loan, rate, years));
  const totalPayable = emi * Math.round(years * 12);

  return {
    loan,
    downPayment: price - loan,
    emi,
    totalPayable,
    totalInterest: totalPayable - loan,
  };
}

// 55540 -> "₹55,540"
export function formatEmiAmount(emi: number): string {
  return `₹${Math.round(emi).toLocaleString("en-IN")}`;
}
import { calcEmi, emiForPrice, formatEmiAmount } from "../src/lib/emi";

// ₹1 lakh loan at 8.5% for 20 years -> about ₹868 per month (standard bank figure)
console.log("EMI per lakh:", Math.round(calcEmi(100_000, 8.5, 20)));

const eighty = emiForPrice(80 * 100_000);
console.log("80 lakh flat:", {
  loan: eighty.loan,
  emi: formatEmiAmount(eighty.emi),
  totalInterest: eighty.totalInterest,
});
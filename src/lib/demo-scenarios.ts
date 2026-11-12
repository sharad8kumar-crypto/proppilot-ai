import type { LeadSource } from "@/types";

export type DemoScenario = "serious" | "investor" | "budget" | "urgent" | "negotiator";

// Opening messages for simulated leads. All names and numbers are fictional.
// "expect" is what usually happens (the AI decides, so it can vary a little).
export const DEMO_SCENARIOS: Record<
  DemoScenario,
  { label: string; expect: string; message: string }
> = {
  serious: {
    label: "Serious buyer",
    expect: "Hot",
    message:
      "Mujhe Noida Extension mein 2BHK chahiye, budget 80 lakh hai aur 2 mahine mein lena hai. Home loan lunga, self use ke liye hai. Is hafte visit karna chahta hoon.",
  },
  investor: {
    label: "Investor",
    expect: "Warm",
    message:
      "I am looking for an investment property in Greater Noida West, around 60 to 70 lakh. Rental yield and resale value matter to me. I will decide in 4 to 5 months.",
  },
  budget: {
    label: "Budget shopper",
    expect: "Cold",
    message: "Sasta 1BHK batao Ghaziabad mein, kitne ka milega? Bas dekh raha hoon abhi.",
  },
  urgent: {
    label: "Urgent relocation",
    expect: "Hot",
    message:
      "Mera transfer Gurgaon ho gaya hai, jaldi se jaldi 3BHK chahiye Sohna Road pe, budget 1.8 crore tak. Loan nahi lunga. Kal visit kar sakta hoon.",
  },
  negotiator: {
    label: "Price negotiator",
    expect: "Warm or Cold",
    message:
      "Greater Noida West mein 2BHK dekha tha, 68 lakh bahut zyada hai. Kuch discount milega kya? 60 lakh mein final ho toh baat karte hain.",
  },
};

export const DEMO_SCENARIO_ORDER: DemoScenario[] = [
  "serious",
  "investor",
  "budget",
  "urgent",
  "negotiator",
];

export function isDemoScenario(value: string): value is DemoScenario {
  return value in DEMO_SCENARIOS;
}

// Each source starts its enquiry a little differently
export const SOURCE_OPENERS: Record<LeadSource, string> = {
  "99acres": "Hi, I saw your listing on 99acres. ",
  magicbricks: "Hello, I found your project on MagicBricks. ",
  housing: "Hi, I came across your project on Housing.com. ",
  facebook: "Hi, I saw your ad on Facebook. ",
  whatsapp: "",
  website: "Hi, I was browsing your website. ",
};

const FIRST_NAMES = [
  "Aarav", "Ananya", "Rohan", "Priya", "Vikram", "Sneha", "Karan", "Neha",
  "Arjun", "Kavya", "Rahul", "Pooja", "Siddharth", "Divya", "Nikhil", "Isha",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Singh", "Kapoor", "Mehta",
  "Agarwal", "Jain", "Tiwari", "Bansal", "Saxena", "Joshi",
];

export function randomDemoName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}
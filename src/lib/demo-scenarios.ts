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
      "I need a 2 BHK in Noida Extension. My budget is 80 lakh and I want to buy within 2 months. I will take a home loan and it is for my own use. I would like to visit this week.",
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
    message: "Please show me an affordable 1 BHK in Ghaziabad. How much does it cost? I am just looking for now.",
  },
  urgent: {
    label: "Urgent relocation",
    expect: "Hot",
    message:
      "I have been transferred to Gurgaon and need a 3 BHK on Sohna Road as soon as possible, budget up to 1.8 crore. I will not take a loan. I can visit tomorrow.",
  },
  negotiator: {
    label: "Price negotiator",
    expect: "Warm or Cold",
    message:
      "I saw a 2 BHK in Greater Noida West, but 68 lakh is too much. Can I get any discount? If it closes at 60 lakh, let's talk.",
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
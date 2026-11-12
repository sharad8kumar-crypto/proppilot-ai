import { Check } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/utils";

type Tier = {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
};

// Edit these to match your own packages
const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "Starts at ₹25,000",
    tagline: "Never miss a lead again",
    features: [
      "Lead capture from every source",
      "AI replies and qualification in Hinglish, Hindi and English",
      "Live dashboard with response-time tracking",
      "Instant in-app alerts for Hot leads",
    ],
  },
  {
    name: "Pro",
    price: "Starts at ₹50,000",
    tagline: "From first message to site visit",
    highlight: true,
    features: [
      "Everything in Starter",
      "Property matching with EMI estimates",
      "Site visit booking with a team calendar",
      "Automatic follow-up sequences",
      "Pipeline board and analytics with ROI",
    ],
  },
  {
    name: "Premium",
    price: "From ₹1 lakh",
    tagline: "Built around your business",
    features: [
      "Everything in Pro",
      "Custom workflows designed for your team",
      "Real integrations: WhatsApp Business API, property portals, your CRM",
      "Team onboarding and training",
    ],
  },
];

export default function PricingPage() {
  const contactUrl = process.env.NEXT_PUBLIC_CONTACT_URL;
  const contactLabel = process.env.NEXT_PUBLIC_CONTACT_LABEL || "Get a quote";

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Pick a starting point. Final pricing depends on your scope, and monthly support is priced separately."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <GlassCard
            key={tier.name}
            className={cn("flex flex-col p-6", tier.highlight && "border-primary bg-surface")}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl">{tier.name}</h2>
              {tier.highlight && (
                <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>
            <p className="mt-5 font-serif text-3xl">{tier.price}</p>

            <ul className="mt-6 space-y-3 text-sm">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="mt-6 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl">What you saw in this demo</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The AI conversation, scoring, property matching, EMI, visit booking, follow-ups, pipeline
            and analytics all run for real. Portal and WhatsApp feeds are simulated here. Connecting
            the real ones is part of the Premium plan.
          </p>
        </div>
        {contactUrl ? (
          <a
            href={contactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-hover"
          >
            {contactLabel}
          </a>
        ) : null}
      </GlassCard>
    </>
  );
}
"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { formatInr } from "@/lib/format";

type SliderProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
};

function Slider({ id, label, value, min, max, step, display, onChange }: SliderProps) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-primary"
      />
    </div>
  );
}

const oneDecimal = (n: number) => Number(n.toFixed(1)).toLocaleString("en-IN");

type RoiCalculatorProps = {
  autoHandledPct: number; // from real data
  leadsLast30: number; // from real data, shown as a hint
};

export function RoiCalculator({ autoHandledPct, leadsLast30 }: RoiCalculatorProps) {
  const [leads, setLeads] = useState(300);
  const [commission, setCommission] = useState(150_000);
  const [lift, setLift] = useState(15);
  const [baseline, setBaseline] = useState(2);
  const [minutes, setMinutes] = useState(15);

  const auto = Math.min(100, Math.max(0, autoHandledPct));

  // The formulas are shown on screen, so a client can check every number
  const hoursSaved = (leads * minutes * (auto / 100)) / 60;
  const baselineBookings = leads * (baseline / 100);
  const extraBookings = baselineBookings * (lift / 100);
  const revenueMonthly = extraBookings * commission;
  const revenueYearly = revenueMonthly * 12;

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10">
          <Calculator className="size-4" aria-hidden />
        </span>
        <h2 className="font-serif text-xl">ROI calculator</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Adjust the sliders to your own business. The demo data has {leadsLast30} leads in the last 30
        days.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-5">
          <Slider
            id="roi-leads"
            label="Leads per month"
            value={leads}
            min={50}
            max={2000}
            step={50}
            display={leads.toLocaleString("en-IN")}
            onChange={setLeads}
          />
          <Slider
            id="roi-commission"
            label="Average commission per booking"
            value={commission}
            min={50_000}
            max={500_000}
            step={10_000}
            display={formatInr(commission)}
            onChange={setCommission}
          />
          <Slider
            id="roi-lift"
            label="Conversion lift from faster response"
            value={lift}
            min={5}
            max={50}
            step={1}
            display={`${lift}%`}
            onChange={setLift}
          />
          <Slider
            id="roi-baseline"
            label="Current lead-to-booking conversion"
            value={baseline}
            min={1}
            max={5}
            step={0.5}
            display={`${baseline}%`}
            onChange={setBaseline}
          />
          <Slider
            id="roi-minutes"
            label="Manual work per lead today"
            value={minutes}
            min={5}
            max={30}
            step={1}
            display={`${minutes} min`}
            onChange={setMinutes}
          />
        </div>

        {/* Results + visible formulas */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface p-4">
              <p className="text-xs text-muted-foreground">Hours saved / month</p>
              <p className="mt-1 font-serif text-3xl" aria-live="polite">
                {oneDecimal(hoursSaved)}
              </p>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <p className="text-xs text-muted-foreground">Extra bookings / month</p>
              <p className="mt-1 font-serif text-3xl" aria-live="polite">
                {oneDecimal(extraBookings)}
              </p>
            </div>
            <div className="rounded-xl bg-primary p-4 text-primary-foreground">
              <p className="text-xs text-primary-foreground/70">Revenue impact / month</p>
              <p className="mt-1 font-serif text-3xl" aria-live="polite">
                {formatInr(Math.round(revenueMonthly))}
              </p>
            </div>
          </div>

          <p className="rounded-xl bg-surface px-4 py-3 text-sm">
            That is about{" "}
            <span className="font-semibold">{formatInr(Math.round(revenueYearly))}</span> extra
            commission and{" "}
            <span className="font-semibold">{oneDecimal(hoursSaved * 12)} hours</span> of team time
            saved every year.
          </p>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How it is calculated
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Hours saved</span> = {leads} leads ×{" "}
                {minutes} min ÷ 60 × {auto}% handled by AI ={" "}
                <span className="font-medium text-foreground">{oneDecimal(hoursSaved)} h</span>
              </li>
              <li>
                <span className="font-medium text-foreground">Extra bookings</span> = {leads} leads
                × {baseline}% current conversion × {lift}% lift ={" "}
                <span className="font-medium text-foreground">{oneDecimal(extraBookings)}</span>
              </li>
              <li>
                <span className="font-medium text-foreground">Revenue impact</span> ={" "}
                {oneDecimal(extraBookings)} extra bookings × {formatInr(commission)} ={" "}
                <span className="font-medium text-foreground">
                  {formatInr(Math.round(revenueMonthly))}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-faint">
              An estimate based on the numbers above. The AI-handled share ({auto}%) comes from your
              live data. Real results depend on your market and team.
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
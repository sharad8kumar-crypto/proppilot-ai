# PropPilot AI

**AI sales automation for Indian real estate builders and brokers.**
Replies to every lead in seconds, qualifies them, matches properties, books site visits, follows up
automatically and shows the owner exactly where the money is.

> **Demo environment.** Portal (99acres, MagicBricks, Housing, Facebook) and WhatsApp feeds are
> simulated. The AI conversation, scoring, matching, EMI, scheduling, follow-ups, pipeline,
> analytics and alerts all run for real. Real integrations are a paid add-on.

![Command Center](docs/screenshots/command-center.png)

## What it does

- **AI first response** in seconds, in the buyer's language (Hinglish, Hindi or English), asking one
  question at a time and never inventing prices.
- **Explainable lead scoring** out of 100 (rules in code, not AI) with a Hot, Warm and Cold split.
- **Property matching and EMI** from the database. The AI never does the math.
- **Site visit booking** with free slots, agent auto-assignment and reminders.
- **Follow-up engine** with sequences per lead temperature, plus a time fast-forward for demos.
- **Pipeline board**, **calendar**, **analytics and ROI calculator**, **workflow canvas** and a
  notification bell, all updating live.

## Screens

| Screen | Preview |
| --- | --- |
| Inbox (chat, AI insights, score breakdown) | ![Inbox](docs/screenshots/inbox.png) |
| Pipeline (drag and drop, follow-up engine) | ![Pipeline](docs/screenshots/pipeline.png) |
| Properties (grid, list, map, EMI) | ![Properties](docs/screenshots/properties.png) |
| Calendar (AI-booked visits) | ![Calendar](docs/screenshots/calendar.png) |
| Analytics and ROI | ![Analytics](docs/screenshots/analytics.png) |
| Workflows (Run test) | ![Workflows](docs/screenshots/workflows.png) |

## Tech stack

Next.js (App Router) and TypeScript, Tailwind CSS and shadcn/ui, Framer Motion, Recharts,
React Flow (`@xyflow/react`), dnd-kit, Leaflet and OpenStreetMap, Groq (`groq-sdk`) for the AI,
Supabase (Postgres and Realtime), deployed on Vercel.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values (Windows: copy .env.example .env.local)
```

1. Create a free Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. Fill `.env.local` (see the variable names below).
3. Load the demo data and start the app:

```bash
npm run seed
npm run dev
```

Open http://localhost:3000.

Useful scripts: `npm run check:groq` lists the Groq models your key can use.

## Environment variables

Names only. Never commit real values.

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Model id (default `openai/gpt-oss-20b`; Groq retires models, so keep it configurable) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (read access and realtime) |
| `SUPABASE_SECRET_KEY` | Supabase secret key, server only |
| `DEMO_ADMIN_KEY` | Protects the demo reset and simulate endpoints |
| `NEXT_PUBLIC_CONTACT_URL`, `NEXT_PUBLIC_CONTACT_LABEL` | Optional: the Pricing page contact button |

## Running a demo

Open the floating control panel (bottom right) to simulate leads, fast-forward time, raise the
"Hot lead untouched" alert, reset the data, or switch to **Presenter mode** (Alt + Shift + P to
toggle). The panel asks for `DEMO_ADMIN_KEY` for the actions that change data.

## Security notes

- The Supabase secret key is only used in server route handlers.
- `/api/chat` is rate limited and caps message length. Rate limiting is best-effort on serverless.
- Demo tables are publicly readable by design (fictional data). Do not store real client data in the
  demo database.

## Pricing

Starter (from ₹25,000), Pro (from ₹50,000) and Premium (from ₹1 lakh) packages. Monthly support is
priced separately. See `/pricing` in the app.
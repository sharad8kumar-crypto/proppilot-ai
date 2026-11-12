import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { seedDatabase } from "../src/lib/seed";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
    process.exit(1);
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Wiping old data and seeding...");
  const summary = await seedDatabase(db);

  console.log("Seed complete:");
  for (const [table, count] of Object.entries(summary)) {
    console.log(`  ${table.padEnd(16)} ${count}`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
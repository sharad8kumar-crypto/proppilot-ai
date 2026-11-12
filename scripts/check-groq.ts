import { config } from "dotenv";
import Groq from "groq-sdk";

config({ path: ".env.local" });

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is missing in .env.local");
    process.exit(1);
  }

  const wanted = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
  const groq = new Groq({ apiKey });

  const list = await groq.models.list();
  const ids = (list.data ?? []).map((m) => m.id).sort();

  console.log("Models available to your key:");
  for (const id of ids) console.log(" -", id);

  if (ids.includes(wanted)) {
    console.log(`\nOK: GROQ_MODEL "${wanted}" is available.`);
  } else {
    console.log(
      `\nPROBLEM: GROQ_MODEL "${wanted}" is NOT in the list. Pick one from above and update .env.local.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
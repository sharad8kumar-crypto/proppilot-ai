import "server-only";
import Groq from "groq-sdk";

// Model name lives in an env variable because Groq retires models often.
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

let client: Groq | null = null;

export function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in .env.local");
  }
  client ??= new Groq({ apiKey, timeout: 20_000, maxRetries: 1 });
  return client;
}
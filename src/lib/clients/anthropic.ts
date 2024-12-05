import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY environment variable");
}

const client = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const anthropicSonnet = anthropic("claude-3-5-sonnet-20241022");
const anthropicHaiku = anthropic("claude-3-haiku-20241022");

export { client, anthropicSonnet, anthropicHaiku };

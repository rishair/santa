import { SantaBot } from "@/lib/bot";
import { NextResponse } from "next/server";
import { twitterClient } from "@/lib/clients/twitter";
// Verify the request is from Vercel cron
const CRON_SECRET = process.env.CRON_SECRET;

export const runtime = "edge";

export async function GET(request: Request) {
  // Verify this is a valid cron request
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const bot = new SantaBot(twitterClient);
    bot.testAction();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bot error:", error);
    return NextResponse.json(
      { success: false, error: "Bot execution failed" },
      { status: 500 }
    );
  }
}

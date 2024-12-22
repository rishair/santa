import { NextResponse } from "next/server";
import { mongoClient } from "../../lib/clients/mongo";
import { MongoQueue } from "../../lib/stores/queue";

const santaDb = mongoClient.db("santa");
const tweetQueueRepository = new MongoQueue<string>(
  santaDb,
  "replyToTweetQueue"
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tweetId } = body;

    if (!tweetId) {
      return NextResponse.json(
        { success: false, error: "Tweet ID is required" },
        { status: 400 }
      );
    }

    await tweetQueueRepository.enqueue(tweetId);

    return NextResponse.json({
      success: true,
      message: "Tweet added to queue successfully",
      tweetId,
    });
  } catch (error) {
    console.error("Error adding tweet to queue:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to add tweet to queue",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

import express, { RequestHandler } from "express";
import cors from "cors";
import { MongoQueue } from "../lib/stores/queue";
import { mongoClient } from "../lib/clients/mongo";

const app = express();
const port = 3001; // Different from Next.js port

// Middleware
app.use(cors());
app.use(express.json());

// Initialize queue
const santaDb = mongoClient.db("santa");
const tweetQueueRepository = new MongoQueue<string>(
  santaDb,
  "replyToTweetQueue"
);

interface QueueRequest {
  tweetId: string;
}

const queueTweet: RequestHandler<{}, {}, QueueRequest> = async (
  req,
  res
): Promise<void> => {
  try {
    const { tweetId } = req.body;

    if (!tweetId) {
      res.status(400).json({ error: "Tweet ID is required" });
      return;
    }

    await tweetQueueRepository.enqueue(tweetId);
    res.json({ success: true, message: "Tweet added to queue" });
  } catch (error) {
    console.error("Error adding tweet to queue:", error);
    res.status(500).json({ error: "Failed to add tweet to queue" });
  }
};

const getQueueStatus: RequestHandler = async (req, res): Promise<void> => {
  try {
    const count = await tweetQueueRepository.count();
    res.json({ count });
  } catch (error) {
    console.error("Error getting queue status:", error);
    res.status(500).json({ error: "Failed to get queue status" });
  }
};

// GET endpoint for queuing tweets (useful for testing via browser)
app.get("/queue/add/:tweetId", async (req, res) => {
  try {
    const { tweetId } = req.params;

    if (!tweetId) {
      res.status(400).json({ error: "Tweet ID is required" });
      return;
    }

    await tweetQueueRepository.enqueue(tweetId);
    res.json({ success: true, message: "Tweet added to queue" });
  } catch (error) {
    console.error("Error adding tweet to queue:", error);
    res.status(500).json({ error: "Failed to add tweet to queue" });
  }
});

app.post("/queue/tweet", queueTweet);
app.get("/queue/status", getQueueStatus);

export function startWebServer() {
  app.listen(port, () => {
    console.log(`🎄 Web server running at http://localhost:${port}`);
  });
}

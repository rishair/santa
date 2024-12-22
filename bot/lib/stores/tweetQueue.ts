import { Db } from "mongodb";
import { MongoQueue, QueuedItem } from "./queue";

export interface QueuedTweet extends QueuedItem {
  tweetId: string;
}

export class TweetQueueRepository {
  private readonly queue: MongoQueue<QueuedTweet>;

  constructor(db: Db) {
    this.queue = new MongoQueue<QueuedTweet>(db, "tweetQueue");
  }

  async enqueue(tweetId: string) {
    await this.queue.enqueue({ tweetId });
  }

  async dequeue(): Promise<string | null> {
    const item = await this.queue.dequeue();
    return item?.tweetId ?? null;
  }

  async clear() {
    await this.queue.clear();
  }

  async peek(): Promise<string | null> {
    const item = await this.queue.peek();
    return item?.tweetId ?? null;
  }

  async count(): Promise<number> {
    return this.queue.count();
  }
}

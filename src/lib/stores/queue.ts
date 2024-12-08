import { MongoClient } from "mongodb";

export interface QueueItem<T> {
  id: string;
  data: T;
  createdAt: Date;
  processedAt?: Date;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export class MongoQueue<T> {
  constructor(
    private readonly mongoClient: MongoClient,
    private readonly queueName: string
  ) {}

  public async enqueue(data: T): Promise<string> {
    const item: QueueItem<T> = {
      id: crypto.randomUUID(),
      data,
      createdAt: new Date(),
      status: "pending",
    };

    await this.mongoClient
      .db("santa")
      .collection(this.queueName)
      .insertOne(item);

    return item.id;
  }

  public async dequeue(): Promise<QueueItem<T> | null> {
    const result = await this.mongoClient
      .db("santa")
      .collection(this.queueName)
      .findOneAndUpdate(
        { status: "pending" },
        { $set: { status: "processing", processedAt: new Date() } },
        { sort: { createdAt: 1 } }
      );

    return result?.value ?? null;
  }

  public async complete(id: string): Promise<void> {
    await this.mongoClient
      .db("santa")
      .collection(this.queueName)
      .updateOne(
        { id },
        { $set: { status: "completed", processedAt: new Date() } }
      );
  }

  public async fail(id: string, error: string): Promise<void> {
    await this.mongoClient
      .db("santa")
      .collection(this.queueName)
      .updateOne(
        { id },
        { $set: { status: "failed", error, processedAt: new Date() } }
      );
  }

  public async peek(): Promise<QueueItem<T> | null> {
    const result = await this.mongoClient
      .db("santa")
      .collection(this.queueName)
      .findOne({ status: "pending" }, { sort: { createdAt: 1 } });

    return result?.value ?? null;
  }

  public async size(): Promise<number> {
    return this.mongoClient
      .db("santa")
      .collection(this.queueName)
      .countDocuments({ status: "pending" });
  }
}

import { Db, ObjectId, OptionalUnlessRequiredId } from "mongodb";

export interface QueuedItem<T> {
  _id: ObjectId;
  createdAt: Date;
  processedAt?: Date;
  value: T;
}

export class MongoQueue<T> {
  private collection;

  constructor(db: Db, collectionName: string) {
    this.collection = db.collection<QueuedItem<T>>(collectionName);
  }

  async enqueue(value: T): Promise<ObjectId> {
    const item: OptionalUnlessRequiredId<QueuedItem<T>> = {
      _id: new ObjectId(),
      createdAt: new Date(),
      value,
    };

    const result = await this.collection.insertOne(item);
    return result.insertedId;
  }

  async dequeue(): Promise<QueuedItem<T> | null> {
    // Find and update in one atomic operation
    const result = await this.collection.findOneAndUpdate(
      { processedAt: { $exists: false } },
      { $set: { processedAt: new Date() } },
      { sort: { createdAt: 1 } }
    );

    return result ?? null;
  }

  async peek(): Promise<QueuedItem<T> | null> {
    return await this.collection.findOne(
      { processedAt: { $exists: false } },
      { sort: { createdAt: 1 } }
    );
  }

  async size(): Promise<number> {
    return await this.collection.countDocuments({
      processedAt: { $exists: false },
    });
  }
}

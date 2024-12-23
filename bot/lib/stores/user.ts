import { Db, ObjectId } from "mongodb";
import { TweetWithContext } from "./twitter";
import { Repository } from "./repo";
import TwitterApi from "twitter-api-v2";
import { DMEventV2 } from "twitter-api-v2/dist/esm/types/v2/dm.v2.types";
import { globals } from "../util/globals";
// Stores all the interactions that we've had with a user, along with the full text of
// the reply chain and context we used for it.
export type UserReplies = {
  replyToTweetId: string;
  replyTweet: {
    id: string;
    text: string;
  };
  usernames: string[];
  replyBranchThread: TweetWithContext[];
  conversationRootThread: TweetWithContext[];
  createdAt: Date;
  /**
   *  Optional error property. If an error has occurred
   *  and we want to store it, we can set this. Older documents
   *  won't have this field.
   */
  error?: string;
};

// Add MongoDB document type
type UserRepliesDocument = UserReplies & {
  _id: ObjectId;
};

export class UserRepliesRepository
  implements Repository<string, null, UserReplies>
{
  private readonly collection;

  public constructor(private readonly db: Db) {
    this.collection = this.db.collection<UserRepliesDocument>("user_replies");
    // Create index for username queries
    this.collection.createIndex({ usernames: 1, createdAt: -1 });
  }

  // Helper method to map DB document to domain model
  private mapToUserReplies(doc: UserRepliesDocument): UserReplies {
    // Extract _id, but keep the optional error property if present
    const { _id, ...rest } = doc;
    return {
      ...rest,
      // If doc.error is missing, it will be undefined, which is valid since error?: string
    };
  }

  public async store(reply: UserReplies) {
    if (globals.get("storeReplies")) {
      await this.collection.insertOne({
        ...reply,
        _id: new ObjectId(),
        createdAt: new Date(),
        // Ensure we store error if it exists, otherwise omit or store as null
        error: reply.error ?? undefined,
      });
    } else {
      console.log("Debug flag: Not storing reply");
    }
  }

  public async read(replyToTweetId: string): Promise<UserReplies | null> {
    const doc = await this.collection.findOne({ replyToTweetId });
    return doc ? this.mapToUserReplies(doc) : null;
  }

  public async findByUsernames(usernames: string[]): Promise<UserReplies[]> {
    const docs = await this.collection
      .find({ usernames: { $in: usernames } })
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map(this.mapToUserReplies);
  }

  public async getLatestTweets(): Promise<UserReplies[]> {
    const docs = await this.collection
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return docs.map(this.mapToUserReplies);
  }

  /**
   * Optional helper if you want to update the error later (e.g., if
   * you try something, fail, and then want to mark this record as
   * having an error).
   */
  public async updateError(replyToTweetId: string, errorMessage: string) {
    await this.collection.updateOne(
      { replyToTweetId },
      { $set: { error: errorMessage } }
    );
  }
}

// Retrieve direct messages for this user from Twitter
export class UserDirectMessagesRepository {
  private readonly twitterClient: TwitterApi;

  public constructor(twitterClient: TwitterApi) {
    this.twitterClient = twitterClient;
  }

  public async read(): Promise<DMEventV2[]> {
    const messages = await this.twitterClient.v2.listDmEvents({
      max_results: 50,
      event_types: ["MessageCreate"],
      expansions: ["referenced_tweets.id"],
      "tweet.fields": ["attachments"],
    });
    return messages.events;
  }
}

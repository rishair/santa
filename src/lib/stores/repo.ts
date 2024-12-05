import { TweetPublicMetricsV2, TwitterApi, UserV2 } from "twitter-api-v2";
import { MongoClient } from "mongodb";

export interface Repository<Input, Output> {
  read(input: Input): Promise<Output | null>;
}

export type Tweet = {
  text: string;
  createdAt: string | undefined;
  username: string;
  id: string;
  engagement: TweetPublicMetricsV2 | undefined;
};

export type TweetWithContext = Tweet & {
  replyToTweet?: Tweet;
  quotedTweet?: Tweet;
};

export class UserTweetsRepository
  implements Repository<string, TweetWithContext[]>
{
  public constructor(private readonly twitterClient: TwitterApi) {}

  public async read(username: string): Promise<TweetWithContext[]> {
    try {
      const user = await this.twitterClient.v2.userByUsername(username);
      const tweets = await this.twitterClient.v2.userTimeline(user.data.id, {
        max_results: 5,
        "tweet.fields": [
          "text",
          "created_at",
          "referenced_tweets",
          "author_id",
          "public_metrics",
        ],
        "user.fields": ["username"],
        expansions: [
          "referenced_tweets.id",
          "author_id",
          "referenced_tweets.id.author_id",
        ],
      });

      const tweetsWithContext: any[] = [];

      // Create maps for referenced tweets and their authors
      const referencedTweets = new Map(
        tweets.includes?.tweets?.map((t) => [t.id, t]) || []
      );

      const userMap = new Map(
        [...(tweets.includes?.users || []), user.data].map((u) => [
          u.id,
          u.username,
        ])
      );

      for (const tweet of tweets.data.data) {
        const tweetContext: TweetWithContext = {
          text: tweet.text,
          username: tweet.author_id
            ? userMap.get(tweet.author_id) || username
            : username,
          createdAt: tweet.created_at,
          id: tweet.id,
          engagement: tweet.public_metrics,
        };

        // Handle referenced tweets (replies and quotes)
        if (tweet.referenced_tweets) {
          for (const refTweet of tweet.referenced_tweets) {
            const referencedTweet = referencedTweets.get(refTweet.id);
            if (!referencedTweet) continue;

            const refUsername = referencedTweet.author_id
              ? userMap.get(referencedTweet.author_id) || "unknown"
              : "unknown";

            if (refTweet.type === "replied_to") {
              tweetContext.replyToTweet = {
                text: referencedTweet.text,
                username: refUsername,
                createdAt: referencedTweet.created_at,
                id: referencedTweet.id,
                engagement: referencedTweet.public_metrics,
              };
            } else if (refTweet.type === "quoted") {
              tweetContext.quotedTweet = {
                text: referencedTweet.text,
                username: refUsername,
                createdAt: referencedTweet.created_at,
                id: referencedTweet.id,
                engagement: referencedTweet.public_metrics,
              };
            }
          }
        }

        tweetsWithContext.push(tweetContext);
      }

      return tweetsWithContext;
    } catch (error) {
      console.error(`Error fetching tweets for ${username}:`, error);
      return [];
    }
  }
}

export class UserProfileRepository implements Repository<string, UserV2> {
  public constructor(private readonly twitterClient: TwitterApi) {}

  public async read(username: string): Promise<UserV2 | null> {
    try {
      const user = await this.twitterClient.v2.userByUsername(username, {
        "user.fields": [
          "description",
          "public_metrics",
          "location",
          "url",
          "most_recent_tweet_id",
          "pinned_tweet_id",
        ],
      });
      return user.data;
    } catch (error) {
      console.error(`Error fetching user info for ${username}:`, error);
      return null;
    }
  }
}

export class CachingRepository<Input, Output>
  implements Repository<Input, Output>
{
  constructor(
    private readonly name: string,
    private readonly underlyingRepository: Repository<Input, Output>,
    private readonly mongoClient: MongoClient
  ) {}

  public async read(input: Input) {
    const cacheKey = this.cacheKey(input);
    console.log(`Looking up cache for ${cacheKey}`);

    const cached = await this.mongoClient
      .db("santa")
      .collection("cache")
      .findOne({ id: cacheKey });

    if (cached) {
      console.log(`Cache hit for ${cacheKey}`);
      return cached.value;
    }

    console.log(
      `Cache miss for ${cacheKey}, fetching from underlying repository`
    );
    const value = await this.underlyingRepository.read(input);

    console.log(`Caching value for ${cacheKey}`);
    await this.mongoClient
      .db("santa")
      .collection("cache")
      .insertOne({ id: cacheKey, value });

    return value;
  }

  private cacheKey(input: Input): string {
    const key = `cache:${this.name}:${JSON.stringify(input)}`;
    console.log(`Generated cache key: ${key}`);
    return key;
  }
}

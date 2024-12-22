import TwitterApi, {
  TTweetv2Expansion,
  TTweetv2MediaField,
  TTweetv2TweetField,
  TweetPublicMetricsV2,
  TweetSearchRecentV2Paginator,
  TweetUserMentionTimelineV2Paginator,
  TweetUserTimelineV2Paginator,
  Tweetv2SearchParams,
  TweetV2SingleResult,
  TweetV2UserTimelineParams,
  UserV2,
} from "twitter-api-v2";
import { Repository } from "./repo";
import { anthropicSonnet } from "../clients/anthropic";
import { generateText } from "ai";

export type TweetMedia = {
  type: "image";
  url: string;
  description?: string;
};

export type Tweet = {
  text: string;
  createdAt: Date | undefined;
  username: string;
  id: string;
  conversationId: string;
  engagement: TweetPublicMetricsV2 | undefined;
  media?: TweetMedia[];
};

export type TweetWithContext = Tweet & {
  replyToTweet?: Tweet;
  quotedTweet?: Tweet;
};

export type ITwitterUserMentionsRepository = Repository<
  string,
  UserMentionsOptions,
  TweetWithContext[]
>;

export const DefaultTweetFields: TTweetv2TweetField[] = [
  "text",
  "created_at",
  "referenced_tweets",
  "author_id",
  "public_metrics",
  "attachments",
  "conversation_id",
];

export const DefaultTweetExpansionFields: TTweetv2Expansion[] = [
  "referenced_tweets.id",
  "author_id",
  "referenced_tweets.id.author_id",
  "attachments.media_keys",
];

export const DefaultMediaFields: TTweetv2MediaField[] = [
  "url",
  "preview_image_url",
];

export const DefaultFields = {
  "tweet.fields": DefaultTweetFields,
  expansions: DefaultTweetExpansionFields,
  "media.fields": DefaultMediaFields,
};

export type UserMentionsOptions = {
  startTime?: string;
};

export class TwitterUserMentionsRepository
  implements ITwitterUserMentionsRepository
{
  constructor(private readonly twitterClient: TwitterApi) {}

  public async read(
    userId: string,
    { startTime }: UserMentionsOptions = {}
  ): Promise<TweetWithContext[]> {
    const mentions = await this.twitterClient.v2.userMentionTimeline(userId, {
      start_time: startTime,
      max_results: 5,
      ...DefaultFields,
    });

    console.log("mentions", mentions.tweets);
    return convertTimelineToTweets(mentions);
  }
}

export class TwitterUserByScreenNameRepository
  implements Repository<string, void, UserV2>
{
  constructor(private readonly twitterClient: TwitterApi) {}

  public async read(username: string): Promise<UserV2 | null> {
    const user = await this.twitterClient.v2.userByUsername(username);
    return user.data || null;
  }
}

export type ITweetRepository = Repository<string, void, TweetWithContext>;

export class TwitterTweetRepository implements ITweetRepository {
  constructor(private readonly twitterClient: TwitterApi) {}

  public async read(tweetId: string): Promise<TweetWithContext | null> {
    const tweet = await this.twitterClient.v2.singleTweet(tweetId, {
      ...DefaultFields,
    });
    if (tweet.errors) {
      console.error("Error fetching tweet", tweetId, tweet.errors);
      return null;
    }
    return convertSingleTweet(tweet);
  }
}

export type ITweetMediaHydrator = Repository<Tweet, null, Tweet>;

export class TweetMediaHydrator implements ITweetMediaHydrator {
  public constructor() {}
  public async read(tweet: Tweet): Promise<Tweet> {
    // iterate through each of the tweets, find the media, and if there's a URL without a description,
    // then use an LLM to create a descripton and attach it to that piece of media, only if the type is "photo"
    console.log(
      `Processing tweet media for ${tweet.id} (${tweet.media?.map(
        (m) => m.type
      )})`
    );
    if (tweet.media) {
      for (const media of tweet.media) {
        if (media.type === "image" && !media.description) {
          console.log("Generating description for media", media.url);
          const description = await this.generateDescription(media.url, tweet);
          media.description = description;
          console.log("Generated description:", description);
        }
      }
    }
    return tweet;
  }

  private async generateDescription(
    url: string,
    tweet: Tweet
  ): Promise<string> {
    const result = await generateText({
      model: anthropicSonnet,
      messages: [
        {
          role: "system",
          content:
            "You are an expert at describing images. Describe the image in detail, including the context of the image. You will also be provided with the attached tweet, so use that context to help you describe the image.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Attached tweet: ${JSON.stringify(tweet)}`,
            },
            {
              type: "image",
              image: new URL(url),
            },
          ],
        },
      ],
    });
    return result.text;
  }
}

// New helper function for hydrating a tweet and its context
async function hydrateTweetAndContext(
  tweet: Tweet | TweetWithContext,
  tweetMediaHydrator: ITweetMediaHydrator,
  hydrateContext: boolean = false
): Promise<Tweet | TweetWithContext> {
  let hydratedTweet = await tweetMediaHydrator.read(tweet);
  hydratedTweet = hydratedTweet || tweet;
  if (hydrateContext && "replyToTweet" in hydratedTweet) {
    const tweetWithContext = hydratedTweet as TweetWithContext;
    const [hydratedReplyTweet, hydratedQuotedTweet] = await Promise.all([
      tweetWithContext.replyToTweet
        ? tweetMediaHydrator.read(tweetWithContext.replyToTweet)
        : undefined,
      tweetWithContext.quotedTweet
        ? tweetMediaHydrator.read(tweetWithContext.quotedTweet)
        : undefined,
    ]);

    tweetWithContext.replyToTweet = hydratedReplyTweet || undefined;
    tweetWithContext.quotedTweet = hydratedQuotedTweet || undefined;
  }

  return hydratedTweet;
}

export class MediaHydratingTweetRepository<
  Input,
  Ctx,
  T extends Tweet | TweetWithContext
> implements Repository<Input, Ctx, T[]>
{
  public constructor(
    private readonly underlyingRepository: Repository<Input, Ctx, T[]>,
    private readonly tweetMediaHydrator: ITweetMediaHydrator,
    private readonly hydrateContext: boolean = false
  ) {}

  public async read(input: Input, context?: Ctx): Promise<T[]> {
    const tweets = await this.underlyingRepository.read(input, context);
    if (!tweets) {
      return [];
    }
    const hydratedTweets = await Promise.all(
      tweets.map((tweet) =>
        hydrateTweetAndContext(
          tweet,
          this.tweetMediaHydrator,
          this.hydrateContext
        )
      )
    );
    return hydratedTweets as T[];
  }
}

export class SingleMediaHydratingTweetRepository
  implements Repository<string, null, TweetWithContext>
{
  public constructor(
    private readonly underlyingRepository: Repository<
      string,
      null,
      TweetWithContext
    >,
    private readonly tweetMediaHydrator: ITweetMediaHydrator,
    private readonly hydrateContext: boolean = true
  ) {}

  public async read(tweetId: string): Promise<TweetWithContext | null> {
    const tweet = await this.underlyingRepository.read(tweetId);
    if (!tweet) {
      return null;
    }
    return hydrateTweetAndContext(
      tweet,
      this.tweetMediaHydrator,
      this.hydrateContext
    ) as Promise<TweetWithContext>;
  }
}

export type UserTweetsParams = {
  maxResults?: number;
  startTime?: string;
  excludes?: ("retweets" | "replies")[];
};

export class UserTweetsRepository
  implements Repository<string, TweetV2UserTimelineParams, TweetWithContext[]>
{
  public constructor(private readonly twitterClient: TwitterApi) {}

  public async read(
    userId: string,
    params: TweetV2UserTimelineParams
  ): Promise<TweetWithContext[]> {
    try {
      const tweets = await this.twitterClient.v2.userTimeline(userId, {
        ...params,
        ...DefaultFields,
      });

      return convertTimelineToTweets(tweets);
    } catch (error) {
      console.error(`Error fetching tweets for ${userId}:`, error);
      return [];
    }
  }
}

export type UserOriginalTweetsAndRepliesParams = {
  maxResults?: number;
};

export type IUserOriginalTweetsAndRepliesRepository = Repository<
  string,
  UserOriginalTweetsAndRepliesParams,
  UserOriginalTweetsAndRepliesResponse
>;

export type UserOriginalTweetsAndRepliesResponse = {
  originalTweets: TweetWithContext[];
  replyTweets: TweetWithContext[];
};

export class UserOriginalTweetsAndRepliesRepository
  implements IUserOriginalTweetsAndRepliesRepository
{
  public constructor(private readonly twitterClient: TwitterApi) {}

  public async read(
    userId: string,
    { maxResults = 10 }: UserOriginalTweetsAndRepliesParams
  ): Promise<UserOriginalTweetsAndRepliesResponse> {
    const allReplyTweets: TweetWithContext[] = [];
    const allOriginalTweets: TweetWithContext[] = [];

    function addTweets(tweets: TweetWithContext[]) {
      tweets.forEach((tweet) => {
        if (tweet.replyToTweet) {
          allReplyTweets.push(tweet);
        } else {
          allOriginalTweets.push(tweet);
        }
      });
    }

    const replyTweets = await this.twitterClient.v2.userTimeline(userId, {
      ...DefaultFields,
      exclude: ["retweets"],
      max_results: maxResults,
    });

    addTweets(convertTimelineToTweets(replyTweets));

    // const originalTweets = await this.twitterClient.v2.userTimeline(userId, {
    //   ...DefaultFields,
    //   exclude: ["replies", "retweets"],
    //   max_results: maxResults - allReplyTweets.length,
    // });

    // addTweets(convertTimelineToTweets(originalTweets));

    return {
      originalTweets: allOriginalTweets,
      replyTweets: allReplyTweets,
    };
  }
}

export class UserProfileRepository implements Repository<string, null, UserV2> {
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

export interface ITweetSearchRepository
  extends Repository<
    string,
    Partial<Tweetv2SearchParams>,
    TweetWithContext[]
  > {}

export class TweetSearchRepository implements ITweetSearchRepository {
  public constructor(private readonly twitterClient: TwitterApi) {}

  public async read(
    query: string,
    params: Partial<Tweetv2SearchParams>
  ): Promise<TweetWithContext[]> {
    const tweets = await this.twitterClient.v2.search(query, {
      ...params,
      ...DefaultFields,
    });
    return convertTimelineToTweets(tweets);
  }
}

// // and it's reply to, until the limit is hit (limit provided ni the context)
// export class TwitterConversationRepository
//   implements Repository<string, null, TweetWithContext[]>
// {
//   public constructor(
//     private readonly twitterClient: TwitterApi,
//     private readonly maxTweets: number =
//   ) {}

//   public async read(tweetId: string): Promise<TweetWithContext[]> {
//     const conversation: TweetWithContext[] = [];
//     let currentTweetId = tweetId;
//     let count = 0;

//     while (currentTweetId && count < this.maxTweets) {
//       const tweet = await this.twitterClient.v2.singleTweet(currentTweetId, {
//         ...DefaultFields,
//       });

//       const tweetWithContext = convertSingleTweet(tweet);
//       conversation.unshift(tweetWithContext); // Add to beginning to maintain chronological order

//       // Look for reply_to reference to climb up the thread
//       const replyToTweet = tweet.data.referenced_tweets?.find(
//         (ref) => ref.type === "replied_to"
//       );

//       if (!replyToTweet) {
//         break; // No more replies to climb
//       }

//       currentTweetId = replyToTweet.id;
//       count++;
//     }

//     return conversation;
//   }
// }

// Helper function to create user map from includes
function createUserMap(users: any[] = []): Map<string, string> {
  return new Map(users.map((u) => [u.id, u.username]));
}

function convertTweetWithContext(
  tweet: any,
  referencedTweets: Map<string, any>,
  userMap: Map<string, string>,
  mediaMap: Map<string, any> = new Map()
): TweetWithContext {
  function extractMedia(tweetData: any): TweetMedia[] | undefined {
    if (!tweetData.attachments?.media_keys) return undefined;

    return tweetData.attachments.media_keys
      .map((key: string) => {
        const mediaItem = mediaMap.get(key);
        if (!mediaItem || mediaItem.type !== "photo") return null;

        return {
          type: "image",
          url: mediaItem.url || mediaItem.preview_image_url,
        } as TweetMedia;
      })
      .filter(Boolean);
  }

  function convertBasicTweet(tweetData: any): Tweet {
    return {
      text: tweetData.text,
      username: tweetData.author_id
        ? userMap.get(tweetData.author_id) || "unknown"
        : "unknown",
      createdAt: tweetData.created_at
        ? new Date(tweetData.created_at)
        : undefined,
      id: tweetData.id,
      engagement: tweetData.public_metrics,
      conversationId: tweetData.conversation_id,
      media: extractMedia(tweetData),
    };
  }

  const tweetContext: TweetWithContext = convertBasicTweet(tweet);

  // Handle referenced tweets (replies and quotes)
  if (tweet.referenced_tweets && referencedTweets) {
    for (const refTweet of tweet.referenced_tweets) {
      const referencedTweet = referencedTweets.get(refTweet.id);
      if (!referencedTweet) continue;

      const convertedReferencedTweet = convertBasicTweet(referencedTweet);

      if (refTweet.type === "replied_to") {
        tweetContext.replyToTweet = convertedReferencedTweet;
      } else if (refTweet.type === "quoted") {
        tweetContext.quotedTweet = convertedReferencedTweet;
      }
    }
  }

  return tweetContext;
}

// Update the conversion functions to pass media map
export function convertTimelineToTweets(
  timeline:
    | TweetUserTimelineV2Paginator
    | TweetUserMentionTimelineV2Paginator
    | TweetSearchRecentV2Paginator
): TweetWithContext[] {
  const referencedTweets = new Map(
    timeline.includes?.tweets?.map((t) => [t.id, t]) || []
  );
  const userMap = createUserMap(timeline.includes?.users);
  const mediaMap = new Map(
    timeline.includes?.media?.map((m) => [m.media_key, m]) || []
  );

  return timeline.tweets.map((tweet) =>
    convertTweetWithContext(tweet, referencedTweets, userMap, mediaMap)
  );
}

export function convertSingleTweet(
  tweet: TweetV2SingleResult
): TweetWithContext {
  const referencedTweets = new Map(
    tweet.includes?.tweets?.map((t) => [t.id, t]) || []
  );
  const userMap = createUserMap(tweet.includes?.users);
  const mediaMap = new Map(
    tweet.includes?.media?.map((m) => [m.media_key, m]) || []
  );

  return convertTweetWithContext(
    tweet.data,
    referencedTweets,
    userMap,
    mediaMap
  );
}

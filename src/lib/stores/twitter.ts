import TwitterApi, {
  TTweetv2Expansion,
  TTweetv2MediaField,
  TTweetv2TweetField,
  TweetPublicMetricsV2,
  TweetUserMentionTimelineV2Paginator,
  TweetUserTimelineV2Paginator,
  TweetV2SingleResult,
  UserV2,
} from "twitter-api-v2";
import { Repository } from "./repo";
import { anthropicSonnet } from "../clients/anthropic";
import { generateText } from "ai";
import { imageUrlToBase64 } from "../util/files";

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

export class TwitterTweetRepository
  implements Repository<string, void, TweetWithContext>
{
  constructor(private readonly twitterClient: TwitterApi) {}

  public async read(tweetId: string): Promise<TweetWithContext | null> {
    const tweet = await this.twitterClient.v2.singleTweet(tweetId, {
      ...DefaultFields,
    });
    return convertSingleTweet(tweet);
  }
}

export type TweetMedia = {
  type: "image";
  url: string;
  description?: string;
};

export type Tweet = {
  text: string;
  createdAt: string | undefined;
  username: string;
  id: string;
  engagement: TweetPublicMetricsV2 | undefined;
  media?: TweetMedia[];
};

export type TweetWithContext = Tweet & {
  replyToTweet?: Tweet;
  quotedTweet?: Tweet;
};

export type ITweetMediaHydrator = Repository<Tweet, null, Tweet>;

export class TweetMediaHydrator implements ITweetMediaHydrator {
  public constructor() {}

  public async read(tweet: Tweet): Promise<Tweet> {
    // iterate through each of the tweets, find the media, and if there's a URL without a description,
    // then use an LLM to create a description and attach it to that piece of media, only if the type is "photo"
    if (tweet.media) {
      for (const media of tweet.media) {
        if (media.type === "image" && !media.description) {
          const description = await this.generateDescription(media.url, tweet);
          media.description = description;
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

export class UserTweetsRepository
  implements Repository<string, null, TweetWithContext[]>
{
  public constructor(private readonly twitterClient: TwitterApi) {}

  public async read(userId: string): Promise<TweetWithContext[]> {
    try {
      const tweets = await this.twitterClient.v2.userTimeline(userId, {
        max_results: 5,
        start_time: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
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

      return convertTimelineToTweets(tweets);
    } catch (error) {
      console.error(`Error fetching tweets for ${userId}:`, error);
      return [];
    }
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
  console.log("media map");
  console.log(mediaMap);
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
      createdAt: tweetData.created_at,
      id: tweetData.id,
      engagement: tweetData.public_metrics,
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
  timeline: TweetUserTimelineV2Paginator | TweetUserMentionTimelineV2Paginator
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

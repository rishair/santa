import { twitterClient } from "../lib/clients/twitter";
// import { SantaBot } from "../lib/bot";
import { sdk } from "../lib/clients/langfuse";
import { mongoClient } from "../lib/clients/mongo";
import { ReplyAgent } from "../lib/agents/replyAgent";
import { CachingRepository, withErrorHandling } from "../lib/stores/repo";
import { EditorAgent } from "../lib/agents/editorAgent";
import {
  ITwitterUserMentionsRepository,
  MediaHydratingTweetRepository,
  SingleMediaHydratingTweetRepository,
  TweetMediaHydrator,
  TweetSearchRepository,
  TweetWithContext,
  TwitterTweetRepository,
  TwitterUserByScreenNameRepository,
  TwitterUserMentionsRepository,
  UserProfileRepository,
} from "../lib/stores/twitter";
import {
  ConversationThreadFinderRepository,
  ConversationUserRepliesRepository,
} from "../lib/stores/twitterConversation";
import { globals } from "../lib/util/globals";
import {
  CoinDetailsRepository,
  CoinPriceRepository,
} from "../lib/stores/coinmarketcap";
import { ConversationNaughtyOrNiceAgent } from "../lib/agents/analyzeProfile";
import { UserRepliesRepository } from "../lib/stores/user";
import { UserV2 } from "twitter-api-v2";
import { MongoQueue } from "../lib/stores/queue";
import { startWebServer } from "./webServer";

sdk.start();

const mockTweet: TweetWithContext = {
  text: "@santabot @rishair hey santa, what do you think about this guy?",
  createdAt: new Date(),
  username: "test_user",
  id: "test-tweet-id",
  conversationId: "test-conversation-id",
  engagement: {
    retweet_count: 0,
    reply_count: 0,
    like_count: 0,
    quote_count: 0,
    impression_count: 0,
  },
  replyToTweet: undefined,
  quotedTweet: {
    text: "I'm a nice guy, i swaer",
    createdAt: new Date(),
    username: "bobs_my_uncle",
    id: "test-tweet-id",
    conversationId: "test-conversation-id",
    engagement: {
      retweet_count: 0,
      reply_count: 0,
      like_count: 0,
      quote_count: 0,
      impression_count: 0,
    },
  },
};

const santaDb = mongoClient.db("santa");

const userProfileRepository = new CachingRepository(
  new UserProfileRepository(twitterClient),
  santaDb,
  { name: "userProfile" }
);

const userByScreenNameRepository = new CachingRepository(
  new TwitterUserByScreenNameRepository(twitterClient),
  santaDb,
  { name: "userByScreenName" }
);

// const userMentionsRepository = new CachingRepository(
//   new TwitterUserMentionsRepository(twitterClient),
//   santaDb,
//   { name: "userMentions" }
// );

const tweetMediaHydrator = new CachingRepository(
  new TweetMediaHydrator(),
  santaDb,
  { cacheKeyFn: (tweet) => "tweetMediaHydrator:" + tweet.id }
);

const userMentionsRepository = new MediaHydratingTweetRepository(
  new TwitterUserMentionsRepository(twitterClient),
  tweetMediaHydrator,
  true
);

const singleTweetRepository = new CachingRepository(
  new SingleMediaHydratingTweetRepository(
    new TwitterTweetRepository(twitterClient),
    tweetMediaHydrator
  ),
  santaDb,
  { cacheKeyFn: (tweetId) => "singleTweet:" + tweetId }
);

const tweetSearchRepository = new CachingRepository(
  new MediaHydratingTweetRepository(
    new TweetSearchRepository(twitterClient),
    tweetMediaHydrator,
    true
  ),
  santaDb,
  { cacheKeyFn: (query) => "tweetSearch:" + query }
);

const conversationThreadFinderRepository =
  new ConversationThreadFinderRepository(
    singleTweetRepository,
    tweetSearchRepository
  );

const conversationUserRepliesRepository = new ConversationUserRepliesRepository(
  tweetSearchRepository
);

const coinDetailsRepository = withErrorHandling(new CoinDetailsRepository());
const coinPriceRepository = withErrorHandling(new CoinPriceRepository());

const userRepliesRepository = new UserRepliesRepository(santaDb);

const replyAgent = new ReplyAgent(
  twitterClient,
  conversationThreadFinderRepository,
  new ConversationNaughtyOrNiceAgent(
    userProfileRepository,
    conversationUserRepliesRepository,
    coinDetailsRepository,
    coinPriceRepository
  ),
  new EditorAgent(),
  coinDetailsRepository,
  coinPriceRepository,
  userRepliesRepository
);

const tweetQueueRepository = new MongoQueue<string>(
  santaDb,
  "replyToTweetQueue"
);

export class SantaBot {
  private readonly INTERVAL_MS = 1 * 60 * 1000; // 1 minute
  private isRunning = false;

  constructor(
    private readonly user: UserV2,
    private readonly userMentionsRepository: ITwitterUserMentionsRepository,
    private readonly replyAgent: ReplyAgent,
    private readonly tweetQueueRepository: MongoQueue<string>
  ) {}

  public async start() {
    if (this.isRunning) {
      console.log("🎄 Bot is already running");
      return;
    }

    this.isRunning = true;
    await this.runLoop();
  }

  public stop() {
    this.isRunning = false;
    console.log("🎄 Bot stopped");
  }

  public async checkMentions() {
    const mentions = (await this.userMentionsRepository.read(this.user.id))!;

    // Add new mentions to the queue, skipping ones we've already replied to
    for (const mention of mentions) {
      const hasReplied = await userRepliesRepository.read(mention.id);
      if (!hasReplied) {
        console.log("🎄 Adding tweet to queue:", mention.id);
        await this.tweetQueueRepository.enqueue(mention.id);
      } else {
        console.log("🎄 Already replied to tweet:", mention.id);
      }
    }
  }

  private async processTweetQueue(attemptsLeft: number = 2) {
    const tweetId = await this.tweetQueueRepository.dequeue();
    if (!tweetId) {
      return;
    }

    try {
      const tweet = await singleTweetRepository.read(tweetId.value);
      const result = await this.replyAgent.generateReply(this.user, tweet);
      if (!result.newReply) {
        console.log("🎄 Already replied to tweet:", tweetId);
        console.log(result.text);
        return;
      }

      console.log("🎄 Reply:", result.text);
    } catch (error: any) {
      // Check if it's a rate limit error (429)
      if (error?.name === "ApiResponseError" && error?.code === 429) {
        console.error("🎄 Rate limit hit, will retry later:", error.message);
        // Re-queue the tweet to try again later
        await this.tweetQueueRepository.enqueue(tweetId.value);
      } else {
        // For permanent errors, store them so we don't retry
        console.error("🎄 Error processing tweet:", tweetId, error);
        await userRepliesRepository.updateError(
          tweetId.value,
          error.message || error.toString()
        );
      }

      // Try processing the next tweet if we have attempts left
      if (attemptsLeft > 1) {
        console.log(
          `🎄 Attempting to process next tweet (${
            attemptsLeft - 1
          } attempts left)`
        );
        await this.processTweetQueue(attemptsLeft - 1);
      }
    }
  }

  private async runLoop() {
    while (this.isRunning) {
      const currentMinute = new Date().getMinutes();
      try {
        if (currentMinute % 5 === 0) {
          console.log("🎄 Checking mentions");
          await this.checkMentions();
        }
        console.log("🎄 Processing tweet queue");
        await this.processTweetQueue(2); // Start with 2 attempts
      } catch (error) {
        console.error("🎄 Error in bot loop:", error);
      }
      await new Promise((resolve) => setTimeout(resolve, this.INTERVAL_MS));
    }
  }
}

async function main() {
  globals.set("cacheEnabled", true);
  globals.set("postTweet", true);

  // Start web server
  startWebServer();

  // Start bot
  const user = await userByScreenNameRepository.read("robosantahoho");
  const bot = new SantaBot(
    user,
    userMentionsRepository,
    replyAgent,
    tweetQueueRepository
  );

  await bot.start();
}

main();

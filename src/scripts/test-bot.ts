import { twitterClient } from "../lib/clients/twitter";
// import { SantaBot } from "../lib/bot";
import { sdk } from "../lib/clients/langfuse";
import { NaughtyOrNiceAgent } from "../lib/agents/analyzeProfile";
import { mongoClient } from "../lib/clients/mongo";
import { ReplyAgent } from "../lib/agents/replyAgent";
import { CachingRepository, MongoRepository } from "../lib/stores/repo";
import { EditorAgent } from "../lib/agents/editorAgent";
import {
  ITwitterUserMentionsRepository,
  MediaHydratingTweetRepository,
  SingleMediaHydratingTweetRepository,
  TweetMediaHydrator,
  TweetWithContext,
  TwitterTweetRepository,
  TwitterUserByScreenNameRepository,
  TwitterUserMentionsRepository,
  UserProfileRepository,
  UserTweetsRepository,
} from "../lib/stores/twitter";
import { globals } from "../lib/util/globals";

sdk.start();

const mockTweet: TweetWithContext = {
  text: "@santabot @rishair hey santa, what do you think about this guy?",
  createdAt: new Date().toISOString(),
  username: "test_user",
  id: "test-tweet-id",
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
    createdAt: new Date().toISOString(),
    username: "bobs_my_uncle",
    id: "test-tweet-id",
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

const userTweetsRepository = new CachingRepository(
  new UserTweetsRepository(twitterClient),
  santaDb,
  { name: "userTweets" }
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
  { name: "tweetMediaHydrator" }
);

const userMentionsRepository = new MediaHydratingTweetRepository(
  new TwitterUserMentionsRepository(twitterClient),
  tweetMediaHydrator,
  true
);

const replyAgent = new ReplyAgent(
  twitterClient,
  new NaughtyOrNiceAgent(userTweetsRepository, userProfileRepository),
  new EditorAgent()
);

const tweetsRepliedToRepository = new MongoRepository<string, void, boolean>(
  santaDb,
  "tweetsRepliedTo"
);

const singleTweetRepository = new CachingRepository(
  new SingleMediaHydratingTweetRepository(
    new TwitterTweetRepository(twitterClient),
    tweetMediaHydrator
  ),
  santaDb,
  { name: "singleTweet" }
);

export class SantaBot {
  private readonly INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private isRunning = false;

  constructor(
    private readonly userId: string,
    private readonly userMentionsRepository: ITwitterUserMentionsRepository,
    private readonly tweetsRepliedToRepository: MongoRepository<
      string,
      void,
      boolean
    >,
    private readonly replyAgent: ReplyAgent
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

  private async checkMentions() {
    const mentions = (await this.userMentionsRepository.read(this.userId))!;

    // Skip all tweets we've already seen before, and only process 1 tweet at a time.
    for (const mention of mentions) {
      // const tweetsRepliedTo = await this.tweetsRepliedToRepository.read(
      // mention.id
      // );
      const tweetsRepliedTo = false;
      if (tweetsRepliedTo) {
        console.log("🎄 Already replied to tweet:", mention.id);
        continue;
      }

      const reply = await this.replyAgent.generateReply(mention, true);
      await this.tweetsRepliedToRepository.store(mention.id, true);
      console.log("🎄 Reply:", reply);
      break;
    }
  }

  private async runLoop() {
    while (this.isRunning) {
      try {
        await this.checkMentions();
      } catch (error) {
        console.error("🎄 Error in bot loop:", error);
      }
      await new Promise((resolve) => setTimeout(resolve, this.INTERVAL_MS));
    }
  }
}

async function main() {
  const user = await userByScreenNameRepository.read("robosantahoho");
  const bot = new SantaBot(
    user.id,
    userMentionsRepository,
    tweetsRepliedToRepository,
    replyAgent
  );

  await bot.start();
}

// main();

async function test() {
  globals.set("cacheEnabled", false);
  const tweet = await singleTweetRepository.read("1865608256174825804");
  console.log(tweet);
}

test();

import { twitterClient } from "../lib/clients/twitter";
// import { SantaBot } from "../lib/bot";
import { sdk } from "../lib/clients/langfuse";
import { NaughtyOrNiceAgent } from "../lib/agents/analyzeProfile";
import { mongoClient } from "../lib/clients/mongo";
import { ReplyAgent } from "../lib/agents/replyAgent";
import { CachingRepository, TweetWithContext } from "../lib/stores/repo";
import { UserTweetsRepository } from "../lib/stores/repo";
import { UserProfileRepository } from "../lib/stores/repo";
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

async function testBot() {
  const userTweetsRepository = new CachingRepository(
    "userTweets",
    new UserTweetsRepository(twitterClient),
    mongoClient
  );
  const userProfileRepository = new CachingRepository(
    "userProfile",
    new UserProfileRepository(twitterClient),
    mongoClient
  );

  const replyAgent = new ReplyAgent(
    twitterClient,
    new NaughtyOrNiceAgent(
      twitterClient,
      userTweetsRepository,
      userProfileRepository
    )
  );
  const reply = await replyAgent.generateReply(mockTweet);
  console.log("🎄 Reply:", reply);

  // const bot = new SantaBot(twitterClient);
  // // const tweet = await bot.createTweet("thanksgiving");
  // const reply = await bot.replyToTweet("@santabot what are you smoking");
  // console.log("🎄 Reply:", reply);
  await sdk.shutdown();
}

testBot()
  .then(() => {
    console.log("✅ Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });

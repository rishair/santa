import {
  CoinDetailsRepository,
  CoinListRepository,
  CoinPriceRepository,
} from "../lib/stores/coinmarketcap";
import { twitterClient } from "../lib/clients/twitter";
import {
  TwitterUserByScreenNameRepository,
  UserOriginalTweetsAndRepliesRepository,
  TweetSearchRepository,
  TwitterTweetRepository,
  SingleMediaHydratingTweetRepository,
  TweetMediaHydrator,
  TwitterUserMentionsRepository,
  MediaHydratingTweetRepository,
} from "../lib/stores/twitter";
import { CachingRepository } from "../lib/stores/repo";

// const coinListRepository = new CoinListRepository();
// coinListRepository.read().then((coins) => {
//   console.log(coins);
// });

async function test() {
  const coinDetailsRepository = new CoinDetailsRepository();
  const details = await coinDetailsRepository.read("AIXBT");
  if (!details) {
    throw new Error("Coin details not found");
  }

  console.log(details);

  const coinPriceRepository = new CoinPriceRepository();
  const price = await coinPriceRepository.read(details.id.toString(), [
    "24h",
    "7d",
    "30d",
  ]);
  console.log(price);

  for (const period in price?.periods) {
    console.log(price?.periods[period].quote);
  }
}

async function testTwitterProfile() {
  const userByScreenNameRepository = new TwitterUserByScreenNameRepository(
    twitterClient
  );

  const user = await userByScreenNameRepository.read("DefiWimar");

  const userOriginalTweetsAndRepliesRepository =
    new UserOriginalTweetsAndRepliesRepository(twitterClient);

  const tweets = await userOriginalTweetsAndRepliesRepository.read(user!.id, {
    maxResults: 10,
  });
  console.log(tweets);
}

import { mongoClient } from "../lib/clients/mongo";
import { UserDirectMessagesRepository } from "../lib/stores/user";
const santaDb = mongoClient.db("santa");

async function testTweetMediaHydrator() {
  const tweetMediaHydrator = new TweetMediaHydrator();

  const singleTweetRepository = new SingleMediaHydratingTweetRepository(
    new TwitterTweetRepository(twitterClient),
    tweetMediaHydrator
  );

  const tweet = await singleTweetRepository.read("1865437367303114920");
  console.log(tweet);
}

// testTweetMediaHydrator();

async function testDirectMessages() {
  const userDirectMessagesRepository = new UserDirectMessagesRepository(
    twitterClient
  );
  const messages = await userDirectMessagesRepository.read();
  console.log(messages);
}

testDirectMessages();

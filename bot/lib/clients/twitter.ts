import { TwitterApi } from "twitter-api-v2";
import * as dotenv from "dotenv";
dotenv.config();

console.log("TWITTER_CLIENT_ID", process.env.TWITTER_CLIENT_ID);
console.log("TWITTER_CLIENT_SECRET", process.env.TWITTER_CLIENT_SECRET);

export const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_SANTA_OAUTH_TOKEN!,
  accessSecret: process.env.TWITTER_SANTA_OAUTH_SECRET!,
});

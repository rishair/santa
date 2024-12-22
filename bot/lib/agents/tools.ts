import { z } from "zod";
import { tool, CoreTool } from "ai";
import {
  CoinDetailsRepository,
  CoinPriceRepository,
} from "../stores/coinmarketcap";
import { ConversationNaughtyOrNiceAgent } from "./analyzeProfile";
import { TweetWithContext } from "../stores/twitter";
import { EditorAgent } from "./editorAgent";
import { TweetV2PostTweetResult, TwitterApi } from "twitter-api-v2";
import { globals } from "../util/globals";

const coinDetailsParams = z.object({
  symbol: z.string().describe("Coin symbol to get details about"),
});

export function createCoinDetailsTool(
  coinDetailsRepository: CoinDetailsRepository,
  coinPriceRepository: CoinPriceRepository
): CoreTool {
  return tool<typeof coinDetailsParams, string>({
    description:
      "Gets details about a coin, useful when someone mentions a coin using $<SYMBOL>",
    parameters: coinDetailsParams,
    execute: async (input) => {
      const details = await coinDetailsRepository.read(input.symbol);
      if (!details) {
        throw new Error(`Coin details not found for ${input.symbol}`);
      }
      const price = await coinPriceRepository.read(details.id.toString(), [
        "24h",
        "7d",
        "30d",
      ]);
      return JSON.stringify({ details, price });
    },
  });
}

const naughtyOrNiceParams = z.object({
  username: z.string().describe("Username of the user to analyze"),
});

export function createNaughtyOrNiceTool(
  naughtyOrNiceAgent: ConversationNaughtyOrNiceAgent,
  replyingTo: TweetWithContext,
  conversationRootThread: TweetWithContext[],
  replyBranchThread: TweetWithContext[],
  traceId: string
): CoreTool {
  return tool<typeof naughtyOrNiceParams, string>({
    description:
      "Determines whether a user has been naughty or nice in this conversation",
    parameters: naughtyOrNiceParams,
    execute: async (input) => {
      console.log("Analyzing profile:", input.username);
      const result = await naughtyOrNiceAgent.analyzeConversation(
        replyingTo,
        conversationRootThread,
        replyBranchThread,
        input.username,
        traceId
      );
      return result;
    },
  });
}

const sendTweetToEditorParams = z.object({
  tweet: z.string().describe("Draft tweet to be reviewed"),
});

export function createSendTweetToEditorTool(
  editorAgent: EditorAgent,
  replyingTo: TweetWithContext,
  traceId: string
): CoreTool {
  return tool<typeof sendTweetToEditorParams, string>({
    description: "Sends a draft tweet to an editor for review",
    parameters: sendTweetToEditorParams,
    execute: async (input) => {
      console.log("Sending tweet to editor:", input.tweet);
      const result = await editorAgent.editTweet(
        input.tweet,
        replyingTo,
        traceId
      );
      console.log("Editor result:", result);
      return result;
    },
  });
}

const postTweetParams = z.object({
  tweet: z.string().describe("Tweet to be posted"),
});

export function createPostTweetTool(
  twitterClient: TwitterApi,
  replyingTo: TweetWithContext
): CoreTool {
  return tool<
    typeof postTweetParams,
    { id: string; text: string; dryRun: boolean }
  >({
    description: "Posts a tweet to Twitter",
    parameters: postTweetParams,
    execute: async (input) => {
      if (!globals.get("postTweet")) {
        console.log("Dry run: would have posted tweet:", input.tweet);
        return {
          id: `dry-run-${Date.now()}`,
          text: input.tweet,
          dryRun: true,
        };
      }
      console.log("Posting tweet:", input.tweet);

      // Remove leading @ mentions from the tweet text
      const cleanedTweet = input.tweet.replace(/^(@\w+\s*)+/, "").trim();
      input.tweet = cleanedTweet;
      const tweet = await twitterClient.v2.tweet(input.tweet, {
        reply: { in_reply_to_tweet_id: replyingTo.id },
      });
      return {
        id: tweet.data.id,
        text: tweet.data.text,
        dryRun: false,
      };
    },
  });
}

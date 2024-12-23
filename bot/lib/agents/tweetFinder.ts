import { YamlReader } from "../util/yaml";
import { anthropicSonnet } from "../clients/anthropic";
import { CoreMessage, generateText, tool, CoreTool } from "ai";
import { langfuse } from "../clients/langfuse";
import { ITweetSearchRepository, TweetWithContext } from "../stores/twitter";
import { TweetSearchRepository } from "../stores/twitter";
import { printTweets } from "../util/tweets";
import { z } from "zod";

const replyToTweetsParams = z.object({
  tweets: z.array(
    z.object({
      tweet_id: z
        .string()
        .describe("The ID of the tweet that is worth responding to"),
      reason: z
        .string()
        .describe("The reason why the tweet is interesting to respond to"),
    })
  ),
});

export function createReplyToTweetsTool(
  callback: (input: z.infer<typeof replyToTweetsParams>) => void
): CoreTool {
  return tool<typeof replyToTweetsParams, string>({
    description: "Call this when you find tweets that are worth responding to",
    parameters: replyToTweetsParams,
    execute: async (input) => {
      callback(input);
      return (
        "Logged tweets: " +
        input.tweets.map((tweet) => tweet.tweet_id).join(",")
      );
    },
  });
}

interface TweetWithContextAndReason {
  tweet: TweetWithContext;
  reason: string;
}

export class TweetFinder {
  private finderDetails: YamlReader;

  constructor(private tweetSearchRepository: ITweetSearchRepository) {
    this.finderDetails = new YamlReader("prompts/find_tweets.yaml");
  }

  public async findInterestingTweets(
    searchQuery: string,
    traceId: string,
    options: { max_results?: number } = {}
  ): Promise<TweetWithContextAndReason[]> {
    langfuse.trace({
      id: traceId,
      name: "tweetFinder",
    });

    const tweets = await this.tweetSearchRepository.read(
      `(${searchQuery}) -is:retweet -is:reply`,
      {
        max_results: options.max_results || 15,
      }
    );

    if (!tweets || tweets.length === 0) {
      return [];
    }

    const messages: CoreMessage[] = this.finderDetails.getPrompt("prompt", {
      candidate_tweets: printTweets(tweets, {
        includeReplyTo: true,
        includeEngagement: true,
        includeTweetId: true,
      }),
    });

    let selectedTweets: TweetWithContextAndReason[] = [];

    await generateText({
      model: anthropicSonnet,
      messages: messages,
      temperature: 0.1,
      tools: {
        reply_to_tweets: createReplyToTweetsTool((tw) => {
          selectedTweets = tw.tweets.map((t) => ({
            tweet: tweets.find((tweet) => tweet.id === t.tweet_id)!,
            reason: t.reason,
          }));
        }),
      },
      maxSteps: 3,
      toolChoice: "auto",
      experimental_telemetry: {
        isEnabled: true,
        functionId: "findTweets",
        metadata: {
          langfuseTraceId: traceId,
        },
      },
    });

    return selectedTweets;
  }
}

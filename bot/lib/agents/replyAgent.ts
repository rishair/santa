import { TwitterApi, UserV2 } from "twitter-api-v2";
import { YamlReader } from "../util/yaml";
import { anthropicSonnet } from "../clients/anthropic";
import { generateText } from "ai";
import { langfuse } from "../clients/langfuse";
import { ConversationNaughtyOrNiceAgent } from "./analyzeProfile";
import { ConversationThreadFinderRepository } from "../stores/twitterConversation";
import { Tweet, TweetWithContext } from "../stores/twitter";
import { EditorAgent } from "./editorAgent";
import { printTweet, printTweets } from "../util/tweets";
import { globals } from "../util/globals";
import {
  createCoinDetailsTool,
  createGetInteractionHistoryTool,
  createNaughtyOrNiceTool,
  createPostTweetTool,
  createSendTweetToEditorTool,
} from "./tools";
import {
  CoinDetailsRepository,
  CoinPriceRepository,
} from "../stores/coinmarketcap";
import { UserRepliesRepository } from "../stores/user";
export class ReplyAgent {
  private replyDetails: YamlReader;
  constructor(
    private readonly twitterClient: TwitterApi,
    private readonly conversationThreadFinderRepository: ConversationThreadFinderRepository,
    private readonly naughtyOrNiceAgent: ConversationNaughtyOrNiceAgent,
    private readonly editorAgent: EditorAgent,
    private readonly coinDetailsRepository: CoinDetailsRepository,
    private readonly coinPriceRepository: CoinPriceRepository,
    private readonly userRepliesRepository: UserRepliesRepository
  ) {
    this.replyDetails = new YamlReader("prompts/reply.yaml");
  }

  public async generateReply(
    user: UserV2,
    tweet: TweetWithContext
  ): Promise<{
    text: string;
    tweetId: string;
    newReply: boolean;
  }> {
    const traceId = crypto.randomUUID();
    langfuse.trace({
      id: traceId,
      name: "generateReply",
    });

    const prevReply = await this.userRepliesRepository.read(tweet.id);
    if (prevReply && globals.get("skipRead")) {
      return {
        text: prevReply.replyTweet.text,
        tweetId: prevReply.replyTweet.id,
        newReply: false,
      };
    }

    const threads = await this.conversationThreadFinderRepository.read(tweet);

    const prevInteractions = await this.userRepliesRepository.findByUsernames(
      threads.replyBranchThread.map((t) => t.username)
    );

    console.log("Getting prompt messages...");
    const processedMessages = this.replyDetails.getPrompt("prompt", {
      user_tweet: printTweet(tweet, { includeReplyTo: false }),
      previous_interactions:
        prevInteractions.length > 0
          ? prevInteractions
              .slice(0, 4)
              .map(
                (r) =>
                  `<conversation>${printTweets(r.replyBranchThread, {
                    includeReplyTo: false,
                  })}</conversation>`
              )
              .join("\n")
          : "None",
      conversation_root_thread: printTweets(threads.conversationRootThread, {
        includeReplyTo: false,
      }),
      reply_branch_thread: printTweets(threads.replyBranchThread, {
        includeReplyTo: false,
      }),
    });

    let postTweetResult:
      | { id: string; text: string; dryRun: boolean }
      | undefined;
    const result = await generateText({
      model: anthropicSonnet,
      messages: processedMessages,
      temperature: 0.7,
      tools: {
        coinDetails: createCoinDetailsTool(
          this.coinDetailsRepository,
          this.coinPriceRepository
        ),
        naughtyOrNice: createNaughtyOrNiceTool(
          this.naughtyOrNiceAgent,
          tweet,
          threads.conversationRootThread,
          threads.replyBranchThread,
          traceId
        ),
        sendTweetToEditor: createSendTweetToEditorTool(
          this.editorAgent,
          tweet,
          traceId
        ),
        postTweet: createPostTweetTool(this.twitterClient, tweet),
        getInteractionHistory: createGetInteractionHistoryTool(
          this.userRepliesRepository
        ),
      },
      onStepFinish: ({ toolResults }) => {
        toolResults.forEach((toolResult: { toolName: string; result: any }) => {
          if (toolResult.toolName === "postTweet") {
            postTweetResult = toolResult.result as {
              id: string;
              text: string;
              dryRun: boolean;
            };
          }
        });
      },
      maxSteps: 10,
      maxTokens: 3000,
      toolChoice: "auto",
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generateReply",
        metadata: {
          langfuseTraceId: traceId,
        },
      },
    });

    if (postTweetResult && !postTweetResult.dryRun) {
      const newTweet: Tweet = {
        id: postTweetResult.id,
        text: postTweetResult.text,
        username: user.username,
        createdAt: new Date(),
        conversationId: tweet.conversationId,
        engagement: undefined,
        media: undefined,
      };

      this.userRepliesRepository.store({
        replyToTweetId: tweet.id,
        replyTweet: newTweet,
        usernames: threads.replyBranchThread.map((tweet) => tweet.username),
        replyBranchThread: threads.replyBranchThread.concat(newTweet),
        conversationRootThread: threads.conversationRootThread,
        createdAt: new Date(),
      });
    }

    return {
      text: postTweetResult?.text || "",
      tweetId: postTweetResult?.id || "",
      newReply: true,
    };
  }
}

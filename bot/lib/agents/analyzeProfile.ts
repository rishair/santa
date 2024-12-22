import { UserV2 } from "twitter-api-v2";
import { YamlReader } from "../util/yaml";
import { anthropicSonnet } from "../clients/anthropic";
import { CoreMessage, generateText } from "ai";
import { langfuse } from "../clients/langfuse";
import { Repository } from "../stores/repo";
import {
  IUserOriginalTweetsAndRepliesRepository,
  TweetWithContext,
} from "../stores/twitter";
import { printTweets } from "../util/tweets";
import { ConversationUserRepliesRepository } from "../stores/twitterConversation";
import { createCoinDetailsTool } from "./tools";
import {
  CoinDetailsRepository,
  CoinPriceRepository,
} from "../stores/coinmarketcap";
export class NaughtyOrNiceAgent {
  private judgeDetails: YamlReader;

  constructor(
    private readonly userTweetsRepository: IUserOriginalTweetsAndRepliesRepository,
    private readonly userProfileRepository: Repository<string, null, UserV2>
  ) {
    this.judgeDetails = new YamlReader("prompts/analyze.yaml");
  }

  public async analyzeProfile(
    username: string,
    traceId?: string
  ): Promise<string> {
    if (!traceId) {
      traceId = crypto.randomUUID();
    }
    langfuse.trace({
      id: traceId,
      name: "analyzeProfile",
    });

    const tweets = await this.userTweetsRepository.read(username, {
      maxResults: 50,
    });

    // Get user profile info
    const userInfo = await this.userProfileRepository.read(username);

    const messages: CoreMessage[] = this.judgeDetails.getPrompt("prompt", {
      user_profile: JSON.stringify(userInfo),
      user_tweets: JSON.stringify(tweets),
    });

    const result = await generateText({
      model: anthropicSonnet,
      messages: messages,
      temperature: 0.1,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "analyzeProfile",
        metadata: {
          langfuseTraceId: traceId,
        },
      },
    });

    return result.text;
  }
}

export class ConversationNaughtyOrNiceAgent {
  private analyzePrompt: YamlReader;

  constructor(
    private readonly userProfileRepository: Repository<string, null, UserV2>,
    private readonly convoRepliesRepository: ConversationUserRepliesRepository,
    private readonly coinDetailsRepository: CoinDetailsRepository,
    private readonly coinPriceRepository: CoinPriceRepository
  ) {
    this.analyzePrompt = new YamlReader("prompts/analyze_conversation.yaml");
  }

  public async analyzeConversation(
    tweet: TweetWithContext,
    conversationRootThread: TweetWithContext[],
    replyBranchThread: TweetWithContext[],
    username: string,
    traceId: string
  ): Promise<string> {
    const tweets = await this.convoRepliesRepository.read({
      conversationId: tweet.conversationId,
      username,
    });

    const userInfo = await this.userProfileRepository.read(username);

    let tweetString = "";

    tweetString += `<replyBranchThread>${printTweets(
      replyBranchThread,
      false
    )}</replyBranchThread>`;

    tweetString += `<conversationRootThread>${printTweets(
      conversationRootThread,
      false
    )}</conversationRootThread>`;

    tweetString += `<repliesToOthers>${printTweets(
      tweets.repliesToOthers,
      true
    )}</repliesToOthers>`;

    tweetString += `<repliesFromOthers>${printTweets(
      tweets.repliesFromOthers,
      false
    )}</repliesFromOthers>`;

    const messages = this.analyzePrompt.getPrompt("prompt", {
      user_profile: JSON.stringify(userInfo),
      conversation: tweetString,
    });

    const result = await generateText({
      model: anthropicSonnet,
      messages: messages,
      temperature: 0.1,
      tools: {
        coinDetails: createCoinDetailsTool(
          this.coinDetailsRepository,
          this.coinPriceRepository
        ),
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: "analyzeConversation",
        metadata: {
          langfuseTraceId: traceId,
        },
      },
    });

    return result.text;
  }
}

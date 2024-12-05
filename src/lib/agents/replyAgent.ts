import { TwitterApi } from "twitter-api-v2";
import { YamlReader } from "../util/yaml";
import { anthropicSonnet } from "../clients/anthropic";
import { generateText, CoreTool, tool } from "ai";
import { langfuse } from "../clients/langfuse";
import { NaughtyOrNiceAgent } from "./analyzeProfile";
import { z } from "zod";
import { TweetWithContext } from "../stores/repo";

export class ReplyAgent {
  private replyDetails: YamlReader;
  private tools: Record<string, CoreTool>;

  constructor(
    private readonly twitterClient: TwitterApi,
    private readonly naughtyOrNiceAgent: NaughtyOrNiceAgent
  ) {
    this.replyDetails = new YamlReader("src/prompts/reply.yaml");
    this.tools = this.createTools(naughtyOrNiceAgent);
  }

  private createTools(
    naughtyOrNiceAgent: NaughtyOrNiceAgent
  ): Record<string, CoreTool> {
    const naughtyOrNiceParams = z.object({
      username: z.string().describe("Twitter username to analyze"),
    });

    const sendTweetToEditorParams = z.object({
      tweet: z.string().describe("Draft tweet to be reviewed"),
    });

    const postTweetParams = z.object({
      tweet: z.string().describe("Tweet to be posted"),
    });

    return {
      naughtyOrNice: tool<typeof naughtyOrNiceParams, string>({
        description:
          "Determines if someone is naughty or nice based on their profile",
        parameters: z.object({
          username: z.string().describe("Twitter username to analyze"),
        }),
        execute: async (input) => {
          console.log("Analyzing profile:", input.username);
          const result = await naughtyOrNiceAgent.analyzeProfile(
            input.username
          );
          return result;
        },
      }),
      sendTweetToEditor: tool<typeof sendTweetToEditorParams, string>({
        description: "Sends a draft tweet to an editor for review",
        parameters: z.object({
          tweet: z.string().describe("Draft tweet to be reviewed"),
        }),
        execute: async (input) => {
          console.log("Sending tweet to editor:", input.tweet);
          await new Promise((resolve) => setTimeout(resolve, 100));
          return "test";
        },
      }),
      postTweet: tool<typeof postTweetParams, string>({
        description: "Posts a tweet to Twitter",
        parameters: postTweetParams,
        execute: async (input) => {
          console.log("Posting tweet:", input.tweet);

          await new Promise((resolve) => setTimeout(resolve, 100));
          return "test";
        },
      }),
    };
  }

  public async generateReply(tweet: TweetWithContext): Promise<string> {
    const traceId = crypto.randomUUID();
    langfuse.trace({
      id: traceId,
      name: "generateReply",
    });

    console.log("Getting santa_bio...");
    const santaBio = this.replyDetails.get("santa_bio");
    console.log("Santa bio:", santaBio);

    console.log("Getting prompt messages...");
    const processedMessages = this.replyDetails.getPrompt("prompt", {
      santa_bio: santaBio,
      user_tweet: JSON.stringify(tweet),
    });

    console.log(
      "Final messages to send:",
      JSON.stringify(processedMessages, null, 2)
    );

    if (!processedMessages || processedMessages.length === 0) {
      throw new Error("No messages generated from prompt");
    }

    const result = await generateText({
      model: anthropicSonnet,
      messages: processedMessages,
      temperature: 0.7,
      tools: this.tools,
      maxSteps: 6,
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

    return result.text;
  }
}

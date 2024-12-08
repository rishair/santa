import { TwitterApi } from "twitter-api-v2";
import { YamlReader } from "../util/yaml";
import { anthropicSonnet } from "../clients/anthropic";
import { generateText, CoreTool, tool } from "ai";
import { langfuse } from "../clients/langfuse";
import { NaughtyOrNiceAgent } from "./analyzeProfile";
import { z } from "zod";
import { TweetWithContext } from "../stores/twitter";
import { EditorAgent } from "./editorAgent";

export class ReplyAgent {
  private replyDetails: YamlReader;
  constructor(
    private readonly twitterClient: TwitterApi,
    private readonly naughtyOrNiceAgent: NaughtyOrNiceAgent,
    private readonly editorAgent: EditorAgent
  ) {
    this.replyDetails = new YamlReader("src/prompts/reply.yaml");
  }

  private createTools(
    replyingTo: TweetWithContext,
    dryRun: boolean,
    traceId: string
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
          const result = await this.naughtyOrNiceAgent.analyzeProfile(
            input.username,
            traceId
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
          const result = await this.editorAgent.editTweet(
            input.tweet,
            replyingTo,
            traceId
          );
          console.log("Editor result:", result);
          return result;
        },
      }),
      postTweet: tool<typeof postTweetParams, string>({
        description: "Posts a tweet to Twitter",
        parameters: postTweetParams,
        execute: async (input) => {
          if (dryRun) {
            console.log("Dry run: would have posted tweet:", input.tweet);
            return "tweet would have been posted!";
          }
          console.log("Posting tweet:", input.tweet);
          await this.twitterClient.v2.tweet(input.tweet, {
            reply: {
              in_reply_to_tweet_id: replyingTo.id,
            },
          });
          return "tweet posted!";
        },
      }),
    };
  }

  public async generateReply(
    tweet: TweetWithContext,
    dryRun: boolean = false
  ): Promise<string> {
    const traceId = crypto.randomUUID();
    langfuse.trace({
      id: traceId,
      name: "generateReply",
    });

    const tools = this.createTools(tweet, dryRun, traceId);

    console.log("Getting prompt messages...");
    const processedMessages = this.replyDetails.getPrompt("prompt", {
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
      tools: tools,
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

    return result.text;
  }
}

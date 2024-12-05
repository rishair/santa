import { TwitterApi } from "twitter-api-v2";
import { YamlReader } from "./util/yaml";
import { anthropicSonnet } from "./clients/anthropic";
import { CoreMessage, generateText, CoreTool } from "ai";
import { z } from "zod";
import { langfuse } from "./clients/langfuse";

type Critique = {
  critique: string;
  tweet: string;
};

type Telemetry = {
  isEnabled: boolean;
  functionId: string;
  metadata?: Record<string, any>;
};

function getTelemetryMetadata(
  functionId: string,
  traceId: string | undefined = undefined
): Telemetry {
  return {
    isEnabled: true,
    functionId: functionId,
    metadata: {
      langfuseTraceId: traceId,
    },
  };
}

// TODO: Set up AI observability to be able to iterate on the prompts
export class SantaBot {
  private foundationalSections = [
    "goal",
    "backstory",
    "status",
    "superpowers",
    "personality",
    "perspective",
    "style",
  ];
  private santaDetails: YamlReader;
  private judgeDetails: YamlReader;
  constructor(private readonly twitterClient: TwitterApi) {
    this.twitterClient = twitterClient;

    this.santaDetails = new YamlReader("src/prompts/santa.yaml");
    this.judgeDetails = new YamlReader("src/prompts/judge.yaml");
    this.santaDetails.setVariables({
      days_till_christmas: Math.ceil(
        (new Date("2024-12-25").getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      ).toString(),
      time_of_day: new Date().getHours().toString(),
      hunger: "satiated",
      location: "north pole",
    });
  }

  public async createTweet(prompt: string) {
    const traceId = crypto.randomUUID();
    langfuse.trace({
      id: traceId,
      name: "createTweet",
    });
    const generatedTweet = await this.generateTweet(prompt, undefined, traceId);
    const judgedTweet = await this.judgeTweet(
      generatedTweet,
      undefined,
      traceId
    );
    const finalTweet = await this.generateTweet(
      generatedTweet,
      {
        tweet: generatedTweet,
        critique: judgedTweet,
      },
      traceId
    );
    return finalTweet;
  }

  private async generateTweet(
    prompt: string,
    critique: Critique | undefined = undefined,
    traceId: string | undefined = undefined
  ) {
    const messages: CoreMessage[] = [
      {
        role: "system",
        content: this.santaDetails.getWrapped([
          ...this.foundationalSections,
          "judge_criteria",
          "instructions_generate",
        ]),
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    if (critique) {
      messages.push({
        role: "user",
        content: critique.tweet,
      });
      messages.push({
        role: "assistant",
        content: this.santaDetails.getWrapped(
          ["instructions_generate_with_critique"],
          { critique: critique.critique }
        ),
      });
    }

    const generatedTweet = await generateText({
      model: anthropicSonnet,
      messages: messages,
      temperature: 0.5,
      experimental_telemetry: getTelemetryMetadata("generateTweet", traceId),
    });

    return generatedTweet.text;
  }

  public async replyToTweet(tweet: string) {
    const traceId = crypto.randomUUID();
    langfuse.trace({
      id: traceId,
      name: "replyToTweet",
    });
    const replyTweet = await this.generateReplyTweet(tweet, undefined, traceId);
    const critique = await this.judgeTweet(
      replyTweet,
      { replyToTweet: tweet },
      traceId
    );
    const finalTweet = await this.generateReplyTweet(
      tweet,
      {
        critique: critique,
        tweet: replyTweet,
      },
      traceId
    );
    return finalTweet;
  }

  public async generateReplyTweet(
    replyToTweet: string,
    critique: Critique | undefined = undefined,
    traceId: string | undefined = undefined
  ) {
    const judgeUserTool: CoreTool = {
      description: "determine how naughty or nice a user has been",
      parameters: z.object({
        username: z.string().describe("the username of the user to judge"),
      }),
      execute: async (input) => {
        return await this.judgeUser(input.username, traceId);
      },
    };

    const messages: CoreMessage[] = [
      {
        role: "system",
        content: this.santaDetails.getWrapped([
          ...this.foundationalSections,
          "instructions_reply",
        ]),
      },
      {
        role: "user",
        content: `<tweet_to_respond_to><author>@abx</author>${replyToTweet}</tweet_to_respond_to>`,
      },
    ];

    if (critique) {
      messages.push({
        role: "assistant",
        content: critique.tweet,
      });
      messages.push({
        role: "user",
        content: this.santaDetails.getWrapped(
          ["instructions_generate_with_critique"],
          { critique: critique.critique }
        ),
      });
    }

    const result = await generateText({
      model: anthropicSonnet,
      messages: messages,
      temperature: 0.3,
      experimental_telemetry: getTelemetryMetadata("replyToTweet", traceId),
      tools: {
        judge_user: judgeUserTool,
      },
      maxSteps: 4,
    });

    return result.text;
  }

  private async judgeTweet(
    tweet: string,
    options: { replyToTweet: string } | undefined = undefined,
    traceId: string | undefined = undefined
  ) {
    const userStr = options?.replyToTweet
      ? `<reply_to_tweet><author>@abx</author>${options.replyToTweet}</reply_to_tweet><tweet>${tweet}</tweet>`
      : `<tweet>${tweet}</tweet>`;
    const result = await generateText({
      model: anthropicSonnet,
      messages: [
        {
          role: "system",
          content: this.judgeDetails.getWrapped([
            "goal",
            "personality",
            "perspective",
            "style",
            "judge_criteria",
            "instructions",
          ]),
        },
        {
          role: "user",
          content: userStr,
        },
      ],
      temperature: 0.0,
      experimental_telemetry: getTelemetryMetadata("judgeTweet", traceId),
    });

    return result.text;
  }

  private async judgeUser(username: string, traceId: string | undefined) {
    return `${username} is a "nice" person. he has been doling out advice about crypto and the stock market.`;
  }
}

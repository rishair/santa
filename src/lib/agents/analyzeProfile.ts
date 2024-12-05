import { TwitterApi, UserV2 } from "twitter-api-v2";
import { YamlReader } from "../util/yaml";
import { anthropicSonnet } from "../clients/anthropic";
import { CoreMessage, generateText } from "ai";
import { langfuse } from "../clients/langfuse";
import { Repository, TweetWithContext } from "../stores/repo";

export class NaughtyOrNiceAgent {
  private judgeDetails: YamlReader;

  constructor(
    private readonly twitterClient: TwitterApi,
    private readonly userTweetsRepository: Repository<
      string,
      TweetWithContext[]
    >,
    private readonly userProfileRepository: Repository<string, UserV2>
  ) {
    this.judgeDetails = new YamlReader("src/prompts/judge.yaml");
  }

  public async analyzeProfile(username: string): Promise<string> {
    const traceId = crypto.randomUUID();
    langfuse.trace({
      id: traceId,
      name: "analyzeProfile",
    });

    // Fetch recent tweets (last 100)
    const tweets = await this.userTweetsRepository.read(username);

    // Get user profile info
    const userInfo = await this.userProfileRepository.read(username);

    const userString = this.constructUserString(userInfo!);
    const tweetsString = this.constructTweetsString(tweets!);
    const messages: CoreMessage[] = [
      {
        role: "system",
        content: this.judgeDetails.get("prompt", {
          user_profile: userString,
          user_tweets: tweetsString,
        }),
      },
    ];

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

  private constructUserString(userInfo: UserV2): string {
    return `<user>
    <bio>${userInfo?.description || "No bio available"}</bio>
    <location>${userInfo?.location || "No location available"}</location>
    <url>${userInfo?.url || "No URL available"}</url>
    <metrics>Followers: ${
      userInfo?.public_metrics?.followers_count || 0
    }, Following: ${userInfo?.public_metrics?.following_count || 0}, Tweets: ${
      userInfo?.public_metrics?.tweet_count || 0
    }, Listed: ${userInfo?.public_metrics?.listed_count || 0}, Likes: ${
      userInfo?.public_metrics?.like_count || 0
    }</metrics>
      </user>\n`;
  }

  private constructTweetsString(tweets: TweetWithContext[]): string {
    return tweets
      .slice(0, 10)
      .map((tweet) => {
        let tweetText = `<tweet>@${tweet.username}: ${tweet.text}`;
        if (tweet.replyToTweet) {
          tweetText += `\n<replying_to>@${tweet.replyToTweet.username}: ${tweet.replyToTweet.text}</reply>`;
        }
        if (tweet.quotedTweet) {
          tweetText += `\n<quoted_tweet>@${tweet.quotedTweet.username}: ${tweet.quotedTweet.text}</quoted_tweet>`;
        }
        tweetText += `\n<engagement>Replies: ${
          tweet.engagement?.reply_count || 0
        }, Likes: ${tweet.engagement?.like_count || 0}, Quotes: ${
          tweet.engagement?.quote_count || 0
        }, Retweets: ${tweet.engagement?.retweet_count || 0}</engagement>`;
        tweetText += "</tweet>";
        return tweetText;
      })
      .join("\n\n");
  }
}

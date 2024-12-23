import { UserV2 } from "twitter-api-v2";
import { YamlReader } from "../util/yaml";
import { anthropicSonnet } from "../clients/anthropic";
import { CoreMessage, generateText } from "ai";
import { langfuse } from "../clients/langfuse";
import { TweetWithContext } from "../stores/twitter";
import { UserRepliesRepository } from "../stores/user";

export class EditorAgent {
  private editorDetails: YamlReader;

  constructor(private userRepliesRepository: UserRepliesRepository) {
    this.editorDetails = new YamlReader("prompts/editor.yaml");
  }

  public async editTweet(
    tweet: string,
    replyingTo?: TweetWithContext,
    traceId?: string
  ): Promise<string> {
    if (!traceId) {
      traceId = crypto.randomUUID();
    }
    langfuse.trace({
      id: traceId,
      name: "tweetEditor",
    });

    const prevInteractions = await this.userRepliesRepository.getLatestTweets();

    const latestTweets = prevInteractions.map((r) => r.replyTweet);

    const messages: CoreMessage[] = this.editorDetails.getPrompt("prompt", {
      tweet_text: tweet,
      replying_to: JSON.stringify(replyingTo),
      latest_replies: JSON.stringify(latestTweets),
    });

    const result = await generateText({
      model: anthropicSonnet,
      messages: messages,
      temperature: 0.1,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "editTweet",
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

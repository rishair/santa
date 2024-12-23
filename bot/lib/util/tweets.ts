import { TweetWithContext } from "../stores/twitter";

export function printTweet(
  tweet: TweetWithContext,
  options: PrintTweetOptions = DefaultPrintTweetOptions
) {
  const media = tweet.media
    ?.map(
      (m) =>
        `<media url="${m.url}"><description>${m.description}</description></media>`
    )
    .join("");

  const engagement = options.includeEngagement
    ? `<engagement>Replies: ${tweet.engagement?.reply_count || 0}, Likes: ${
        tweet.engagement?.like_count || 0
      }, Quotes: ${tweet.engagement?.quote_count || 0}, Retweets: ${
        tweet.engagement?.retweet_count || 0
      }</engagement>`
    : "";

  const quotedTweet = tweet.quotedTweet
    ? `<quoted_tweet>@${tweet.quotedTweet.username}: ${tweet.quotedTweet.text}</quoted_tweet>`
    : "";

  const tweetId = options.includeTweetId
    ? `<tweet_id>${tweet.id}</tweet_id>`
    : "";

  return `<tweet>
    ${tweetId}
    <username>${tweet.username}</username>
    <text>${tweet.text}</text>
    ${
      options.includeReplyTo && tweet.replyToTweet
        ? `<replyTo>
      <username>${tweet.replyToTweet?.username}</username>
      <text>${tweet.replyToTweet?.text}</text>
      </replyTo>`
        : ""
    }
    ${quotedTweet}
    ${media || ""}
    ${engagement}
    </tweet>`;
}

export type PrintTweetOptions = {
  includeReplyTo?: boolean;
  includeEngagement?: boolean;
  includeTweetId?: boolean;
};

export const DefaultPrintTweetOptions: PrintTweetOptions = {
  includeReplyTo: true,
  includeEngagement: false,
  includeTweetId: false,
};

export function printTweets(
  tweets: TweetWithContext[],
  options: PrintTweetOptions = DefaultPrintTweetOptions
) {
  return tweets.map((t) => printTweet(t, options)).join("\n");
}

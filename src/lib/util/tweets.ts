import { TweetWithContext } from "../stores/twitter";

export function printTweet(tweet: TweetWithContext, includeReplyTo?: boolean) {
  const media = tweet.media
    ?.map(
      (m) =>
        `<media url="${m.url}"><description>${m.description}</description></media>`
    )
    .join("");
  return `<tweet>
    <username>${tweet.username}</username>
    <text>${tweet.text}</text>
    ${
      includeReplyTo && tweet.replyToTweet
        ? `<replyTo>
      <username>${tweet.replyToTweet?.username}</username>
      <text>${tweet.replyToTweet?.text}</text>
      </replyTo>`
        : ""
    } ${media || ""}
    </tweet>`;
}

export function printTweets(
  tweets: TweetWithContext[],
  includeReplyTo?: boolean
) {
  return tweets.map((t) => printTweet(t, includeReplyTo)).join("\n");
}

import { Repository } from "./repo";
import { ITweetRepository } from "./twitter";
import { ITweetSearchRepository } from "./twitter";
import { DefaultFields } from "./twitter";
import { TweetWithContext } from "./twitter";

// Shared utilities
export class TweetUtils {
  static extractUsersFromTweet(tweet: TweetWithContext): string[] {
    return (
      tweet.text.match(/@(\w+)/g)?.map((u) => u.substring(1)) || []
    ).concat(tweet.username);
  }

  static constructReplyBranch(tweet: TweetWithContext): TweetWithContext[] {
    const branch: TweetWithContext[] = [];
    let currentTweet: TweetWithContext | undefined = tweet;
    while (currentTweet) {
      branch.unshift(currentTweet);
      currentTweet = currentTweet.replyToTweet;
    }
    return branch;
  }

  static connectTweets(
    tweetIdsToTweet: Record<string, TweetWithContext>
  ): void {
    // Add missing reply-to tweets to the map
    Object.keys(tweetIdsToTweet).forEach((id) => {
      const tweet = tweetIdsToTweet[id];
      if (tweet.replyToTweet && !tweetIdsToTweet[tweet.replyToTweet.id]) {
        tweetIdsToTweet[tweet.replyToTweet.id] = tweet.replyToTweet;
      }
    });

    // Connect all tweets to their replies
    Object.keys(tweetIdsToTweet).forEach((id) => {
      const tweet = tweetIdsToTweet[id];
      const replyTo = tweet.replyToTweet;
      if (replyTo?.id) {
        const replyToTweet = tweetIdsToTweet[replyTo?.id];
        if (replyToTweet) tweet.replyToTweet = replyToTweet;
      }
    });
  }
}

// First Repository: Thread Finder
export type ThreadFinderResult = {
  replyBranchThread: TweetWithContext[];
  conversationRootThread: TweetWithContext[];
};

export class ConversationThreadFinderRepository
  implements Repository<TweetWithContext, null, ThreadFinderResult>
{
  public constructor(
    private readonly tweetRepository: ITweetRepository,
    private readonly tweetSearchRepository: ITweetSearchRepository
  ) {}

  public async read(tweet: TweetWithContext): Promise<ThreadFinderResult> {
    const usersFromTweet = TweetUtils.extractUsersFromTweet(tweet);
    const tweetIdsToTweet: Record<string, TweetWithContext> = {};

    const rootTweet = await this.tweetRepository.read(tweet.conversationId);
    console.log("🎄 Root tweet:", rootTweet);
    if (!rootTweet) {
      throw new Error("Root tweet not found");
    }
    tweetIdsToTweet[rootTweet.id] = rootTweet;

    const currentBranchQuery =
      `conversation_id:${tweet.conversationId} ` +
      "(" +
      usersFromTweet?.map((u) => `from:${u}`).join(" OR ") +
      ") (" +
      usersFromTweet?.map((u) => `to:${u}`).join(" OR ") +
      " OR -is:reply)";

    const currentBranchTweets =
      (await this.tweetSearchRepository.read(currentBranchQuery, {
        max_results: 20,
        ...DefaultFields,
      })) || [];

    currentBranchTweets.forEach((t) => (tweetIdsToTweet[t.id] = t));
    TweetUtils.connectTweets(tweetIdsToTweet);

    const replyBranchThread = TweetUtils.constructReplyBranch(tweet);
    const conversationRootThread = this.findLongestOriginalThread(
      rootTweet,
      tweetIdsToTweet
    );

    return {
      replyBranchThread,
      conversationRootThread,
    };
  }

  private findLongestOriginalThread(
    rootTweet: TweetWithContext,
    tweetIdsToTweet: Record<string, TweetWithContext>
  ): TweetWithContext[] {
    const allThreads: TweetWithContext[][] = [];
    const visited = new Set<string>();

    function buildThread(tweet: TweetWithContext): TweetWithContext[] {
      const thread: TweetWithContext[] = [];
      let currentTweet: TweetWithContext | undefined = tweet;

      while (currentTweet && !visited.has(currentTweet.id)) {
        if (currentTweet.username !== rootTweet.username) {
          break;
        }

        visited.add(currentTweet.id);
        thread.push(currentTweet);
        currentTweet = currentTweet.replyToTweet;
      }

      return thread.reverse(); // Reverse the thread to get chronological order
    }

    Object.values(tweetIdsToTweet).forEach((tweet) => {
      if (!visited.has(tweet.id) && tweet.username === rootTweet.username) {
        const thread = buildThread(tweet);
        if (thread.length > 0) {
          allThreads.push(thread);
        }
      }
    });

    return allThreads.reduce(
      (longest, current) =>
        current.length > longest.length ? current : longest,
      [] as TweetWithContext[]
    );
  }
}

// Second Repository: User Replies Finder
export type UserRepliesResult = {
  repliesToOthers: TweetWithContext[];
  repliesFromOthers: TweetWithContext[];
};

export type UserRepliesQuery = {
  conversationId: string;
  username: string;
};

export class ConversationUserRepliesRepository
  implements Repository<UserRepliesQuery, null, UserRepliesResult>
{
  public constructor(
    private readonly tweetSearchRepository: ITweetSearchRepository
  ) {}

  public async read({
    conversationId,
    username,
  }: UserRepliesQuery): Promise<UserRepliesResult> {
    const tweetIdsToTweet: Record<string, TweetWithContext> = {};

    // Tweets where the user has replied to others
    const repliesToOthersQuery = `conversation_id:${conversationId} from:${username} -to:${username}`;
    const repliesToOthersTweets =
      (await this.tweetSearchRepository.read(repliesToOthersQuery, {
        max_results: 10,
        ...DefaultFields,
      })) || [];

    // Tweets where others reply to the user
    const repliesToUserQuery = `conversation_id:${conversationId} to:${username}`;
    const repliesToUserTweets =
      (await this.tweetSearchRepository.read(repliesToUserQuery, {
        max_results: 10,
        ...DefaultFields,
      })) || [];

    [...repliesToOthersTweets, ...repliesToUserTweets].forEach(
      (t) => (tweetIdsToTweet[t.id] = t)
    );

    TweetUtils.connectTweets(tweetIdsToTweet);

    const repliesToOthers = repliesToOthersTweets.filter(
      (t) =>
        t.replyToTweet && t.username.toLowerCase() === username.toLowerCase()
    );

    const repliesFromOthers = repliesToUserTweets.filter(
      (t) =>
        t.username.toLowerCase() !== username.toLowerCase() &&
        t.replyToTweet &&
        t.replyToTweet.username.toLowerCase() === username.toLowerCase()
    );

    return {
      repliesToOthers,
      repliesFromOthers,
    };
  }
}

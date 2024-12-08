import { Db } from "mongodb";
import { globals } from "../util/globals";

export interface Repository<Input, Ctx, Output> {
  read(input: Input, context?: Ctx): Promise<Output | null>;
}

// repository with no arguments or context
export interface NoArgRepository<Output>
  extends Repository<void, void, Output> {
  read(): Promise<Output | null>;
}

type CachingConfig<Input> =
  | { name: string; cacheKeyFn?: never }
  | { name?: never; cacheKeyFn: (input: Input) => string };

export class CachingRepository<Input, Ctx, Output>
  implements Repository<Input, Ctx, Output>
{
  constructor(
    private readonly underlyingRepository: Repository<Input, Ctx, Output>,
    private readonly mongoDb: Db,
    private readonly config: CachingConfig<Input>
  ) {}

  public async read(input: Input, context?: Ctx) {
    if (!globals.get("cacheEnabled")) {
      console.log(`Cache disabled, fetching from underlying repository`);
      return this.underlyingRepository.read(input, context);
    }

    const cacheKey = this.cacheKey(input);
    console.log(`Looking up cache for ${cacheKey}`);

    const cached = await this.mongoDb
      .collection("cache")
      .findOne({ id: cacheKey });

    if (cached) {
      console.log(`Cache hit for ${cacheKey}`);
      return cached.value;
    }

    console.log(
      `Cache miss for ${cacheKey}, fetching from underlying repository`
    );
    const value = await this.underlyingRepository.read(input, context);

    console.log(`Caching value for ${cacheKey}`);
    await this.mongoDb.collection("cache").insertOne({ id: cacheKey, value });

    return value;
  }

  private cacheKey(input: Input): string {
    if (this.config.cacheKeyFn) {
      return this.config.cacheKeyFn(input);
    }
    return `cache:${this.config.name}:${JSON.stringify(input)}`;
  }

  public async invalidate(input: Input) {
    const cacheKey = this.cacheKey(input);
    await this.mongoDb.collection("cache").deleteOne({ id: cacheKey });
  }
}

// I want to add judgements, a judgement should be a list of good and bad deeds
// each of them with points attached to them. you can judge multiple things,
// like a user's profile, or their recent tweets. if their recent tweets, then
// we want to store the span of tweets that are being judged (based on tweet ID).
// then we also want to store the last processed tweet on the user's profile

interface Deed {
  description: string;
  points: number; // positive for good, negative for bad
  evidence?: string; // optional context/reason
}

interface BaseJudgement {
  type: string;
  userId: string;
  goodDeeds: Deed[];
  badDeeds: Deed[];
  totalPoints: number; // computed from deeds
  createdAt: Date;
}

interface ProfileJudgement extends BaseJudgement {
  type: "profile";
}

interface TweetSpanJudgement extends BaseJudgement {
  type: "tweets";
  startTweetId: string;
  endTweetId: string;
}

type Judgement = ProfileJudgement | TweetSpanJudgement;

// okay, what I want to do is
// get their latest tweet that was processed, we can get that from
// the judgements. we also want to get the last tweet they made
//
// then from there, if the last tweet they made is greater than the
// last processed tweet, then we fetch all the tweets for the user
// since that tweet.
//
// now we include the previous judgement made, and all the most recent
// tweets made since that judgement, and we use that to make a new
// judgement and deliver it to the user.
//
// what are the repositories that i need here?
//
// I need a JudgementsRepository, and ability to get the latest judgement / latest tweet judged
// I also need a ProfileRepository to get the last tweet they made

// now if the last tweet they made is greater than the judgements repository last tweet id
// then we fetch all the tweets since that tweet, using UserTweetsRepository
//
// when making a reply, we want to know what their last judgement was
// along with their new judgement

// when making a new judgement, we want to know all their latest tweets since the last judgement

type JudgementContext = { lastOnly: boolean; type: "tweet" | "profile" };

export class JudgementRepository
  implements Repository<string, JudgementContext, Judgement[]>
{
  constructor(private readonly mongoDb: Db) {}

  public async read(
    userId: string,
    context?: JudgementContext
  ): Promise<Judgement[] | null> {
    const filter = {
      userId,
      ...(context?.type && { type: context.type }),
    };

    const result = await this.mongoDb
      .collection("judgements")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return result?.map((doc) => doc.value) || null;
  }

  public async store(judgement: Judgement) {
    judgement.createdAt = new Date();
    await this.mongoDb.collection("judgements").insertOne(judgement);
  }
}

export class MongoRepository<Input, Ctx, Output>
  implements Repository<Input, Ctx, Output>
{
  constructor(
    private readonly mongoDb: Db,
    private readonly collectionName: string
  ) {}

  public async read(input: Input, context?: Ctx): Promise<Output | null> {
    const result = await this.mongoDb
      .collection(this.collectionName)
      .findOne({ id: input });
    return result?.value || null;
  }

  public async store(input: Input, value: Output) {
    await this.mongoDb
      .collection(this.collectionName)
      .insertOne({ id: input, value });
  }
}

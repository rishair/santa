import dotenv from "dotenv";

dotenv.config();

interface GlobalConfig {
  cacheEnabled: boolean;
  postTweet: boolean;
  santaUsername: string;
}

class GlobalConfiguration {
  private static instance: GlobalConfiguration;
  private config: GlobalConfig;

  private constructor() {
    // Default configuration values
    this.config = {
      cacheEnabled: true,
      postTweet: true,
      santaUsername: process.env.TWITTER_SANTA_USERNAME || "",
    };
  }

  public static getInstance(): GlobalConfiguration {
    if (!GlobalConfiguration.instance) {
      GlobalConfiguration.instance = new GlobalConfiguration();
    }
    return GlobalConfiguration.instance;
  }

  public get<K extends keyof GlobalConfig>(key: K): GlobalConfig[K] {
    return this.config[key];
  }

  public set<K extends keyof GlobalConfig>(
    key: K,
    value: GlobalConfig[K]
  ): void {
    this.config[key] = value;
  }

  public getAll(): Readonly<GlobalConfig> {
    return { ...this.config };
  }
}

// Export a singleton instance
export const globals = GlobalConfiguration.getInstance();

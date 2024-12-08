declare module "coinmarketcap-api" {
  export interface CoinMarketCapOptions {
    version?: string;
    fetcher?: typeof fetch;
    config?: RequestInit;
  }

  export interface IdMapOptions {
    listingStatus?: "active" | "inactive";
    start?: number | string;
    limit?: number | string;
    symbol?: string | string[];
    sort?: string;
  }

  export interface MetadataOptions {
    id?: string | number | (string | number)[];
    symbol?: string | string[];
  }

  export interface TickerOptions {
    start?: number | string;
    limit?: number | string;
    convert?: string | string[];
    sort?: string;
    sortDir?: "asc" | "desc";
    cryptocurrencyType?: "all" | "coins" | "tokens";
  }

  export interface QuoteOptions {
    id?: string | number | (string | number)[];
    symbol?: string | string[];
    convert?: string | string[];
  }

  export type GlobalOptions =
    | {
        convert?: string | string[];
      }
    | string
    | string[];

  export default class CoinMarketCap {
    constructor(apiKey: string, options?: CoinMarketCapOptions);

    getIdMap(options?: IdMapOptions): Promise<any>;
    getMetadata(options?: MetadataOptions): Promise<any>;
    getTickers(options?: TickerOptions): Promise<any>;
    getQuotes(options?: QuoteOptions): Promise<any>;
    getGlobal(options?: GlobalOptions): Promise<any>;
  }
}

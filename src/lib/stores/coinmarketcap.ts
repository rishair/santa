import { NoArgRepository, Repository } from "./repo";

import { coinMarketCapClient } from "../clients/coinmarketcap";
interface CoinDetails {
  id: number;
  rank: number;
  name: string;
  symbol: string;
  slug: string;
  is_active: number;
  first_historical_data: string;
  last_historical_data: string;
  platform: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
}

interface CoinMap {
  [symbol: string]: CoinDetails;
}

export class CoinListRepository implements NoArgRepository<CoinMap> {
  public async read(): Promise<CoinMap> {
    const response = await coinMarketCapClient.query(
      "cryptocurrency/map",
      "v2"
    );
    console.log(response);
    const coins = (response as any).data as CoinDetails[];

    return coins.reduce((acc, coin) => {
      acc[coin.symbol] = coin;
      return acc;
    }, {} as CoinMap);
  }
}

export interface CoinInfo {
  urls: {
    website: string[];
    technical_doc: string[];
    twitter: string[];
    reddit: string[];
    message_board: string[];
    announcement: string[];
    chat: string[];
    explorer: string[];
    source_code: string[];
  };
  logo: string;
  id: number;
  name: string;
  symbol: string;
  slug: string;
  description: string;
  notice?: string;
  date_added: string;
  date_launched: string;
  tags: string[];
  platform: null;
  category: string;
  self_reported_circulating_supply?: number;
  self_reported_market_cap?: number;
  self_reported_tags?: string[];
  infinite_supply?: boolean;
}

export class CoinDetailsRepository
  implements Repository<string, void, CoinInfo>
{
  public async read(symbol: string): Promise<CoinInfo | null> {
    const response = await coinMarketCapClient.query(
      "cryptocurrency/info",
      "v2",
      { symbol }
    );
    console.log(response);
    const data = (response as any).data;
    // Get the first coin ID from the response
    const firstCoinId = Object.keys(data)[0];
    if (!firstCoinId) {
      return null;
    }
    const coins = data[firstCoinId];

    // If coin is an array, find the one with highest self_reported_market_cap
    if (Array.isArray(coins)) {
      return coins.reduce((highest, current) => {
        // If current has no market cap, keep previous highest
        if (!current.self_reported_market_cap) {
          return highest;
        }
        // If no highest yet or current is higher, use current
        if (
          !highest ||
          current.self_reported_market_cap > highest.self_reported_market_cap
        ) {
          return current;
        }
        return highest;
      }, null);
    }

    return coins[0];
  }
}

interface PriceStats {
  open_timestamp: string;
  high_timestamp: string;
  low_timestamp: string;
  close_timestamp: string;
  quote: {
    USD: {
      open: number;
      open_timestamp: string;
      high: number;
      high_timestamp: string;
      low: number;
      low_timestamp: string;
      close: number;
      close_timestamp: string;
      percent_change: number;
      price_change: number;
    };
  };
}

interface PriceResponse {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  last_updated: string;
  periods: {
    [key: string]: PriceStats;
  };
}

type TimePeriod = "24h" | "7d" | "30d";

export class CoinPriceRepository
  implements Repository<string, TimePeriod[], PriceResponse>
{
  public async read(
    id: string,
    periods: TimePeriod[] = ["24h", "7d", "30d"]
  ): Promise<PriceResponse | null> {
    const response = await coinMarketCapClient.query(
      "cryptocurrency/price-performance-stats/latest",
      "v2",
      {
        id,
        time_period: periods.join(","),
      }
    );

    console.log(response);

    const data = (response as any).data;
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    // Get first coin's data
    const coinData = data[Object.keys(data)[0]];
    if (!coinData?.periods) {
      return null;
    }

    return coinData;
  }
}

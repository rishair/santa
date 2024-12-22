import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.COINMARKETCAP_API_KEY) {
  throw new Error("Missing COINMARKETCAP_API_KEY environment variable");
}

export class CoinMarketCapClient {
  private readonly apiKey: string | null;
  private readonly apiURL: string = "https://pro-api.coinmarketcap.com";

  constructor(apiKey: string | null) {
    this.apiKey = apiKey;
  }

  public async query(
    endpoint: string,
    version: string = "v1",
    args?: Record<string, string>
  ): Promise<JSON> {
    let url = `${this.apiURL}/${version}/${endpoint}`;
    let queryString = "";

    if (!args) {
      console.log("No args");
      args = {};
    }

    for (const key in args) {
      const value = args[key];
      queryString += `${key}=${value}`;
      queryString += "&";
    }

    url += "?" + queryString;
    console.log(url);

    let headers: Record<string, string> = {};
    if (this.apiKey) {
      headers = {
        "X-CMC_PRO_API_KEY": this.apiKey,
      };
    }
    const resp = await fetch(url, { headers });
    return resp.json() as Promise<JSON>;
  }
}

export const coinMarketCapClient = new CoinMarketCapClient(
  process.env.COINMARKETCAP_API_KEY
);

import {
  CoinDetailsRepository,
  CoinListRepository,
  CoinPriceRepository,
} from "../lib/stores/coinmarketcap";

// const coinListRepository = new CoinListRepository();
// coinListRepository.read().then((coins) => {
//   console.log(coins);
// });

async function test() {
  const coinDetailsRepository = new CoinDetailsRepository();
  const details = await coinDetailsRepository.read("AIXBT");
  if (!details) {
    throw new Error("Coin details not found");
  }

  console.log(details);

  const coinPriceRepository = new CoinPriceRepository();
  const price = await coinPriceRepository.read(details.id.toString(), [
    "24h",
    "7d",
    "30d",
  ]);
  console.log(price);

  for (const period in price?.periods) {
    console.log(price?.periods[period].quote);
  }
}

test();

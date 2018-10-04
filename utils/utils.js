const queryString = require("query-string");
const axios = require("axios");

function getBacktestData(
  historicalData,
  profit,
  loss,
  time,
  coinSymbol,
  alertRankId
) {
  let currentCoinHistoricalData = historicalData;

  if (currentCoinHistoricalData.length === 0) {
    return null;
  }

  let buyPrice = parseFloat(currentCoinHistoricalData[0].open);
  let buyTime = currentCoinHistoricalData[0].time;
  let profitTake = parseFloat(profit) / 100;
  let gainThreshold = (profitTake + 1) * parseFloat(buyPrice);
  let stopLoss = parseFloat(loss) / 100;
  let lossThreshold = (1 - stopLoss) * parseFloat(buyPrice);
  let sellPrice = -1;
  let sellTime = -1;
  let duration = -1;
  let adjustedTime = time - 1;

  for (let j = 0; j <= adjustedTime; j++) {
    let hourlyHigh = currentCoinHistoricalData[j].high;
    let hourlyLow = currentCoinHistoricalData[j].low;
    let closePrice = currentCoinHistoricalData[j].close;
    let profitHit = false;
    let lossHit = false;

    if (hourlyHigh >= gainThreshold && (hourlyHigh !== 0 && buyPrice !== 0)) {
      profitHit = true;
    }
    if (hourlyLow <= lossThreshold && (hourlyLow !== 0 && buyPrice !== 0)) {
      lossHit = true;
    }
    if (profitHit) {
      sellPrice = parseFloat(gainThreshold);
      sellTime = currentCoinHistoricalData[j].time;
    }
    if (lossHit) {
      sellPrice = parseFloat(lossThreshold);
      sellTime = currentCoinHistoricalData[j].time;
    }
    if (profitHit && lossHit) {
      // TODO: what to do if both hit in the same hour?
      sellPrice = parseFloat(buyPrice);
      sellTime = currentCoinHistoricalData[j].time;
    }
    if (lossHit || profitHit) {
      duration = j + 1;
      break;
    }
    if (j === adjustedTime) {
      duration = time;
      sellPrice = parseFloat(closePrice);
      sellTime = currentCoinHistoricalData[j].time;
    }
  }

  return {
    profit: sellPrice / buyPrice,
    duration,
    symbol: coinSymbol,
    sellPrice,
    buyPrice,
    alertRankId,
    sellTime,
    buyTime
  };
}

function getCurrentPrice(symbol, callback) {
  let fsym = "fsym=" + symbol;
  let tsyms = symbol === "BTC" ? "USD" : "BTC";
  let url =
    "https://min-api.cryptocompare.com/data/price?" + fsym + "&tsyms=" + tsyms;

  axios
    .get(url)
    .then(res => {
      if (res.data.BTC || res.data.USD) {
        let response = res.data.BTC ? res.data.BTC : res.data.USD;
        callback(response);
      }
    })
    .catch(function(error) {
      console.log(CSConstants.axiosError, error);
    });
}

function getUrlParams(reqUrl) {
  const url = reqUrl.substring(reqUrl.indexOf("?") + 1);
  const parsed = queryString.parse(url);

  return {
    loss: parseFloat(parsed.loss),
    profit: parseFloat(parsed.profit),
    timeOut: parseFloat(parsed.timeOut),
    top: parseFloat(parsed.top),
    coins: parsed.coins,
    includeFees: parsed.includeFees,
    start: parseInt(parsed.start),
    end: parseInt(parsed.end),
    timeDelay: parseInt(parsed.timeDelay)
  };
}

function processAlerts(alerts, profit, loss, timeOut, includeExchangeFees) {
  let btcResults = [];
  let btcResultsMap = {};
  let btcTotalProfit = 0;
  let usdResults = [];
  let usdResultsMap = {};
  let usdTotalProfit = 0;

  for (let i = 0; i < alerts.length; i++) {
    const coinSymbol = alerts[i]._id.symbol.trim();
    const alertStartTime = alerts[i]._id.startTime;
    const alertRankId = alerts[i].alertId;
    const btcCoinResult = [coinSymbol, alertStartTime];
    const usdCoinResult = [coinSymbol, alertStartTime];

    const exchangeFee = 0.004;

    let btcHistoricalData = alerts[i].history[0].btc
      ? alerts[i].history[0].btc
      : [];
    let usdHistoricalData = alerts[i].history[0].usd
      ? alerts[i].history[0].usd
      : [];

    if (btcHistoricalData) {
      const output = getBacktestData(
        btcHistoricalData,
        profit,
        loss,
        timeOut,
        coinSymbol,
        alertRankId
      );
      if (
        output &&
        !isNaN(output.profit) &&
        !btcResultsMap[coinSymbol + alertStartTime]
      ) {
        let finalProfit = null;

        if (includeExchangeFees === true) {
          finalProfit = parseFloat(output.profit - exchangeFee);
        } else {
          finalProfit = output.profit;
        }

        btcResultsMap[coinSymbol + alertStartTime] = coinSymbol;
        btcCoinResult.push(finalProfit);
        btcCoinResult.push(output.duration);
        btcCoinResult.push(output);
        btcResults.push(btcCoinResult);
      }
    }

    if (usdHistoricalData) {
      const output = getBacktestData(
        usdHistoricalData,
        profit,
        loss,
        timeOut,
        coinSymbol,
        alertRankId
      );
      if (
        output &&
        !isNaN(output.profit) &&
        !usdResultsMap[coinSymbol + alertStartTime]
      ) {
        let finalProfit = null;

        if (includeExchangeFees === true) {
          finalProfit = parseFloat(output.profit - exchangeFee);
        } else {
          finalProfit = output.profit;
        }

        usdResultsMap[coinSymbol + alertStartTime] = coinSymbol;
        usdCoinResult.push(finalProfit);
        usdCoinResult.push(output.duration);
        usdCoinResult.push(output);
        usdResults.push(usdCoinResult);
      }
    }
  }

  for (let j = 0; j < btcResults.length; j++) {
    btcTotalProfit += btcResults[j][2];
  }

  for (let j = 0; j < usdResults.length; j++) {
    usdTotalProfit += usdResults[j][2];
  }

  btcTotalProfit -= btcResults.length;
  usdTotalProfit -= usdResults.length;
  const btcTotalProfitPercentage = parseFloat(btcTotalProfit * 100).toFixed(2);
  const usdTotalProfitPercentage = parseFloat(usdTotalProfit * 100).toFixed(2);
  const backtestResponse = {
    btcTotalProfit:
      btcResults.length !== 0 ? btcTotalProfitPercentage : "No Data",
    btcResults,
    usdTotalProfit:
      usdResults.length !== 0 ? usdTotalProfitPercentage : "No Data",
    usdResults
  };

  return backtestResponse;
}

function findClosestTimestampWithData(startTime) {
  var oneDayInSeconds = 86400;
  var sevenDaysInSeconds = 604800;
  var sixDaysInSeconds = sevenDaysInSeconds - oneDayInSeconds;
  var fiveDaysInSeconds = sixDaysInSeconds - oneDayInSeconds;
  var fourDaysInSeconds = fiveDaysInSeconds - oneDayInSeconds;
  var threeDaysInSeconds = fourDaysInSeconds - oneDayInSeconds;
  var twoDaysInSeconds = threeDaysInSeconds - oneDayInSeconds;
  var twelveHoursInSeconds = oneDayInSeconds * 0.5;
  var sixHoursInSeconds = twelveHoursInSeconds * 0.5;

  const currentTime = Math.round(new Date().getTime() / 1000);
  let endTime = null;
  let days = 7;

  const timeUnits = [
    null,
    oneDayInSeconds,
    twoDaysInSeconds,
    threeDaysInSeconds,
    fourDaysInSeconds,
    fiveDaysInSeconds,
    sixDaysInSeconds,
    sevenDaysInSeconds
  ];

  while (endTime === null) {
    let possibleTime = 0;
    possibleTime = startTime + timeUnits[days];
    days--;

    if (possibleTime < currentTime) {
      endTime = possibleTime;
    }

    if (days <= 0) {
      break;
    }
  }

  const info = {
    endTime,
    days: days <= 0 ? 0 : days + 1
  };

  return info;
}

module.exports.getUrlParams = getUrlParams;
module.exports.getCurrentPrice = getCurrentPrice;
module.exports.processAlerts = processAlerts;
module.exports.findClosestTimestampWithData = findClosestTimestampWithData;

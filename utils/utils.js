const queryString = require('query-string');

function getBacktestData(historicalData, profit, loss, time, coinSymbol, alertRankId) {
  let currentCoinHistoricalData = historicalData;

  if (currentCoinHistoricalData.length === 0) {
    return null;
  }

  let buyPrice = currentCoinHistoricalData[0].open;
  let profitTake = (parseFloat(profit)/100);
  let gainThreshold = (profitTake + 1) * parseFloat(buyPrice);
  let stopLoss = (parseFloat(loss)/100);
  let lossThreshold = (1 - stopLoss) * parseFloat(buyPrice);
  let sellPrice = -1;
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
      sellPrice = gainThreshold;
    }
    if (lossHit) {
      sellPrice = lossThreshold;
    }
    if (profitHit && lossHit) {
      // TODO: what to do if both hit in the same hour?
      sellPrice = buyPrice;
    }
    if (lossHit || profitHit) {
      duration = j + 1;
      break;
    }
    if (j === adjustedTime) {
      duration = time;
      sellPrice = closePrice;
    }
  }
  return {
    profit: (sellPrice/buyPrice),
    duration,
    symbol: coinSymbol,
    sellPrice,
    buyPrice,
    alertRankId,
  };
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
  }
}

function processAlerts(alerts, profit, loss, timeOut, includeExchangeFees) {
  let coinResults = [];
  let coinResultsMap = {};
  let totalProfit = 0;

  for (let i = 0; i < alerts.length; i++) {
    const coinSymbol = alerts[i]._id.symbol.trim();
    const alertStartTime = alerts[i]._id.startTime;
    const alertRankId = alerts[i].alertId;
    const coinResult = [coinSymbol, alertStartTime];
    const historicalData = alerts[i].history ? alerts[i].history : [];
    const exchangeFee = 0.004;

    if (historicalData) {
      const output = getBacktestData(historicalData, profit, loss, timeOut, coinSymbol, alertRankId);
      if (output && !isNaN(output.profit) && !(coinResultsMap[coinSymbol + alertStartTime])) {
        let finalProfit = null;

        if (includeExchangeFees === true) {
          finalProfit = parseFloat(output.profit - exchangeFee);
        } else {
          finalProfit = output.profit;
        }

        coinResultsMap[coinSymbol + alertStartTime] = coinSymbol;
        coinResult.push(finalProfit);
        coinResult.push(output.duration);
        coinResult.push(output);
        coinResults.push(coinResult);
      }
    }
  }

  for (let j = 0; j < coinResults.length; j++) {
    totalProfit += coinResults[j][2];
  }

  totalProfit -= coinResults.length;
  const totalProfitPercentage = parseFloat(totalProfit * 100).toFixed(2);
  const backtestResponse = {
    totalProfit: coinResults.length !== 0 ? totalProfitPercentage : 'No Data',
    results: coinResults,
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

  const currentTime = Math.round((new Date()).getTime() / 1000);
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
    sevenDaysInSeconds,
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
    days: days <= 0 ? 0 : days + 1,
  };

  return info;
}

module.exports.getUrlParams = getUrlParams;
module.exports.processAlerts = processAlerts;
module.exports.findClosestTimestampWithData = findClosestTimestampWithData;


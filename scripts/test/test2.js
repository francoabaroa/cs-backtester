const axios = require('axios');
const CSConstants = require('../constants/CSConstants');
const mongoose = require('mongoose');
const request = require('request');
const utils = require('../utils/utils');

const ActiveAlertModel = require('../models/ActiveAlertModel');
const NotificationModel = require('../models/NotificationModel');
const PriceAlertModel = require('../models/PriceAlertModel');
const StrategyModel = require('../models/StrategyModel');
const UserModel = require('../models/UserModel');

const convert = require('convert-units');

const headers = {
  'Accept': CSConstants.mimeTypeJson,
};

const options = {
  url: CSConstants.googleSheetsApiUrl,
  headers: headers
};

mongoose.Promise = Promise;
mongoose.connect(
  CSConstants.mongoCSDatabase,
  {
    useNewUrlParser: true
  }
);

const REASON_ENUM = ['PROFIT', 'LOSS', 'TIMEOUT'];

let alertDataObjects = [];
let successfullyCreated = 0;

Date.prototype.getUnixTime = function() { return this.getTime()/1000|0 };
if(!Date.now) Date.now = function() { return new Date(); }
Date.time = function() { return Date.now().getUnixTime(); }

/************************************
  TODO:
    - make reusable function logic
    - add types to function arguments
    - seperate logic when possible
************************************/

function addToDBCollection(symbol, startTime, historicalData, hoursOfDataStored, alertId) {
  PriceAlertModel.findOne({
    _id: {
        symbol: `${symbol}`,
        startTime,
    }
  }, (err, alert) => {
    if (alert) {
      console.log(symbol + startTime + CSConstants.alertExists);
      alert.btcPriceAtAlertTime = 0;
      alert.usdPriceAtAlertTime = 0;
    } else {
      PriceAlertModel.create({
        _id: {
          symbol: `${symbol}`,
          startTime,
        },
        history: historicalData,
        hoursOfDataStored: hoursOfDataStored,
        symbol: symbol,
        startTime: startTime,
        storedDataApiUrl: null,
        alertId: alertId,
        btcPriceAtAlertTime: 0,
        usdPriceAtAlertTime: 0,
      }, (err, alert) => {
          if (err) {
            console.log(CSConstants.error, err);
          } else {
            successfullyCreated++;
            console.log(CSConstants.numOfRecordsSaved + successfullyCreated);
          }
      });
    }
  });
}

function createStrategy(userId, profitTake, stopLoss, timeOut, currencies, exchanges) {
  StrategyModel.create({
    userId,
    profitTakePercent: profitTake,
    stopLossPercent: stopLoss,
    timeOutPeriodInHrs: timeOut,
    currencies,
    exchanges,
  }, (err, strategy) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        console.log('StrategyModel: ');
        // TODO: replace hardcoded

        // add this to active strategies
        // { _id: { symbol: 'ICX', startTime: 1535317200 }

        PriceAlertModel.findOne({symbol: 'BTC'}, (err, alert) => {
          if (alert) {
            let activeStrategies = [];
            activeStrategies.push(strategy.id);
            console.log(alert.id, alert._id);
            createActiveAlert(alert._id, 0, 0, [], activeStrategies, 19, 48, 48, true);
            return alert.id;
          }
        });
        return strategy.id;
      }
  });
}

function createNotification(userId, alertId, strategyId, result, reasonEnum) {
  // prevent duplicates for same symbol + starttime???
  NotificationModel.create({
    userId,
    alertId: alertId,
    strategyId,
    result,
    reason: reasonEnum,
    notified: false,
  }, (err, notification) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        console.log('NotificationModel: ', notification);
      }
  });
}

function createActiveAlert(
  alertId,
  currentBtcPrice,
  currentUsdPrice,
  notifiedStrategiesList,
  assignedStrategiesList,
  performancePercent,
  timeSinceAlertedInHrs,
  ageInHrs,
  active,
) {
  // prevent duplicates for same symbol + starttime???
  // let id = mongoose.Types.ObjectId(alertId);
  // TODO: difference between .id and ._id
  console.log('alert ID!!', alertId);
  ActiveAlertModel.create({
    alertId: alertId,
    currentBtcPrice,
    currentUsdPrice,
    notifiedStrategiesList,
    assignedStrategiesList,
    performancePercent,
    timeSinceAlertedInHrs,
    ageInHrs,
    active,
  }, (err, notification) => {
      if (err) {
        console.log(CSConstants.error, err, '- Active Alert Creation Failure');
      } else {
        checkActiveAlerts();
        console.log('ActiveAlert: ');
      }
  });
}

function createUser(cellphone, active, email, passwordHash, preferences, settings) {
  UserModel.create({
    cellphone,
    active,
    email,
    passwordHash,
    preferences,
    settings,
  }, (err, user) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        console.log('User created');
        // TODO: where is this call?
        let newStrategyId = createStrategy(user.id, 15, 5, 48, ['ETH', 'BTC', 'ICX'], []);
        return user.id;
      }
  });
}

function calculatePerfPercent(currentPrice, startPrice) {
  // default to BTC, unless it IS BTC
  // calculate profit or stop loss
  const diff = (currentPrice/startPrice);
  let percent = 1 - diff;
  const negative = percent < 0 ? false : true;
  const finalResult = percent * 100;
  return negative ? -Math.abs(finalResult) : -Math.abs(finalResult);
}

function getCurrentPrice(symbol, callback) {
  let fsym = 'fsym=' + symbol;
  let tsyms = symbol === 'BTC' ? 'USD' : 'BTC';
  let url =
    'https://min-api.cryptocompare.com/data/price?' +
    fsym +
    '&tsyms=' +
    tsyms;

  console.log('Axios link', url);

  axios.get(url).then(res => {
    console.log('res.data', res.data);
    if (res.data.BTC || res.data.USD) {
      let response = res.data.BTC ? res.data.BTC : res.data.USD;
      callback(response);
      console.log(response);
    }
  }).catch(function (error) {
    console.log(CSConstants.axiosError, error);
  });
}

function sendSms(userToNotify, reason, result, symbol) {
  // Twilio API
  console.log(
    'User: ' +
    userToNotify +
    ' - Reason: ' +
    reason +
    ' - Result: ' +
    result +
    ' - Symbol: ' +
    symbol
  );
  return;
}

function checkActiveAlerts(error, response, body) {
  ActiveAlertModel.find({ ageInHrs: { $lte: 168}, active: true }, (err, activeAlerts) => {
    if (err) {
        res.send(err);
    } else {
      for (let i = 0; i < activeAlerts.length; i++) {
        PriceAlertModel.findOne({
          _id: activeAlerts[i].alertId
        }, (err, alert) => {
          if (alert) {
            let symbol = alert.symbol;
            let currentPrice = utils.getCurrentPrice(symbol, (price) => {
              let currPrice = price;

              if (symbol === 'BTC') {
                activeAlerts[i].currentUsdPrice = currPrice;
              } else {
                activeAlerts[i].currentBtcPrice = currPrice;
              }

              let startPrice = symbol === 'BTC' ? alert.usdPriceAtAlertTime : alert.btcPriceAtAlertTime;
              let perfPercent = parseFloat(
                calculatePerfPercent(
                  currPrice,
                  startPrice,
                )
              );
              let startTime = convert(Math.abs(alert.startTime)).from('s').to('ms');
              let endTime = new Date();
              let difference = startTime - endTime.getTime();
              let msToHours = convert(Math.abs(difference)).from('ms').to('h');

              activeAlerts[i].performancePercent = perfPercent;
              activeAlerts[i].timeSinceAlertedInHrs = msToHours;
              activeAlerts[i].ageInHrs = msToHours;

              // default to BTC ??
              for (let j = 0; j < activeAlerts[i].assignedStrategiesList.length; j++) {
                // option 1
                StrategyModel.findOne({_id: activeAlerts[i].assignedStrategiesList[j], currencies: { $in: [symbol] } }, (err, strategy) => {
                  if (strategy) {
                    console.log('Strategy!', strategy);
                    let profitHitFlag = false;
                    let stopLossHitFlag = false;
                    let timeOutFlag = false;
                    let reasonEnum = null;
                    let result = null;

                    if (strategy.timeOutPeriodInHrs <= activeAlerts[i].timeSinceAlertedInHrs) {
                      if (activeAlerts[i].timeSinceAlertedInHrs >= 168) {
                        activeAlerts[i].active = false;
                      }
                      timeOutFlag = true;
                    } else {
                      if (activeAlerts[i].performancePercent >= 0) {
                        if (strategy.profitTakePercent <= activeAlerts[i].performancePercent) {
                          profitHitFlag = true;
                        }
                      } else if (activeAlerts[i].performancePercent < 0) {
                        // store strategy stop loss as + numb
                        if (strategy.stopLossPercent <= Math.abs(activeAlerts[i].performancePercent)) {
                          stopLossHitFlag = true;
                        }
                      }
                    }

                    if (profitHitFlag) {
                      result = activeAlerts[i].performancePercent;
                      console.log(REASON_ENUM[0]);
                      reasonEnum = REASON_ENUM[0];
                    } else if (stopLossHitFlag) {
                      result = activeAlerts[i].performancePercent;
                      console.log(REASON_ENUM[1]);
                      reasonEnum = REASON_ENUM[1];
                    } else if (timeOutFlag) {
                      result = activeAlerts[i].timeSinceAlertedInHrs;
                      console.log(REASON_ENUM[2]);
                      reasonEnum = REASON_ENUM[2];
                    }

                    // only create notification if reasonEnum !== null
                    if (reasonEnum !== null) {
                      activeAlerts[i].save();
                      createNotification(
                        strategy.userId,
                        activeAlerts[i].alertId,
                        strategy.id,
                        result,
                        reasonEnum,
                      );
                    }
                  } else {
                    console.log('Strategy not found!');
                  }
                });

                /*
                // option 2
                StrategyModel.find({
                  '_id': { $in: activeAlerts[i].assignedStrategiesList}
                }, function(err, strategies){
                  if (err) {
                    console.log(err);
                  } else {
                    for (let k = 0; k < strategies.length; k++) {
                      if (perfPercent >= 0) {
                        if (strategies[k].profitTakePercent <= perfPercent) {
                          createNotification();
                        }
                      } else if (perfPercent < 0) {
                        // TODO: need to make strategies[k].stopLossPercent negative num? or perfPercent positive
                        if (strategies[k].stopLossPercent <= perfPercent) {
                          createNotification();
                        }
                      }

                      if (strategies[k].stopLossPercent >= timeSinceAlert) {
                        // time out period has been reach, alert the user via SMS
                        createNotification();
                      }
                    }
                  }
                  console.log(strategies);
                });
                */
              }
            });
          } else {
            console.log('PriceAlert not found for ActiveAlert', activeAlerts[i].alertId);
          }
        });
      }
      console.log('Done Running');
      // call this once script is done running!
      // checkNotifications();
    }
  });
}

function checkNotifications(error, response, body) {
  NotificationModel.find({notified: false}, (err, notification) => {
    if (err) {
        res.send(err);
    } else {
      for (let i = 0; i < notification.length; i++) {
        let userToNotify = notification.userId;
        let reason = notification.reason;
        let result = 0;
        // pass in coin symbol using alertId reference
        sendSms(userToNotify, reason, result, /* COIN SYMBOL */);
        notification.notified = true;
        notification.save();
      }
    }
  });
}

// ?????
// TODO: cellphone should be unique, strategies should be unique? active alerts SHOULD be unique!
let randomUserID = createUser(7861112223, true, 'fr1a@fra.com', null, null, null);

/*

TODO: when a new activeAlert is created, we need to iterate through all active strategies, and if activeAlertSymbol is in strategy.currencies, we need to add strategy.id to activeAlert assignedStrategiesList

*/


checkActiveAlerts();

// utils.getCurrentPrice('REQ');

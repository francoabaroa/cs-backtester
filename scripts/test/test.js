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

function createActiveAlert(alertId, currentBtcPrice, currentUsdPrice, notifiedStrategiesList, assignedStrategiesList, performancePercent, timeSinceAlertedInHrs, ageInHrs, active) {
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
        let newStrategyId = createStrategy(user.id, 15, 5, 48, ['ETH', 'BTC'], []);
        return user.id;
      }
  });
}

function calculatePerfPercent(price) {
  // default to BTC, unless it IS BTC
  return null;
}

function getCurrentPrice(symbol, callback) {
  let fsym = 'fsym=' + symbol;
  let tsyms = symbol === 'BTC' ? 'USD' : 'BTC';
  let url =
    'https://min-api.cryptocompare.com/data/price?' +
    fsym +
    '&tsyms=' +
    tsyms;

  axios.get(url).then(res => {
    console.log('res.data', res.data);
    if (res.data.BTC || res.data.USD) {
      let response = res.data.BTC ? res.data.BTC : res.data.USD;
      console.log(response);
      return response;
    }
    // callback(historicalData, usdConversionUrl);
  }).catch(function (error) {
    console.log(CSConstants.axiosError, error);
  });
}

function sendSms(userToNotify, reason, result, symbol) {
  // twilio API
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

// 1) USER MODEL

// expose api endpoints to create strategy's and users
// user info populated

// 2) PRICE ALERT MODEL

// create-

// 3) ACTIVE ALERT MODEL

// when script creates a new alert, we need to create a new active alert
// OR
// iterate through alerts and for any with less than 7 days since alert start time, create a new active alert (with unique id as alert id)

// 4) STRATEGY MODEL

// expose api endpoints to create strategy's and users

// 5) NOTIFICATION MODEL


function checkActiveAlerts(error, response, body) {
  ActiveAlertModel.find({ ageInHrs: { $lte: 168} }, (err, activeAlerts) => {
    if (err) {
        res.send(err);
    } else {
      let alertSymbolsMap = {};
      let alertSymbols = [];
      for (let i = 0; i < activeAlerts.length; i++) {
        // mongoose.Types.ObjectId('4ed3ede8844f0f351100000c')
        PriceAlertModel.findOne({
          _id: activeAlerts[i].alertId
        }, (err, alert) => {
          if (alert) {
            // TODO: check timeout period?

            let symbol = alert.symbol;

            // TODO: implement getCurrentPrice

            let currentPrice = getCurrentPrice(symbol, /* add callback of calculate profit percent*/);

            // TODO: save currentBtcPrice and currentUsd price

            // TODO: implement calculatePerfPercent

            // default to BTC increase
            // ??? do we alert on BTC increase or USD increase...?
            let perfPercent = parseFloat(
              calculatePerfPercent(
                currentPrice,
                alert.btcPriceAtAlertTime,
                alert.usdPriceAtAlertTime,
              )
            );


            // TODO: assign currentBtcPrice from getCurrenctPrice
            activeAlerts[i].currentBtcPrice = 1;

            // TODO: assign currentUsdPrice from getCurrenctPrice
            activeAlerts[i].currentUsdPrice = 1;

            // TODO: assign performancePercent from calculatePerfPercent
            activeAlerts[i].performancePercent = 16;

            // TODO:
            activeAlerts[i].timeSinceAlertedInHrs = 56;
            activeAlerts[i].ageInHrs = 56;

            let timeSinceAlert = 1; // ??

            // TODO -> which perfPercent do we use? BTC or USD?
            // Default to BTC
            for (let j = 0; j < activeAlerts[i].assignedStrategiesList.length; j++) {

              // option 1
              StrategyModel.findOne({_id: activeAlerts[i].assignedStrategiesList[j]}, (err, strategy) => {
                if (strategy) {
                  let profitHitFlag = false;
                  let stopLossHitFlag = false;
                  let timeOutFlag = false;
                  let reasonEnum = null;
                  let result = null;

                  // TODO: how to handle time out reached accurately vs. stoploss/profit take reached
                  if (activeAlerts[i].performancePercent >= 0) {
                    if (strategy.profitTakePercent <= activeAlerts[i].performancePercent) {
                      profitHitFlag = true;
                    }
                  } else if (activeAlerts[i].performancePercent < 0) {
                    // TODO: need to make strategy.stopLossPercent negative num? or perfPercent positive
                    if (strategy.stopLossPercent <= activeAlerts[i].performancePercent) {
                      stopLossHitFlag = true;
                    }
                  }

                  if (strategy.timeOutPeriodInHrs <= activeAlerts[i].timeSinceAlertedInHrs) {
                    // time out period has been reach, alert the user via SMS
                    timeOutFlag = true;
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
                  createNotification(
                    strategy.userId,
                    activeAlerts[i].alertId,
                    strategy.id,
                    result,
                    reasonEnum,
                  );
                } else {
                  console.log('Strategy not found');
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
          } else {
            console.log('PriceAlert not found for ActiveAlert', activeAlerts[i].alertId);
          }
        });
      }
      checkNotifications();
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
        sendSms(userToNotify, reason, result, /* COIN SYMBOL */);
        notification.notified = true;
        notification.save();
      }
    }
  });
}

function createNewActiveAlerts() {
  var oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds
  var firstDate = new Date(2008, 1 ,12);
  var secondDate = new Date(2008, 1 ,22);
  var diffDays = Math.round(Math.abs((firstDate.getTime() - secondDate.getTime())/(oneDay)));
}



// TODO: cellphone should be unique, strategies should be unique? active alerts SHOULD be unique!
// let randomUserID = createUser(7861112222, true, 'fra@fra.com', null, null, null);

/*

TODO: when a new activeAlert is created, we need to iterate through all active strategies, and if activeAlertSymbol is in strategy.currencies, we need to add strategy.id to activeAlert assignedStrategiesList

*/


// checkActiveAlerts();

getCurrentPrice('REQ');

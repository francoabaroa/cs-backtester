const axios = require('axios');
const CSConstants = require('../../constants/CSConstants');
const mongoose = require('mongoose');
const utils = require('../../utils/utils');

const TestPriceAlertModel = require('../../tests/TestPriceAlertModel');
const TestActiveAlertModel = require('../../tests/TestActiveAlertModel');
const TestNotificationModel = require('../../tests/TestNotificationModel');
const TestStrategyModel = require('../../tests/TestStrategyModel');
const TestUserModel = require('../../tests/TestUserModel');

require('dotenv').config();

const convert = require('convert-units');

mongoose.Promise = Promise;
mongoose.connect(
  process.env.MONGO_TEST,
  {
    useNewUrlParser: true
  }
);

const REASON_ENUM = ['PROFIT', 'LOSS', 'TIMEOUT'];

function createNotification(
  userId,
  alertId,
  strategyId,
  result,
  reasonEnum
) {
  // TODO: prevent duplicate notifs ?
  // TODO: make sure string
  let notificationId = userId + alertId;
  TestNotificationModel.create({
    notificationId,
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
        console.log('TestNotificationModel: ', notification);
      }
  });
}

function calculatePerfPercent(currentPrice, startPrice) {
  // default to BTC, unless it IS BTC
  const diff = (currentPrice/startPrice);
  let percent = 1 - diff;
  const negative = percent < 0 ? false : true;
  const finalResult = percent * 100;
  console.log('Math.abs(finalResult)', Math.abs(finalResult));
  return negative ? -Math.abs(finalResult) : Math.abs(finalResult);
}

function testCalculatePerfPercent(reason) {
  let value = 0;
  let negative = true;
  if (reason === REASON_ENUM[0]) {
    negative = false;
    value = 50;
  } else if (REASON_ENUM[1]) {
    value = 50;
  }

  return negative ? -Math.abs(value) : Math.abs(value);
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
  console.log('Checking for active alerts and strategies');
  TestActiveAlertModel.find({ ageInHrs: { $lte: 168}, active: true }, (err, activeAlerts) => {
    if (err) {
        res.send(err);
    } else {
      console.log('activeAlerts.length', activeAlerts.length);
      for (let i = 0; i < activeAlerts.length; i++) {
        console.log('in checkActiveAlerts for loop');
        TestPriceAlertModel.findOne({
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
              let performancePercent = parseFloat(
                testCalculatePerfPercent(testReason)
              );

              let startTime = convert(Math.abs(alert.startTime)).from('s').to('ms');
              let endTime = new Date();
              let difference = startTime - endTime.getTime();
              let msToHours = convert(Math.abs(difference)).from('ms').to('h');

              activeAlerts[i].performancePercent = performancePercent;
              activeAlerts[i].timeSinceAlertedInHrs = msToHours;
              activeAlerts[i].ageInHrs = msToHours;

              console.log('PRICE', price, activeAlerts[i], 'performancePercent', performancePercent);

              // default to BTC ??
              for (let j = 0; j < activeAlerts[i].assignedStrategiesList.length; j++) {
                TestStrategyModel.findOne({_id: activeAlerts[i].assignedStrategiesList[j], currencies: { $in: [symbol] } }, (err, strategy) => {
                  if (strategy) {
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
              }
            });
          } else {
            console.log('PriceAlert not found for ActiveAlert', activeAlerts[i].alertId);
          }
        });
      }
      console.log('Done Running');
      // checkNotifications();
    }
  });
}

function checkNotifications(error, response, body) {
  TestNotificationModel.find({notified: false}, (err, notification) => {
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

function createTestUser(cellphone, active, email, passwordHash, preferences, settings, callback, testStrategy) {
  TestUserModel.create({
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
        let newStrategyId = createTestStrategy(user.id, testStrategy.profitTake, testStrategy.stopLoss, testStrategy.timeOut, testStrategy.currencies, [], callback);
        return user.id;
      }
  });
}

function createTestStrategy(userId, profitTake, stopLoss, timeOut, currencies, exchanges, callback) {
  TestStrategyModel.create({
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
        console.log('TestStrategyModel: ');
        TestPriceAlertModel.findOne({symbol: 'ETH'}, (err, alert) => {
          if (alert) {
            let activeStrategies = [];
            activeStrategies.push(strategy.id);
            console.log(alert.id, alert._id);
            // createTestActiveAlert(alert._id, 0, 0, [], activeStrategies, 19, 48, 48, true);
            callback();
            return alert.id;
          }
        });
        return strategy.id;
      }
  });
}

function createTestActiveAlert(
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
  TestActiveAlertModel.create({
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
        // checkActiveAlerts();
        console.log('ActiveAlert: ');
      }
  });
}

function addToDBCollection(symbol, startTime, historicalData, hoursOfDataStored, alertId, callback) {
  TestPriceAlertModel.findOne({
    _id: {
        symbol: `${symbol}`,
        startTime,
    }
  }, (err, alert) => {
    if (alert) {
      console.log(symbol + startTime + CSConstants.alertExists);
      callback();
    } else {
      TestPriceAlertModel.create({
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
            callback();
            console.log(CSConstants.numOfRecordsSaved);
          }
      });
    }
  });
}

function addActiveAlertToDB(
  alertId,
  currentBtcPrice,
  currentUsdPrice,
  notifiedStrategiesList,
  assignedStrategiesList,
  performancePercent,
  timeSinceAlertedInHrs,
  ageInHrs,
  active,
  callback,
) {
  console.log('Adding active alert to db');
  TestActiveAlertModel.findOne({
    alertId: alertId
  }, (err, alert) => {
    if (alert) {
      console.log('ActiveAlert exists');
      callback();
    } else {
      TestActiveAlertModel.create({
        alertId: alertId,
        currentBtcPrice,
        currentUsdPrice,
        notifiedStrategiesList,
        assignedStrategiesList,
        performancePercent,
        timeSinceAlertedInHrs,
        ageInHrs,
        active: true,
      }, (err, alert) => {
          if (err) {
            console.log(CSConstants.error, err, '- Active Alert Creation Failure');
          } else {
            console.log('ActiveAlert: ');
            callback();
          }
      });
    }
  });
}

function createNewActiveAlerts(callback) {
  TestPriceAlertModel.find((err, alerts) => {
    if (err) {
      console.log('Error: ' + err);
    } else {
      for (let i = 0; i < alerts.length; i++) {
        let oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds;
        let startTime = convert(Math.abs(alerts[i].startTime)).from('s').to('ms');
        let endTime = new Date();
        let difference = startTime - endTime.getTime();
        let msToHours = convert(Math.abs(difference)).from('ms').to('h');
        let differenceInDays = Math.round(
          Math.abs(
            (difference) / (oneDay)
          )
        );
        if (differenceInDays <= 7) {
          findMatchingStrategies(alerts[i].symbol, (assignedStrategies) => {
            addActiveAlertToDB(
              alerts[i]._id, // alertId
              null, // currentBTCPrice
              null, // currentUSDPrice
              [], // notifiedStrategiesList
              assignedStrategies, // assignedStrategiesList
              null, // performancePercent
              msToHours, // timeSinceAlertedInHrs
              msToHours, // ageInHrs
              true, // active,
              callback,
            );
          });

        }
      }
    }
  });
}

function findMatchingStrategies(symbol, callback) {
  TestStrategyModel.find({currencies: { $in: [symbol] }}, (err, strategies) => {
    if (err) {
      console.log('Error: ' + err);
    } else {
      let assignedStrategyIDList = [];
      for (let i = 0; i < strategies.length; i++) {
        assignedStrategyIDList.push(strategies[i]._id);
      }
      callback(assignedStrategyIDList);
    }
  });
}

/***********************************************************************************/

// 0. drop test database
// 1. create a TestPriceAlert
// 2. create a TestUser and a TestStrategy
// 3. create a TestActiveAlert
// 4. iterate and check strategies to see if TestNotifications are needed

/***********************************************************************************/

// test profit
// var testReason = REASON_ENUM[0];

// test stop loss
var testReason = REASON_ENUM[1];

var TEST_CURRENCY = {
  symbol: 'ETH',
  timestamp: 1536445112,
  historicalData: [],
  hoursOfDataStored: 0,
  alertId: 1
};

var TEST_USER = {
  cellphone: 7861111223,
  active: true,
  email: 'fr1aa@fra.com',
};

var TEST_STRATEGY = {
  symbol: 'ETH',
  profitTake: 15,
  stopLoss: 3,
  timeOut: 78,
  currencies: ['ETH', 'BTC', 'ICX'],
};

setTimeout(() => {
  console.log('Dropping DB before test');
  // 0. drop test database
  mongoose.connection.db.dropDatabase();
  setTimeout(() => {
    // 1. create a TestPriceAlert
    addToDBCollection(TEST_CURRENCY.symbol, TEST_CURRENCY.timestamp, TEST_CURRENCY.historicalData, TEST_CURRENCY.hoursOfDataStored, TEST_CURRENCY.alertId, () => {
      // 2. create a TestUser and a TestStrategy
      createTestUser(TEST_USER.cellphone, TEST_USER.active, TEST_USER.email, null, null, null, () => {
        // 3. create a TestActiveAlert
        createNewActiveAlerts(() => {
          // 4. iterate and check strategies to see if TestNotifications are needed
          checkActiveAlerts();
        });
      }, TEST_STRATEGY);
    });
  }, 1000);
}, 3000);

/***********************************************************************************/
/***********************************************************************************/

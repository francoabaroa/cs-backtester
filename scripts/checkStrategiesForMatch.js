const axios = require('axios');
const CSConstants = require('../constants/CSConstants');
const mongoose = require('mongoose');
const utils = require('../utils/utils');

const ActiveAlertModel = require('../models/ActiveAlertModel');
const NotificationModel = require('../models/NotificationModel');
const PriceAlertModel = require('../models/PriceAlertModel');
const StrategyModel = require('../models/StrategyModel');

const convert = require('convert-units');

mongoose.Promise = Promise;
mongoose.connect(
  process.env.MONGO,
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
  NotificationModel.create({
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
        console.log('NotificationModel: ', notification);
      }
  });
}

function calculatePerfPercent(currentPrice, startPrice) {
  // default to BTC, unless it IS BTC
  const diff = (currentPrice/startPrice);
  let percent = 1 - diff;
  const negative = percent < 0 ? false : true;
  const finalResult = percent * 100;
  return negative ? -Math.abs(finalResult) : Math.abs(finalResult);
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
                StrategyModel.findOne({_id: activeAlerts[i].assignedStrategiesList[j], currencies: { $in: [symbol] } }, (err, strategy) => {
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

// Go through active alerts
checkActiveAlerts();

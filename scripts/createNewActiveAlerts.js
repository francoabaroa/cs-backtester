const CSConstants = require('../constants/CSConstants');
const mongoose = require('mongoose');
const request = require('request');
const utils = require('../utils/utils');
const axios = require('axios');

const convert = require('convert-units');

const ActiveAlertModel = require('../models/ActiveAlertModel');
const PriceAlertModel = require('../models/PriceAlertModel');
const StrategyModel = require('../models/StrategyModel');

mongoose.Promise = Promise;
mongoose.connect(
  process.env.MONGO,
  {
    useNewUrlParser: true
  }
);

function addActiveAlertToDB(
  alertId,
  currentBtcPrice,
  currentUsdPrice,
  notifiedStrategiesList,
  assignedStrategiesList,
  performancePercent,
  timeSinceAlertedInHrs,
  ageInHrs,
  active
) {
  ActiveAlertModel.findOne({
    alertId: alertId
  }, (err, alert) => {
    if (alert) {
      console.log('ActiveAlert exists');
    } else {
      ActiveAlertModel.create({
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
          }
      });
    }
  });
}

function createNewActiveAlerts() {
  PriceAlertModel.find((err, alerts) => {
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
              true // active
            );
          });

        }
      }
    }
  });
}

function findMatchingStrategies(symbol, callback) {
  StrategyModel.find({currencies: { $in: [symbol] }}, (err, strategies) => {
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

// createNewActiveAlerts();


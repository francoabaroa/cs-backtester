#!/usr/bin/env node

const axios = require('axios');
const CSConstants = require('../constants/CSConstants');
const mongoose = require('mongoose');
const PriceAlertModel = require('../models/PriceAlertModel');
const request = require('request');
const utils = require('../utils/utils');

mongoose.Promise = Promise;
mongoose.connect(
  CSConstants.mongoCSDatabase,
  {
    useNewUrlParser: true
  }
);

let successfullyCreated = 0;

function addToDBCollection(
  symbol,
  startTime,
  historicalData,
  hoursOfDataStored,
  alertId,
  btcPriceAtAlertTime,
  usdPriceAtAlertTime,
  storedDataApiUrl,
) {
  PriceAlertModel.findOne({
    _id: {
        symbol: `${symbol}`,
        startTime,
    }
  }, (err, alert) => {
    if (alert) {
      console.log(symbol + startTime + CSConstants.alertExists);
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
        btcPriceAtAlertTime: btcPriceAtAlertTime || 0,
        usdPriceAtAlertTime: usdPriceAtAlertTime || 0,
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

addToDBCollection('BTC', 1536033677, [], 0, 500, null, 5000);




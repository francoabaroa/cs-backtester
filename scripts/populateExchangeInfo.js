const axios = require('axios');
const CSConstants = require('../constants/CSConstants');
const mongoose = require('mongoose');
const request = require('request');
const utils = require('../utils/utils');

const ExchangeModel = require('../models/ExchangeModel');

const headers = {
  'Accept': CSConstants.mimeTypeJson,
};

const options = {
  url: CSConstants.googleSheetsApiUrl,
  headers: headers
};

mongoose.Promise = Promise;
mongoose.connect(
  process.env.MONGO,
  {
    useNewUrlParser: true
  }
);

let alertDataObjects = [];
let successfullyCreated = 0;

function addToDBCollection(name, currenciesSupported) {
  ExchangeModel.findOne({
    name: name
  }, (err, alert) => {
    if (alert) {
      console.log(symbol + startTime + CSConstants.alertExists);
    } else {
      ExchangeModel.create({
        name: name,
        currenciesSupported: currenciesSupported,
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

function getExchangeStuff(url, exchangeName) {
  let currenciesMap = {};
  axios.get(url).then(res => {
    for (var property in res.data) {
      currenciesMap[property] = property;
    }
    // addToDBCollection(exchangeName, currenciesMap);
  }).catch(function (error) {
    console.log(CSConstants.axiosError, error);
  });
}

// let url = '';
// getExchangeStuff(url);


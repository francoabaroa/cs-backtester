const cors = require('cors');
const CSConstants = require('./constants/CSConstants');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const PriceAlertModel = require('./PriceAlertModel');
const TestModel = require('./tests/TestModel');
const utils = require('./utils/utils');

const app = express();
app.use(cors());

mongoose.Promise = Promise;
mongoose.connect(
  CSConstants.mongoCSDatabase,
  {
    useNewUrlParser: true
  }
);

app.get('/alerts', (req, res) => {
  PriceAlertModel.find((err, alerts) => {
    if (err) {
        res.send(err);
    } else {
        res.send(alerts);
    }
  });
});

app.get('/backtest', (req, res) => {
  const {loss, profit, timeOut, top, coins} = utils.getUrlParams(req.originalUrl);
  let query = {};
  let selectedCoins = coins ? JSON.parse(coins) : null;

  if (!isNaN(top)) {
    query = { hoursOfDataStored: { $gte: timeOut}, lastRank: { $lte: top} };
  } else if (Array.isArray(selectedCoins) && selectedCoins.length > 0) {
    query = { hoursOfDataStored: { $gte: timeOut}, symbol: { $in: selectedCoins } };
  } else {
    query = { hoursOfDataStored: { $gte: timeOut} };
  }

  PriceAlertModel.find(query, (err, alerts) => {
    if (err) {
      res.send(err);
    } else {
      res.send(utils.processAlerts(alerts, profit, loss, timeOut));
    }
  });
});

app.get('/pricealerts', (req, res) => {
  PriceAlertModel.find((err, alerts) => {
    if (err) {
        res.send(err);
    } else {
        res.send(alerts);
    }
  });
});

app.get('/alertsymbols', (req, res) => {
  PriceAlertModel.find({ hoursOfDataStored: { $gte: 1} }, (err, alerts) => {
    if (err) {
        res.send(err);
    } else {
      let alertSymbolsMap = {};
      let alertSymbols = [];
      for (let i = 0; i < alerts.length; i++) {
        let symbol = alerts[i].symbol.trim();
        if (!alertSymbolsMap[symbol]) {
          alertSymbolsMap[symbol] = symbol;
          alertSymbols.push(symbol);
        }
      }
      res.send(alertSymbols);
    }
  });
});

app.get('/testalerts', (req, res) => {
  TestModel.find((err, alerts) => {
    if (err) {
        res.send(err);
    } else {
        res.send(alerts);
    }
  });
});

app.get('/backtesttest', (req, res) => {
  const {loss, profit, timeOut} = utils.getUrlParams(req.originalUrl);

  TestModel.find({ hoursOfDataStored: { $gte: timeOut} }, (err, alerts) => {
    if (err) {
      res.send(err);
    } else {
      res.send(utils.processAlerts(alerts, profit, loss, timeOut));
    }
  });
});

app.get('*', function(req, res) {
  res.status(404).send(CSConstants.nothingToSee);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
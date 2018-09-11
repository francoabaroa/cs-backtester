const cors = require('cors');
const CSConstants = require('./constants/CSConstants');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const PriceAlertModel = require('./models/PriceAlertModel');
const TestModel = require('./tests/TestModel');
const utils = require('./utils/utils');
require('dotenv').config();

const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN).lookups.v1;

function verify(phoneNumber) {
  return client.phoneNumbers(phoneNumber).fetch()
    .then(numberData => true, err => false);
}

const app = express();
app.use(cors());

mongoose.Promise = Promise;
mongoose.connect(
  process.env.MONGO,
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
  const {loss, profit, timeOut, top, coins, includeFees, start, end, timeDelay} = utils.getUrlParams(req.originalUrl);
  let query = {};
  let selectedCoins = coins ? JSON.parse(coins) : null;
  let includeExchangeFees = includeFees === 'true' ? true : false;

  if (!isNaN(top)) {
    query = { hoursOfDataStored: { $gte: timeOut}, lastRank: { $lte: top} };
  } else if (Array.isArray(selectedCoins) && selectedCoins.length > 0) {
    query = { hoursOfDataStored: { $gte: timeOut}, symbol: { $in: selectedCoins } };
  } else {
    query = { hoursOfDataStored: { $gte: timeOut} };
  }

  if (!isNaN(start) && !isNaN(end)) {
    query.startTime = { $gte: start, $lte: end };
  }

  PriceAlertModel.find(query, (err, alerts) => {
    if (err) {
      res.send(err);
    } else {
      res.send(utils.processAlerts(alerts, profit, loss, timeOut, includeExchangeFees));
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

app.post('/savestrategy', function(req, res) {
  // TODO: restrict appropriately
  // TODO: new user VS existing user
  const userId = req.body.userId;
  const profitTakePercent = req.body.profitTakePercent;
  const stopLossPercent = req.body.stopLossPercent;
  const timeOutPeriodInHrs = req.body.timeOutPeriodInHrs;
  const currencies = req.body.currencies;
  const exchanges = req.body.exchanges;

  StrategyModel.create({
    userId,
    profitTakePercent,
    stopLossPercent,
    timeOutPeriodInHrs,
    currencies,
    exchanges,
  }, (err, strategy) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        console.log('Strategy saved: ', strategy.id);
        res.send('Strategy saved');
      }
  });
});

app.post('/createuser', function(req, res) {
  // TODO: restrict appropriately
  // TODO: validation on cellphone
  const cellphone = req.body.cellphone;
  const email = req.body.email;
  const preferences = req.body.preferences;
  UserModel.create({
    cellphone,
    active: true,
    email,
    passwordHash: null,
    preferences,
    settings: [],
  }, (err, user) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        console.log('User created');
        res.send(user.id);
      }
  });
});

app.get('/check/:number', (req, res) => {
  verify(req.params.number)
    .then(valid => {
      res.send({ valid });
    })
    .catch(err => {
      console.error(err.message);
      res.status(500).send('An unexpected error occurred');
    });
});

app.get('*', function(req, res) {
  res.status(404).send(CSConstants.nothingToSee);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
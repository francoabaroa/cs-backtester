const cors = require('cors');
const CSConstants = require('./constants/CSConstants');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const PriceAlertModel = require('./models/PriceAlertModel');
const StrategyModel = require('./models/StrategyModel');
const UserModel = require('./models/UserModel');

const TestStrategyModel = require('./tests/TestStrategyModel');
const TestUserModel = require('./tests/TestUserModel');

/* const TestModel = require('./tests/TestModel'); */
const utils = require('./utils/utils');
require('dotenv').config();

const axios = require('axios');
const twilio = require('twilio');
const bodyParser = require('body-parser')
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN).lookups.v1;
const queryString = require('query-string');

function verify(phoneNumber) {
  return client.phoneNumbers(phoneNumber).fetch()
    .then(numberData => true, err => false);
}

const app = express();
app.use(cors());
app.use(bodyParser.json())

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

app.get('/top', (req, res) => {
  const url = req.originalUrl.substring(req.originalUrl.indexOf("?") + 1);
  let cmcUrl = 'https://api.coinmarketcap.com/v2/ticker/?limit=' + queryString.parse(url).top + '&structure=array'
  axios.get(cmcUrl).then(cmcResponse => {
    let data = cmcResponse.data.data;
    if (data.length > 0) {
      let alertSymbolsMap = {};
      let alertSymbols = [];
      for (let i = 0; i < data.length; i++) {
        if (!alertSymbolsMap[data[i].symbol]) {
          alertSymbolsMap[data[i].symbol] = data[i].symbol;
          alertSymbols.push(data[i].symbol);
        }
      }
      res.send(alertSymbols);
    }
  }).catch(function (error) {
    console.log(CSConstants.axiosError, error);
  });
});

/*
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
*/

app.post('/savestrategy', function(req, res) {
  // TODO: restrict appropriately
  // TODO: new user VS existing user
  const userId = req.body.userId;
  const active = req.body.active;
  const profitTakePercent = req.body.profitTakePercent;
  const stopLossPercent = req.body.stopLossPercent;
  const timeOutPeriodInHrs = req.body.timeOutPeriodInHrs;
  const currencies = req.body.currencies;
  const exchanges = req.body.exchanges;

  StrategyModel.create({
    active,
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
  const active = req.body.active;
  const cellphone = req.body.cellphone;
  const email = req.body.email;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const preferences = req.body.preferences;
  const surveyAnswers = req.body.surveyAnswers;

  UserModel.create({
    cellphone,
    active,
    email,
    firstName,
    lastName,
    passwordHash: null,
    preferences,
    settings: [],
    surveyAnswers,
  }, (err, user) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        console.log('User created');
        res.send(user.id);
      }
  });
});

app.post('/saveteststrategy', function(req, res) {
  // TODO: restrict appropriately
  // TODO: new user VS existing user
  const userId = req.body.userId;
  const active = req.body.active;
  const profitTakePercent = req.body.profitTakePercent;
  const stopLossPercent = req.body.stopLossPercent;
  const timeOutPeriodInHrs = req.body.timeOutPeriodInHrs;
  const currencies = req.body.currencies;
  const exchanges = req.body.exchanges;

  TestStrategyModel.create({
    active,
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

app.post('/createtestuser', function(req, res) {
  // TODO: restrict appropriately
  // TODO: validation on cellphone
  console.log('req create test user', req.body);
  const active = req.body.active;
  const cellphone = req.body.cellphone;
  const email = req.body.email;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const preferences = req.body.preferences;
  const surveyAnswers = req.body.surveyAnswers;

  TestUserModel.create({
    cellphone,
    active,
    email,
    firstName,
    lastName,
    passwordHash: null,
    preferences,
    settings: [],
    surveyAnswers,
  }, (err, user) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        console.log('User created');
        let testObj = {
          userId: user.id
        };
        res.send(testObj);
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

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on ${port}`));
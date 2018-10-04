const cors = require("cors");
const CSConstants = require("./constants/CSConstants");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const PriceAlertModel = require("./models/PriceAlertModel");
const StrategyModel = require("./models/StrategyModel");
const UserModel = require("./models/UserModel");

const TestStrategyModel = require("./tests/TestStrategyModel");
const TestUserModel = require("./tests/TestUserModel");

const utils = require("./utils/utils");
require("dotenv").config();

const axios = require("axios");
const twilio = require("twilio");
const bodyParser = require("body-parser");
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN)
  .lookups.v1;
const queryString = require("query-string");
const validator = require("email-validator");

function verify(phoneNumber) {
  return client
    .phoneNumbers(phoneNumber)
    .fetch()
    .then(numberData => true, err => false);
}

const app = express();
app.use(bodyParser.json());
app.use(cors());

mongoose.Promise = Promise;
mongoose.connect(
  process.env.MONGO,
  {
    useNewUrlParser: true
  }
);

app.get("/alerts", (req, res) => {
  PriceAlertModel.find((err, alerts) => {
    if (err) {
      res.send(err);
    } else {
      res.send(alerts);
    }
  });
});

app.get("/backtest", (req, res) => {
  const {
    loss,
    profit,
    timeOut,
    top,
    coins,
    includeFees,
    start,
    end,
    timeDelay
  } = utils.getUrlParams(req.originalUrl);
  let query = {};
  let selectedCoins = coins ? JSON.parse(coins) : null;
  let includeExchangeFees = includeFees === "true" ? true : false;

  if (!isNaN(top)) {
    query = { hoursOfDataStored: { $gte: timeOut }, lastRank: { $lte: top } };
  } else if (Array.isArray(selectedCoins) && selectedCoins.length > 0) {
    query = {
      hoursOfDataStored: { $gte: timeOut },
      symbol: { $in: selectedCoins }
    };
  } else {
    query = { hoursOfDataStored: { $gte: timeOut } };
  }

  if (!isNaN(start) && !isNaN(end)) {
    query.startTime = { $gte: start, $lte: end };
  }

  PriceAlertModel.find(query, (err, alerts) => {
    if (err) {
      res.send(err);
    } else {
      res.send(
        utils.processAlerts(alerts, profit, loss, timeOut, includeExchangeFees)
      );
    }
  });
});

app.get("/alertsymbols", (req, res) => {
  PriceAlertModel.find({ hoursOfDataStored: { $gte: 1 } }, (err, alerts) => {
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

app.get("/top", (req, res) => {
  const url = req.originalUrl.substring(req.originalUrl.indexOf("?") + 1);
  let cmcUrl =
    "https://api.coinmarketcap.com/v2/ticker/?limit=" +
    queryString.parse(url).top +
    "&structure=array";
  let topCoinsNumber = parseInt(queryString.parse(url).top);

  if (topCoinsNumber > 250 || (topCoinsNumber > 100 && topCoinsNumber < 250)) {
    res.send(
      "Sorry, this endpoint only supports values less than 100, or equal to 250"
    );
  } else if (topCoinsNumber === 250) {
    /*
        (Per CMC API guidelines)

        This endpoint displays cryptocurrency ticker data in order of rank.
        The maximum number of results per call is 100.
        Pagination is possible by using the start and limit parameters.

        ¯\_(ツ)_/¯ Yes, I was lazy and repeated the same logic 3 times ¯\_(ツ)_/¯
    */
    let cmcUrl =
      "https://api.coinmarketcap.com/v2/ticker/?limit=100&structure=array";
    axios
      .get(cmcUrl)
      .then(cmcResponse => {
        let alertSymbolsMap = {};
        let alertSymbols = [];
        let data = cmcResponse.data.data;
        if (data.length > 0) {
          for (let i = 0; i < data.length; i++) {
            if (!alertSymbolsMap[data[i].symbol]) {
              alertSymbolsMap[data[i].symbol] = data[i].symbol;
              alertSymbols.push(data[i].symbol);
            }
          }
          cmcUrl =
            "https://api.coinmarketcap.com/v2/ticker/?start=101&limit=100&structure=array";
          axios
            .get(cmcUrl)
            .then(cmcResponse2 => {
              let data = cmcResponse2.data.data;
              if (data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                  if (!alertSymbolsMap[data[i].symbol]) {
                    alertSymbolsMap[data[i].symbol] = data[i].symbol;
                    alertSymbols.push(data[i].symbol);
                  }
                }
                cmcUrl =
                  "https://api.coinmarketcap.com/v2/ticker/?start=201&limit=50&structure=array";
                axios
                  .get(cmcUrl)
                  .then(cmcResponse3 => {
                    let data = cmcResponse3.data.data;
                    if (data.length > 0) {
                      for (let i = 0; i < data.length; i++) {
                        if (!alertSymbolsMap[data[i].symbol]) {
                          alertSymbolsMap[data[i].symbol] = data[i].symbol;
                          alertSymbols.push(data[i].symbol);
                        }
                      }
                      res.send(alertSymbols);
                    }
                  })
                  .catch(function(error) {
                    console.log(CSConstants.axiosError, error);
                  });
              }
            })
            .catch(function(error) {
              console.log(CSConstants.axiosError, error);
            });
        }
      })
      .catch(function(error) {
        console.log(CSConstants.axiosError, error);
      });
  } else {
    axios
      .get(cmcUrl)
      .then(cmcResponse => {
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
      })
      .catch(function(error) {
        console.log(CSConstants.axiosError, error);
      });
  }
});

app.post("/savestrategy", function(req, res) {
  const userId = req.body.userId;
  const active = req.body.active;
  const profitTakePercent = req.body.profitTakePercent;
  const stopLossPercent = req.body.stopLossPercent;
  const timeOutPeriodInHrs = req.body.timeOutPeriodInHrs;
  const currencies = req.body.currencies;
  const exchanges = req.body.exchanges;

  StrategyModel.create(
    {
      active,
      userId,
      profitTakePercent,
      stopLossPercent,
      timeOutPeriodInHrs,
      currencies,
      exchanges
    },
    (err, strategy) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        res.send("Strategy saved");
      }
    }
  );
});

app.post("/createuser", function(req, res) {
  const active = req.body.active;
  const cellphone = req.body.cellphone;
  const email = req.body.email;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const preferences = req.body.preferences;
  const surveyAnswers = req.body.surveyAnswers;

  UserModel.findOne(
    {
      cellphone: cellphone
    },
    (err, user) => {
      if (user) {
        user.active = active;
        user.cellphone = cellphone;
        user.email = email;
        user.firstName = firstName;
        user.lastName = lastName;
        user.preferences = preferences;
        user.surveyAnswers = surveyAnswers;
        user.save();
        let response = {
          userId: user.id
        };
        res.send(response);
      } else {
        UserModel.create(
          {
            cellphone,
            active,
            email,
            firstName,
            lastName,
            passwordHash: null,
            preferences,
            settings: [],
            surveyAnswers
          },
          (err, newUser) => {
            if (err) {
              console.log(CSConstants.error, err);
            } else {
              let response = {
                userId: newUser.id
              };
              res.send(response);
            }
          }
        );
      }
    }
  );
});

app.post("/saveteststrategy", function(req, res) {
  const userId = req.body.userId;
  const active = req.body.active;
  const profitTakePercent = req.body.profitTakePercent;
  const stopLossPercent = req.body.stopLossPercent;
  const timeOutPeriodInHrs = req.body.timeOutPeriodInHrs;
  const currencies = req.body.currencies;
  const exchanges = req.body.exchanges;

  TestStrategyModel.create(
    {
      active,
      userId,
      profitTakePercent,
      stopLossPercent,
      timeOutPeriodInHrs,
      currencies,
      exchanges
    },
    (err, strategy) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        res.send("Strategy saved");
      }
    }
  );
});

app.post("/createtestuser", function(req, res) {
  const active = req.body.active;
  const cellphone = req.body.cellphone;
  const email = req.body.email;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const preferences = req.body.preferences;
  const surveyAnswers = req.body.surveyAnswers;

  TestUserModel.findOne(
    {
      cellphone: cellphone
    },
    (err, user) => {
      if (user) {
        user.active = active;
        user.cellphone = cellphone;
        user.email = email;
        user.firstName = firstName;
        user.lastName = lastName;
        user.preferences = preferences;
        user.surveyAnswers = surveyAnswers;
        user.save();
        let response = {
          userId: user.id,
          existing: true
        };
        res.send(response);
      } else {
        TestUserModel.create(
          {
            cellphone,
            active,
            email,
            firstName,
            lastName,
            passwordHash: null,
            preferences,
            settings: [],
            surveyAnswers
          },
          (err, newUser) => {
            if (err) {
              console.log(CSConstants.error, err);
            } else {
              let response = {
                userId: newUser.id
              };
              res.send(response);
            }
          }
        );
      }
    }
  );
});

app.get("/validemail/:email", (req, res) => {
  let isValid = validator.validate(req.params.email);
  res.send({ isValid });
});

app.get("/getphoneslist/:symbol", (req, res) => {
  let symbol = req.params.symbol;
  let phones = [];
  StrategyModel.find({ currencies: { $in: [symbol] } }, (err, strategies) => {
    if (err) {
      console.log(CSConstants.error, err);
    } else {
      let userIds = [];
      for (let i = 0; i < strategies.length; i++) {
        userIds.push(mongoose.Types.ObjectId(strategies[i].userId));
      }
      UserModel.find(
        {
          _id: { $in: userIds }
        },
        function(err, users) {
          if (err) {
            console.log(CSConstants.error, err);
          } else if (users) {
            for (let j = 0; j < users.length; j++) {
              phones.push(users[j].cellphone);
            }
          }
          res.send({ phonesList: phones });
        }
      );
    }
  });
});

app.get("/getphoneslisttest/:symbol", (req, res) => {
  let symbol = req.params.symbol;
  let phones = [];
  TestStrategyModel.find(
    { currencies: { $in: [symbol] } },
    (err, strategies) => {
      if (err) {
        console.log(CSConstants.error, err);
      } else {
        let userIds = [];
        for (let i = 0; i < strategies.length; i++) {
          userIds.push(mongoose.Types.ObjectId(strategies[i].userId));
        }
        TestUserModel.find(
          {
            _id: { $in: userIds }
          },
          function(err, users) {
            if (err) {
              console.log(CSConstants.error, err);
            } else if (users) {
              for (let j = 0; j < users.length; j++) {
                phones.push(users[j].cellphone);
              }
            }
            res.send({ phonesList: phones });
          }
        );
      }
    }
  );
});

app.get("/check/:number", (req, res) => {
  verify(req.params.number)
    .then(valid => {
      res.send({ valid });
    })
    .catch(err => {
      console.error(err.message);
      res.status(500).send("An unexpected error occurred");
    });
});

app.get("*", function(req, res) {
  res.status(404).send(CSConstants.nothingToSee);
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on ${port}`));

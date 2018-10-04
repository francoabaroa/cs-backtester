const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ExchangeSchema = new Schema({
  name: { type: String, unique: true },
  currenciesSupported: [Schema.Types.Mixed]
});

module.exports = mongoose.model("Exchange", ExchangeSchema);

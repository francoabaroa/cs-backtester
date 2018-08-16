const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const PriceAlertSchema = new Schema({
  _id: {
    symbol: String,
    startTime: Number,
  },
  history: [Schema.Types.Mixed],
  hoursOfDataStored: Number,
  symbol: String,
  lastRank: { type: Number, default: null },
  startTime: Number,
});

module.exports = mongoose.model('PriceAlert', PriceAlertSchema);
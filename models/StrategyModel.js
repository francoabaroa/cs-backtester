const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StrategySchema = new Schema({
  // _id: {
  //   symbol: String,
  //   startTime: Number,
  // },
  // primary key??
  // strategyId: Number,
  profitTakePercent: Number,
  stopLossPercent: Number,
  timeOutPeriodInHrs: Number,
  currencies: [Schema.Types.Mixed],
  exchanges: [Schema.Types.Mixed],
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Strategy', StrategySchema);
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const StrategySchema = new Schema({
  profitTakePercent: Number,
  // stopLossPercent must be +
  stopLossPercent: Number,
  timeOutPeriodInHrs: Number,
  currencies: [Schema.Types.Mixed],
  exchanges: [Schema.Types.Mixed],
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  active: Boolean
});

module.exports = mongoose.model("Strategy", StrategySchema);

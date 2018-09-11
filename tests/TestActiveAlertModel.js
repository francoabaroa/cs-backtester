const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const TestActiveAlertSchema = new Schema({
  alertId: { type: {
    symbol: String,
    startTime: Number,
  }, ref: 'PriceAlert', unique: true },
  currentBtcPrice: Number,
  currentUsdPrice: Number,
  notifiedStrategiesList: [{ type: Schema.Types.ObjectId, ref: 'Strategy' }],
  assignedStrategiesList: [{ type: Schema.Types.ObjectId, ref: 'Strategy' }],
  /*
    performancePercent can be +/-;
    +, profit
    -, loss
  */
  performancePercent: Number,
  timeSinceAlertedInHrs: Number,
  ageInHrs: Number,
  active: Boolean,
});

module.exports = mongoose.model('TestActiveAlert', TestActiveAlertSchema);
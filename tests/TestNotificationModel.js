const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const REASON_ENUM = ['PROFIT', 'LOSS', 'TIMEOUT'];

const TestNotificationSchema = new Schema({
  result: Number,
  reason: {
    type: String,
    enum : REASON_ENUM,
    default: null
  },
  notified: Boolean,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  notificationId: {
    type: String,
    unique: true,
  },
  // need to set a unique ID that is alertId + userId
  // Does alertId have to be unique?
  alertId: { type: {
    symbol: String,
    startTime: Number,
  }, ref: 'PriceAlert' },
  strategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
});

module.exports = mongoose.model('TestNotification', TestNotificationSchema);
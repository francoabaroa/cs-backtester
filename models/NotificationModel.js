const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const REASON_ENUM = ['PROFIT', 'LOSS', 'TIMEOUT'];

const NotificationSchema = new Schema({
  result: Number,
  reason: {
    type: String,
    enum : REASON_ENUM,
    default: null
  },
  notified: Boolean,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  // Does alertId have to be unique?
  alertId: { type: {
    symbol: String,
    startTime: Number,
  }, ref: 'PriceAlert' },
  strategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
});

module.exports = mongoose.model('Notification', NotificationSchema);
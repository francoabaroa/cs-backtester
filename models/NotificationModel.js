const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const REASON_ENUM = ['PROFIT', 'LOSS', 'TIMEOUT'];

const NotificationSchema = new Schema({
  // _id: {
  //   symbol: String,
  //   startTime: Number,
  // },
  result: Number,
  reason: {
    type: String,
    enum : REASON_ENUM,
    default: null
  },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  alertId: { type: Schema.Types.ObjectId, ref: 'Alert' },
  strategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
});

module.exports = mongoose.model('Notification', NotificationSchema);
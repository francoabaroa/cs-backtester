const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  // _id: {
  //   symbol: String,
  //   startTime: Number,
  // },
   // primary key??
  // userId: Number,
  cellphone: Number,
  active: Boolean,
  email: String,
  preferences: [Schema.Types.Mixed],
  settings: [Schema.Types.Mixed],
});

module.exports = mongoose.model('User', UserSchema);
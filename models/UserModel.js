const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  cellphone: {type: Number, unique: true},
  active: Boolean,
  email: String,
  firstName: String,
  lastName: String,
  passwordHash: String,
  preferences: [Schema.Types.Mixed],
  settings: [Schema.Types.Mixed],
  surveyAnswers: [Schema.Types.Mixed],
});

module.exports = mongoose.model('User', UserSchema);
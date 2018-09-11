const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TestUserSchema = new Schema({
  cellphone: {type: Number, unique: true},
  active: Boolean,
  email: String,
  passwordHash: String,
  preferences: [Schema.Types.Mixed],
  settings: [Schema.Types.Mixed],
});

module.exports = mongoose.model('TestUser', TestUserSchema);
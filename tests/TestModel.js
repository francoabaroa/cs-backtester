const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const TestSchema = new Schema({
  _id: {
    symbol: String,
    startTime: Number,
  },
  history: [Schema.Types.Mixed],
  hoursOfDataStored: Number,
});

module.exports = mongoose.model('Test', TestSchema);
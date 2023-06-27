const mongoose = require("mongoose");


const StatSchema = new mongoose.Schema({
  singleObjIdentifier: {
    type: String
  },
  profitData: {
    type: String
  },
  activeWagers : {
    type: String
  },
  withdrawalData: {
    type: String,
  },
  earningsData: {
    type: String,
  }
});

const StatData = mongoose.model('Stats', StatSchema, 'Stats');

module.exports = {
  StatData,
};

const mongoose = require("mongoose");


const VerifyEpicSchema = new mongoose.Schema({
  epic: {
    type: String,
  },
  username: {
    type: String,
  },
  id: {
    type: String,
  }
});

const VerifyEpicData = mongoose.model('VerifyEpicData', VerifyEpicSchema, 'VerifyEpicData');


module.exports = {
  VerifyEpicData,
};

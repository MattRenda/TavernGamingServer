const mongoose = require("mongoose");

// const AgreeCancelSchema = new mongoose.Schema({
//   player: String,
// });

const WagerDataSchema = new mongoose.Schema({
  wagerid: {
    type: String,
    unique: true,
  },
  agreedPlayers: {
    type: Array,
  },
  userThatPutUp: String,
  userThatPutUpBlue: String,
  userThatPutUpRed: String,
});

const WagerDataV2 = mongoose.model(
  "WagerDataV2",
  WagerDataSchema,
  "WagerDataV2"
);

module.exports = { WagerDataV2 };

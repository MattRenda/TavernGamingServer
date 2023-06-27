const mongoose = require("mongoose");

const WagerObjectSchema = new mongoose.Schema({
  wagerid: {
    type: String,
    index: true,
  },
  blueteamid: String,
  blue_users: [String],
  redteamid: String,
  red_users: [String],
  readied_users: [String],
  epics: [String],
  is_readied: [Boolean],

  bluesubmit: Number,
  redsubmit: Number,
  single_sub: Number,
  winner: Number,

  CANCEL_STATE: Number,
  JOIN_STATE: Number,
  READY_STATE: Number,
  PLAYING_STATE: Number,
  DONE_STATE: Number,
  DISPUTE_STATE: Number,
  state: Number,
  timer: Number,
  winTimer: Number,
  isTourneyMatch: Boolean,
});

const WagerObjectData = mongoose.model(
  "WagerObjects",
  WagerObjectSchema,
  "WagerObjects"
);

module.exports = {
  WagerObjectData,
  WagerObjectSchema,
};

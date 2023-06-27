const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  text: String,
  username: String,
});

const WagerSchema = new mongoose.Schema({
  blueteamid: String,
  redteamid: String,
  blueteam_users: [String],
  redteam_users: [String],
  entry_fee: Number,
  region: String,
  match_type: String,
  team_size: Number,
  first_to: Number,
  console_only: Boolean,
  done: Boolean,
  chat: [MessageSchema],
  cancelled: Boolean,
  paid_entry: Boolean,
  paid_prizes: Boolean,
  unique_value: {
    type: String,
    unique: true,
    sparse: true,
  },
  password: String,
  game: String,
  rematchSent: Boolean,
  rematchAccepted: Boolean,
  isTourneyMatch: Boolean,
  tourneyId: String,
  showMe: Boolean,
});

const WagerData = mongoose.model("Wagers", WagerSchema, "Wagers");

module.exports = { WagerSchema, WagerData };

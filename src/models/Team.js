const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
  name: String,
  usernames: {
    type: [String],
    index: true,
  },
  in_wager: {
    type: Boolean,
    index: true,
  },
  wager_id: String,
  win: Number,
  loss: Number,
  wins: Number,
  losses: Number,
  tourneyWins: Number,
  tourneyLosses: Number,
  tourneyEarnings: Number,
  
});

const TeamData = mongoose.model("Teams", TeamSchema, "Teams");

module.exports = { TeamSchema, TeamData };

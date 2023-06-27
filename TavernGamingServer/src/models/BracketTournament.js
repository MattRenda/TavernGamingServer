const mongoose = require("mongoose");
const { TeamSchema } = require("./Team");

const MatchSchema = new mongoose.Schema({
  redteamid: String,
  blueteamid: String,
  winner: Number,
  redteam_users: [Object],
  blueteam_users: [Object],
});
const TourneySchema = new mongoose.Schema({
  start_date: String,
  team_size: Number,
  game: String,
  region: String,
  match_type: String,
  first_to: Number,
  teams: [TeamSchema],
  teamIds: [String],
  num_teams: Number,
  state: Number,
  bracket: {
    num_rounds: Number,
    round: Number,
    matches: [[MatchSchema]],
  },
  title: String,
  description: String,
  prize: Number,
  entry_fee: Number,
  paid_prizes: Boolean,
  num_winners: Number,
  winners: [String],
  admins: [Object],
  format: Number,
  hosted_by: mongoose.Schema.Types.Mixed,
  rules: [String],
  thumbnail: String,
  prize_dist: [Object],
});

const BracketTourneyData = mongoose.model(
  "BracketTourneys",
  TourneySchema,
  "BracketTourneys"
);
const MatchData = mongoose.model("MatchData", MatchSchema, "MatchData");
// const RoundData = mongoose.model("RoundData", RoundSchema, "RoundData");

module.exports = { TourneySchema, BracketTourneyData, MatchData };

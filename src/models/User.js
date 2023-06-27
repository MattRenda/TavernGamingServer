const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    read: Boolean,
    body: String,
    actionable: Boolean,
    type: String,
    attached: mongoose.Schema.Types.Mixed,
    timestamp: Date,
    avatar: {
      type: Array,
    },
  },
  { _id: false }
);

const MatchHistorySchema = new mongoose.Schema({
  wager_id: String,
  game_mode: String,
  entry_fee: String,
  date: String,
  status: String,
  game: String,
  team_size: Number,
});

const UserDataSchema = new mongoose.Schema({
  username: {
    type: String,
    index: true,
  },
  epic: String,
  balance: { type: Number, minimum: 0 },
  teamid: String,
  role: Number,
  max_withdrawal: Number,
  pun_points: Number,
  is_banned: Boolean,
  unban_timestamp: Date,
  prior_bans: Number,
  notifications: [NotificationSchema],
  match_history: [MatchHistorySchema],
  avatar: {
    type: Array,
  },
  connections: {
    type: Array,
  },
});

const UserData = mongoose.model("UserData", UserDataSchema, "UserData");

module.exports = { UserData, UserDataSchema };

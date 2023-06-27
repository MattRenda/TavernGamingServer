const mongoose = require("mongoose");

const TeamNotificationSchema = new mongoose.Schema({
  text: String,
  teamId: String,
  name: String,
});

const UserTeamNotificationsData = new mongoose.Schema({
  username: {
    type: String,
  },
  notifications: {
    type: [TeamNotificationSchema],
  }
});

const UserTeamNotificationsModel = mongoose.model(
  "UserTeamNotificationsData",
  UserTeamNotificationsData,
  "UserTeamNotificationsData"
);

module.exports = { UserTeamNotificationsModel };

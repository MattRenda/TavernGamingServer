const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  read: Boolean,
  body: String,
  actionable: Boolean,
  type: String,
  attached: String
});

const UserNotificationsData = new mongoose.Schema({
  username: {
    type: String,
  },
  notifications: {
    type: [NotificationSchema],
  }
});

const NewNotificationData = mongoose.model(
  "NewNotificationData",
  UserNotificationsData,
  "NewNotificationData"
);

module.exports = { NewNotificationData };

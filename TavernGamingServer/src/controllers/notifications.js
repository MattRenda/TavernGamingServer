const { NewNotificationData } = require("../models/NewNotifications");
const { UserData } = require("../models/User");

const {
  getUserByName,
  getUserIdFromToken,
  getUserToken,
  getUsernameFromToken,
} = require("../utils/helperMethods");

const getNotificationsByName = (username, callback) => {
  NewNotificationData.findOne({ username }, (err, notifdata) => {
    if (err) {
      console.log("Noti error caught");
      return;
    }

    if (!notifdata) {
      // console.log("error");
      // callback with empty
      const newNotif = new NewNotificationData({
        username: username,
        notifications: [],
      });
      newNotif?.save({}, (err, data) => {
        if (err) {
          console.log("erroring in notis.js");
          return;
        }
      });
      callback(newNotif);
      return;
    } else {
      callback(notifdata);
    }
  });
};

const getNotifications = (req, res) => {
  const username = req.params.username;

  if (!username) {
    // console.log("no username!");
    return res.status(204).send({ error: true, message: "No username!" });
  }

  getNotificationsByName(username, (notifdata) => {
    return res
      .status(200)
      .send({ error: null, notifications: notifdata?.notifications });
  });
};

const clearNotificationHelper = async (username, callback) => {
  if (!username) {
    return res
      ?.status(200)
      ?.send({
        error: true,
        message: "No username involved with notification.",
      });
  }
  const notifdata = await UserData.findOne({ username: username });
  notifdata.notifications = [];
  notifdata?.save({}, () => {
    callback(notifdata);
  });
};

const clearNotifications = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  if (!username) {
    return res
      ?.status(409)
      ?.send({ error: true, message: "Username does not exist" });
  }

  const notifdata = await UserData.findOne({ username: username });
  notifdata.notifications = [];
  await notifdata?.save();
  return res
    .status(200)
    ?.send({ error: null, message: "Successfully cleared notifications." });
};

const dismissNotification = async (req, res) => {
  try {
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const notification = req.body.notification;

    if (!username) {
      return res
        ?.status(409)
        ?.send({ error: true, message: "No username associated with noti." });
    }

    const userData = await UserData.findOne({ username: username });

    const newNotis = userData.notifications.filter(
      (noti) =>
        new Date(noti?.timestamp)?.toString() !==
        new Date(notification?.timestamp)?.toString()
    );
    userData.notifications = newNotis;
    await userData?.save();
    return res?.status(200)?.send({ error: null, notis: newNotis });
  } catch (err) {
    console.log(err);
    return res
      ?.status(409)
      .send({ error: true, message: "Noti does not exist" });
  }
};

module.exports = {
  getNotifications,
  getNotificationsByName,
  clearNotifications,
  dismissNotification,
};

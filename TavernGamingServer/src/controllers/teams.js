const { TeamData } = require("../models/Team");
const { UserData } = require("../models/User");
const {
  getTeam,
  getUserByName,
  getUserToken,
  getUsernameFromToken,
} = require("../utils/helperMethods");
const { getNotificationsByName } = require("./notifications");

const createTeam = (req, res) => {
  const teamName = req.body.name;
  const username = req.body.username;

  if (!teamName) {
    return res.send({ error: true, message: "Must enter a team name!" });
  }

  TeamData.countDocuments({ usernames: username }, (err, count) => {
    if (err) {
      return res.send({ error: true, message: "Error counting teams!" });
    }
    if (count >= 10) {
      return res.send({
        error: true,
        message: "You can only be in 10 teams at a time!",
      });
    }

    let usernames = [];
    usernames.push(username);

    // create new team doc
    const newTeam = new TeamData({
      usernames,
      name: teamName,
      in_wager: false,
      wager_id: "",
      win: 0,
      loss: 0,
      wins: 0,
      losses: 0,
      tourneyWins: 0,
      tourneyLosses: 0,
      tourneyEarnings: 0,
    });
    newTeam.save();

    return res.send({ error: null, team: newTeam });
  });
};

const leaveTeam = async (req, res) => {
  const teamId = req.body.teamId;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  if (!teamId) {
    return res.send({ error: true, message: "Must include team id!" });
  }

  getTeam(teamId, (teamdata) => {
    if (!teamdata) {
      return res.send({ error: true, message: "This team does not exist" });
    }
    if (teamdata.in_wager == true) {
      return res.send({ error: true, message: "Cannot leave an active team." });
    }

    if (!teamdata?.usernames?.includes(username)) {
      return res.send({ error: true, message: "You are not in that team!" });
    }

    teamdata.usernames.splice(teamdata.usernames.indexOf(username), 1);
    teamdata.save({}, (err, data) => {
      if (err) {
        console.log("Catching team data save error");
        return;
      }
    });
    return res.status(200).send();
  });
};

const kickUser = async (req, res) => {
  const teamId = req.body.teamId;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);
  const userToKick = req.body.userToKick;

  if (!teamId) {
    return res.send({ error: true, message: "Must include team id!" });
  }

  getTeam(teamId, (teamdata) => {
    if (!teamdata) {
      return res.send({ error: true, message: "This team does not exist" });
    }
    if (teamdata.in_wager == true) {
      return res
        .status(409)
        .send({ error: true, message: "Cannot kick users while in a token." });
    }

    if (!teamdata?.usernames?.includes(username)) {
      return res.send({ error: true, message: "You are not in that team!" });
    }

    teamdata.usernames.splice(teamdata.usernames.indexOf(userToKick), 1);
    teamdata.save({}, (err, data) => {
      if (err) {
        console.log("Catching team data save error");
        return;
      }
    });
    return res.status(200).send();
  });
};

const joinTeam = async (req, res) => {
  try {
    const teamId = req.body.teamId;
    const userToken = getUserToken(req);
    const userToJoin = await getUsernameFromToken(userToken);
    const notification = req.body.notification;
    const userData = await UserData.findOne({ username: userToJoin });

    getTeam(teamId, (teamdata) => {
      if (teamdata?.in_wager) {
        // console.log("in match");
        return res.send({
          error: true,
          message: "You cannot join a team while they are in a match",
        });
      }

      TeamData.countDocuments({ usernames: userToJoin }, (err, count) => {
        // console.log("10 teams");
        if (count >= 10) {
          return res.send({
            error: true,
            message: "You may only be in 10 teams at a time",
          });
        }

        if (teamdata?.usernames?.includes(userToJoin)) {
          // console.log("in this team");
          return res.send({
            error: true,
            message: "You are already in this team",
            name: teamdata?.name,
          });
        } else {
          teamdata?.usernames?.push(userToJoin);
          teamdata?.save();
        }

        //   getUserByName(userToJoin, (userdata) => {
        //     const index = userdata?.newNotifications?.indexOf(notification);
        //     userdata?.newNotifications?.splice(index, 1);
        //     userdata?.save();
        //     return res.status(200).send();
        //   });
        const noti_to_change = userData?.notifications?.find(
          (noti) =>
            new Date(noti?.timestamp)?.toString() ===
            new Date(notification?.timestamp)?.toString()
        );
        const index = userData?.notifications?.indexOf(noti_to_change);
        if (index !== -1) {
          userData.notifications[index].read = true;
        }

        userData?.save({}, (err, data) => {
          if (err) {
            console.log("Erroring while showing notis.");
            return;
          }
        });
        return res.status(200).send({ error: null, team: teamdata });
      });
    });
  } catch (err) {
    console.log("Catching join team error");
    return;
  }
};

module.exports = {
  createTeam,
  leaveTeam,
  joinTeam,
  kickUser,
};

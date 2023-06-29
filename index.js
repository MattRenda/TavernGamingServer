const express = require("express");
const bodyParser = require("body-parser");
var cookieSession = require("cookie-session");
const fetch = require("node-fetch");
var async = require("async");
const path = require("path");
const cors = require("cors");
const passport = require("passport");
require("dotenv").config();
const arrayUniquePlugin = require("mongoose-unique-array");
const mongoose = require("mongoose");
const querystring = require("querystring");
const emailString = require("./public/emailString");
const emailStringPw = require("./public/emailStringPw");
const fs = require("fs");
const passportLocalMongoose = require("passport-local-mongoose");
const log = require("log-to-file");
const app = express();
const { constants } = require("./src/utils/constants");
// const { createAdapter } = require("@socket.io/redis-adapter");
// const { createClient } = require("redis");

const http = require("http");
const server = http.createServer(app);
const socketIo = require("socket.io");
const port = 8080;
var hash = require("object-hash");
const {
  login,
  register,
  renewToken,
  logout,
  verifyUserEmail,
} = require("./src/controllers/authenticate.js");
const {
  getWagers,
  getFirstThreeWagers,
  createWager,
  getActiveUserWagers,
  getCurrentWager,
  getCurrentWagerStatus,
  joinWager,
  readyUpAPI,
  submitWagerResult,
  forceWin,
  resetToken,
  punishUser,
  sendChat,
  getChat,
  markWagerComplete,
  getAgreedCancelUsers,
  getCurrentToken,
  acceptRematch,
} = require("./src/controllers/wagers.js");
const { verifyToken } = require("./src/middleware/verifyTokenMiddleware");
const {
  getUserById,
  getUserTeams,
  getUserByUsername,
  confirmPoofDeposit,
  getUserTransactions,
  getUserWithdrawals,
  setEpicData,
  setTempEpic,
  makeWithdrawal,
  resetTempEpic,
  getTempEpic,
  changeUserAvatar,
  getUserAvatar,
  getUserDeposits,
  markWithdrawal,
  setValUser,
  setClashUser,
  shopifyDeposit,
  squareIsGangStyll,
  setFivemUser,
} = require("./src/controllers/users");
const {
  createBracketTournament,
  joinBracketTournament,
  startBracketTournament,
  cancelBracketTournament,
  getAllBracketTournaments,
  getTournament,
  getListOfAdmins,
  cancelBracketTournamentEndpoint,
  leaveTournament,
  startBracketTournamentManually,
  kickTeamFromTournament,
  deleteBracketTournament,
  getTournaments,
} = require("./src/controllers/bracketTournaments");
const {
  resolve,
  win,
  submit,
  doesUsernameMatchToken,
  resetWagerBalance,
  getTokenObject,
  getUserToken,
  getUsernameFromToken,
  readNoti,
  bracketTournamentWin,
  bracketTournamentWinTick,
} = require("./src/utils/helperMethods");
const {
  createTeam,
  leaveTeam,
  joinTeam,
  kickUser,
} = require("./src/controllers/teams");
const { UserData, UserDataSchema } = require("./src/models/User");
const { UserDetails } = require("./src/models/UserDetail");
const { TeamData } = require("./src/models/Team");
const { WagerData } = require("./src/models/Wager");
const { ReferralData } = require("./src/models/Referral");
const { VerifyData } = require("./src/models/Verify");
const { WagerObjectData } = require("./src/models/WagerObject");
const { VerifyEpicData } = require("./src/models/Epic");
const { ActiveWagerData } = require("./src/models/ActiveWagers");

app.use((err, req, res, next) => {
  if (!err) {
    return next();
  }
  console.log(err);
  res.status(500);
  res.send("500: Internal server error");
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const corsOpts = {
  origin: constants.clientURL,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  origin: true,
  withCredentials: true,
};

app.use(cors(corsOpts));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", constants.clientURL); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(
  cookieSession({
    name: "session",
    keys: ["tokens"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);
app.use(express.static("public"));

const DONE_MATCH_EXP_TIME = 3 * 60;

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                    Setting up Passport + Mongoose                              //
////////////////////////////////////////////////////////////////////////////////////////////////////

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(`${process.env.MONGO_PASSWORD}`,  { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true },
() => {
  console.log('Connected to MongoDB');
});

// console.log(pwd);
// console.log(mongoose.connection.readyState);
// console.log(process.env.PORT);

mongoose.connection.on("connecting", () => {
  // console.log("connecting");
  // console.log(mongoose.connection.readyState); //logs 2
});
mongoose.connection.on("connected", () => {
  // console.log("connected");
  // console.log(mongoose.connection.readyState); //logs 1
});
mongoose.connection.on("disconnecting", () => {
  // console.log("disconnecting");
  // console.log(mongoose.connection.readyState); // logs 3
});
mongoose.connection.on("disconnected", () => {
  // console.log("disconnected");
  // console.log(mongoose.connection.readyState); //logs 0
});

var paypal_server = "sb-ze0ex11439293@business.example.com";

const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  auth: {
    user: "apikey",
    pass: "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",
  },
});
transporter.verify();

const Schema = mongoose.Schema;
const UserDetail = new Schema({ email: String });

UserDetail.plugin(passportLocalMongoose);

passport.use(UserDetails.createStrategy());
passport.serializeUser(UserDetails.serializeUser());
passport.deserializeUser(UserDetails.deserializeUser());

const connectEnsureLogin = require("connect-ensure-login");

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

var engines = require("consolidate");
const { verify } = require("crypto");
const {
  sendTeamInvite,
  sendReadyEvent,
  socketEvents,
  sendJoinEvent,
  sendSubmitEvent,
  sendCancelEvent,
  sendDoneEvent,
  sendDisputeEvent,
  sendResetEvent,
  sendForceEvent,
  sendTimerExpiredReadyEvent,
  sendNewTempEpicEvent,
  sendNewAgreeCancelEvent,
  cancelSocketHelper,
  sendNewRemoveAgreeCancelEvent,
  sendNewRematchEvent,
  sendNewBracketWinEvent,
} = require("./src/utils/socketHelperMethods.js");
const {
  getNotifications,
  clearNotifications,
  dismissNotification,
} = require("./src/controllers/notifications.js");
const { response } = require("express");
const {
  getAdminStats,
  getDisputes,
  addNote,
  addCode,
  getNotes,
  getReports,
  verifyUserPanel,
  getAdminStatsByEmail,
  getAdminStatsByEpic,
  banPlayer,
  resetEpic,
  unbanPlayer,
  getLogs,
  promoteUser,
  getReferrals,
  checkForAlts,
  getDepositByID,
  addUserReportNote,
  getValMatches,
  banPlayerChargeback,
} = require("./src/controllers/administrator");

const { getTotalEarningsLeaderboard } = require("./src/controllers/earnings");
const { getAllPendingWithdraws } = require("./src/controllers/admin");
const { ProfitData } = require("./src/models/Profit");
const { NoteData } = require("./src/models/NoteData");
const { WithdrawData } = require("./src/models/Withdraw");
const { StatData } = require("./src/models/Stats");
const { EarningsData } = require("./src/models/Earnings");
app.set("views", __dirname + "/public");
app.engine("html", engines.ejs);
app.set("view engine", "ejs");

app.set("views", __dirname + "/public");
app.engine("html", engines.ejs);
app.set("view engine", "ejs");

app.set("views", __dirname + "/public");
app.engine("html", engines.ejs);
app.set("view engine", "ejs");

// const VerifyEpicSchema = new mongoose.Schema({
//   epicId: {
//     type: String,
//     unique: true,
//   },
//   epicUsername: {
//     type: String,
//     unique: true,
//   },
//   tknsUsername: String,
// });

// const VerifyEpicData = mongoose.model('VerifyEpicData', VerifyEpicSchema, 'VerifyEpicData');

const ACTION_JOIN_TEAM = 0;

//UserData.notifications.remove();
UserData.createIndexes();
UserDataSchema.plugin(arrayUniquePlugin);

// UserData.on('index', function(err) {
//   if (err) {
//     console.error(err)
//   }
// );

// TeamData.createIndexes();

WagerObjectData.createIndexes();

// WagerObjectSchema.path('state').validate(function(value) {
//   //  // console.log("this.bluesubmit: " + this.bluesubmit);
//   //  // console.log("this.redsubmit: " + this.redsubmit);
//   //  // console.log("value" + value);
//  if (this.bluesubmit===-1 && this.redsubmit=== -1 && value===3) {
//     // // console.log("not saving");
//     log("Failed to save due to auto win bug")
//   return false
//  }else{
//   // // console.log("yes saving");
//   return true;
//  }
//   });

// const WithdrawSchema = new mongoose.Schema({
//   username: String,
//   paypal: String,
//   amount: Number,
//   time: Date,
//   unique_value: {
//     type: String,
//     unique: true,
//     sparse: true,
//   },
// });
// const WithdrawData = mongoose.model("Withdraws", WithdrawSchema, "Withdraws");
WithdrawData.createIndexes();

WagerData.createIndexes();

////////////////////////////////////////////////////////////////////////////////////////////////////

var currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// const filter = {};
// const all = await UserData.find(filter);

function resetNotis() {
  UserData.find({}, (err, data) => {
    data.forEach((obj) => {
      var x = [
        ...new Map(
          obj.notifications.map((item) => [item["data"], item])
        ).values(),
      ];
      obj.notifications = [];
      obj.save({}, (err, data) => {
        obj.notifications = x;
        obj.save();
      });
    });
  });
}

function checkBalance() {
  let profits = 0;
  UserData.find({}, (err, data) => {
    data.forEach((obj) => {
      if (err) {
        console.log(err);
        return;
      }
      if (data) {
        if (
          (obj.role == 1 || obj.role == 2) &&
          obj.balance <= 600 &&
          obj.balance > 0
        ) {
          profits += obj.balance - 5;
          console.log(obj.balance + " " + obj.username);
        }
      }
    });
    console.log("total user balance:" + profits);
  });
}

function resetEpics() {
  UserData.find({ epic: "testing" }, (err, data) => {
    if (data) {
      if (data?.epic) {
        data.forEach((obj) => {
          obj.save({}, (err, data) => {
            obj.epic = "";
            obj.save();
          });
        });
      }
    } else {
      console.log("erroring here");
    }
  });
}
//fixMaxWithdrawals();

function fixMaxWithdrawals() {
  UserData.find({}, (err, data) => {
    console.log(data.length);
    if (err) {
      console.log(err);
      return;
    }
    if (data) {
      data.forEach((obj) => {
        // console.log(obj.username);
        if (obj.balance >= 1) {
          if (obj.max_withdrawal > obj.balance) {
            //  console.log(obj.username + " " + obj.max_withdrawal  + " is greater than " + obj.balance);
            obj.max_withdrawal = obj.balance;
            obj.save({}, (error, data) => {
              console.log(
                obj.username +
                  " " +
                  obj.max_withdrawal +
                  " set to " +
                  obj.balance
              );

              if (error) {
                console.log(error);
                return;
              }
            });
          }
        }
      });
    } else {
      console.log("doing nothing");
    }
    return;
  });
}

function generateVerifyCode(username, email) {
  const unique_value = hash({
    username: username,
    time: new Date(),
  });

  var newCode = new VerifyData({
    username: username,
    verified: false,
    code: unique_value,
  });
  newCode.save();

  var url = "http://tkns.gg/verify?code=" + unique_value;
  sendVerificationEmail(email, url);
}

function sendVerificationEmail(userEmail, verifyUrl) {
  transporter
    .sendMail({
      from: '"Tkns.GG" <support@tkns.gg>', // sender address
      to: userEmail, // list of receivers
      subject: "Verify - Tkns.GG", // Subject line
      html: emailString
        .getEmailString()
        .replace("{#verification_code#}", verifyUrl)
        .replace("{#discord_invite#}", "https://www.discord.gg/tknsgg"), // html body
    })
    .then((info) => {
      // console.log({ info });
    })
    .catch(console.error);
}

function sendForgotPwEmail(email, verifyUrl) {
  const fullUrl = "http://tkns.gg/?forgot=" + verifyUrl;
  transporter
    .sendMail({
      from: '"Tkns.GG" <support@tkns.gg>', // sender address
      to: email, // list of receivers
      subject: "Forgot Password - Tkns.GG", // Subject line
      html: emailStringPw
        .getEmailStringPw()
        .replace("{#verification_code#}", fullUrl)
        .replace("{#discord_invite#}", "https://www.discord.gg/tknsgg"), // html body
    })
    .then((info) => {
      // console.log({ info });
    })
    .catch(console.error);
}

function isString(s) {
  return typeof s === "string" || s instanceof String;
}

function getUser(req, res, callback) {
  var username = req.user.username;

  if (!isString(username)) {
  }

  UserData.findOne({ username: username }, (err, userdata) => {
    if (err) {
      log(err);
    }

    if (!userdata) {
      var newUser = new UserData({
        username: req.user.username,
        balance: 0,
        role: 1,
        max_withdrawal: 0,
        pun_points: 0,
        is_banned: false,
        unban_timestamp: new Date(),
        prior_bans: 0,
        notifications: [],
        match_history: [],
        avatar: [],
      });
      newUser.save();
      userdata = newUser;
    }

    callback(req, res, userdata);
  });
}

function getUserByName(username, callback) {
  UserData.findOne({ username: username }, (err, userdata) => {
    if (err) {
      log(err);
    }

    callback(userdata);
  });
}

function getVerifiedUserByName(username, callback) {
  VerifyData.findOne({ username: username }, (err, data) => {
    if (err) {
      log(err);
    }

    callback(data);
  });
}

function getTeam(teamid, callback) {
  TeamData.findOne({ _id: teamid }, (err, teamdata) => {
    if (err) {
      log(err);
    }

    if (!teamdata) {
      log("Error finding team " + teamid.toString());
      return;
    }

    callback(teamdata);
  });
}

const getWagerObject = async (wagerid, callback) => {
  if (!wagerid) {
    return log("Error getting wager object, no wagerid passed");
  }

  try {
    const data = await WagerObjectData.findOne({ wagerid });
    if (!data) return;
    return callback(data);
  } catch (err) {
    console.log(err);
    return;
  }
};

function sendNotification(username, text, actionable, action, data, res) {
  getUserByName(username, (userdata) => {
    if (!userdata) {
      return res.status(409).send("User '" + username + "' does not exist.");
    }

    var newNotification = {
      text: text,
      actionable: actionable,
      action: action,
      data: data,
      invitation: data + username,
    };

    userdata.notifications.addToSet(newNotification);

    // userdata.save().then(result =>
    //   {
    //     return res.status(200).send();
    //   }).catch(err => {
    //     return res.status(409).send("You have already sent this player a notification.");
    //   });

    userdata.save(function (err, user) {
      if (err) {
        // console.log(err);
        res.status(409).send("Error sending notification.");
        return;
      }

      return res.status(200).send();
    });
  });
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                    NEW API ROUTES                                              //
////////////////////////////////////////////////////////////////////////////////////////////////////
const {
  NEW_GAME_MESSAGE_EVENT,
  NEW_NOTIFICATION_EVENT,
  NEW_READY_EVENT,
  NEW_CHAT_EVENT,
  NEW_JOIN_EVENT,
  NEW_SUBMIT_EVENT,
  NEW_CANCEL_EVENT,
  NEW_RESET_EVENT,
  NEW_FORCE_EVENT,
  NEW_TIMER_EXPIRED_READY_EVENT,
  NEW_EPIC_VERIFIED_EVENT,
  MEW_TEMP_EPIC_EVENT,
  NEW_AGREE_CANCEL_EVENT,
  REMOVE_ACTIVE_TOKEN,
  NEW_REMOVE_VOTE_CANCEL_EVENT,
  NEW_UPDATE_BALANCE_EVENT,
  NEW_REMOVE_CURRENT_TOKEN_EVENT,
  NEW_USER_AVATAR_EVENT,
  NEW_REMATCH_INVITE_EVENT,
  NEW_BRACKET_UPDATE_EVENT,
  NEW_TOURNAMENT_CREATED_EVENT,
  NEW_TOURNAMENT_REMOVED_EVENT,
  NEW_BRACKET_WIN_EVENT,
} = socketEvents;

const io = socketIo(server, {
  cors: {
    origin: constants.clientURL,
    methods: ["GET", "POST"],
  },
  secure: true,
  // transports: ["websocket", "polling"],
});

// const pubClient = createClient({
//   url: process.env.REDIS_TSL_URL,
//   socket: {
//     tls: true,
//     rejectUnauthorized: false,
//   },
// });
// const subClient = pubClient.duplicate();
// io.adapter(createAdapter(pubClient, subClient));

module.exports.io = io;

io.on("connection", (socket) => {
  // join a wager
  const { wagerId, username } = socket.handshake.query;
  socket.join(username);
  socket.join(wagerId);

  // listen for new messages
  socket.on(NEW_CHAT_EVENT, (data) => {
    io.in(wagerId).emit(NEW_CHAT_EVENT, {
      name: data?.name,
      message: data?.message,
    });
  });

  socket.on(NEW_BRACKET_WIN_EVENT, (bracketWinData) => {
    sendNewBracketWinEvent(io, bracketWinData);
  });

  socket.on("timerBalance", (timerBalanceData) => {
    const { users, tokenId } = timerBalanceData;
    users.forEach((user) => {
      UserData.findOne({ username: user }, (err, userdata) => {
        if (err || !userdata) {
          return;
        }
        io.in(user).emit("timerBalance", userdata.balance.toString());
      });
    });
  });

  // listen for a game message event (sending a message in chat as the match)
  socket.on(NEW_GAME_MESSAGE_EVENT, (data) => {
    io.in(wagerId).emit(NEW_GAME_MESSAGE_EVENT, {
      name: data?.name,
      message: data?.message,
    });
  });

  // new team notification TODO: change this to accept all notification types
  socket.on(NEW_NOTIFICATION_EVENT, (notification) => {
    // console.log("notif from server socket: ", notification);
    // console.log("new noti");
    sendTeamInvite(io, notification);
  });

  // listen for a user to join the current token
  socket.on(NEW_JOIN_EVENT, (joinEventData) => {
    // console.log("sending new join event");
    sendJoinEvent(io, joinEventData);
  });

  // listen for a user to ready up
  socket.on(NEW_READY_EVENT, (readyEventData) => {
    // ready event data is an object containing wagerId: and username: of the readied player
    sendReadyEvent(io, readyEventData);
  });

  // listen for submit event
  socket.on(NEW_SUBMIT_EVENT, (submitEventData) => {
    sendSubmitEvent(io, submitEventData);
  });

  // listen for cancel
  socket.on(NEW_CANCEL_EVENT, (cancelEventData) => {
    sendCancelEvent(io, cancelEventData);
  });

  // listen for reset
  socket.on(NEW_RESET_EVENT, (resetEventData) => {
    sendResetEvent(io, resetEventData);
  });

  // listen for force win
  socket.on(NEW_FORCE_EVENT, (forceEventData) => {
    sendForceEvent(io, forceEventData);
  });

  // listen for timer ready 0 event
  socket.on(NEW_TIMER_EXPIRED_READY_EVENT, (sendTimerExpiredReadyEventData) => {
    sendTimerExpiredReadyEvent(io, sendTimerExpiredReadyEventData);
  });

  socket.on(NEW_EPIC_VERIFIED_EVENT, (epic) => {
    sendNewTempEpicEvent(io, epic);
  });

  // listen for a new verified epic event
  socket.on(NEW_EPIC_VERIFIED_EVENT, (tempEpic) => {
    sendNewTempEpicEvent(io, tempEpic);
  });

  // listen for agreeing to cancel the match
  socket.on(NEW_AGREE_CANCEL_EVENT, (agreeCancelData) => {
    sendNewAgreeCancelEvent(io, agreeCancelData);
  });

  socket.on(NEW_REMOVE_VOTE_CANCEL_EVENT, (agreeCancelData) => {
    sendNewRemoveAgreeCancelEvent(io, agreeCancelData);
  });

  socket.on(NEW_REMATCH_INVITE_EVENT, (rematchData) => {
    sendNewRematchEvent(io, rematchData);
  });

  // leave the wager chat
  socket.on("disconnect", () => {
    socket.leave(username);
  });
});

app.post("/api/login", login);
app.post("/api/register", register);
app.post("/api/verify", verifyUserEmail);
app.delete("/api/logout", logout);
app.post("/api/token", renewToken);
app.get(
  "/api/wagers/:region?/:match_type?/:team_size?/:console_only?/:game?",
  getWagers
);
app.get("/api/getTournaments/:region?/:game?/:state?", getTournaments);
app.get("/api/user/:userId", verifyToken, getUserById);
app.get("/api/user/:username/teams", verifyToken, getUserTeams);
app.get("/api/:username/getActiveWagers", verifyToken, getActiveUserWagers);
app.post(
  "/api/user/deposit",
  async (req, res) => await shopifyDeposit(req, res, io)
);

app.post(
  "/api/wagers/createWager",
  verifyToken,
  async (req, res) => await createWager(req, res, io)
);
app.post(
  "/api/tourneys/createBracketTournament",
  verifyToken,
  async (req, res) => await createBracketTournament(req, res, io)
);
app.post(
  "/api/tourneys/joinBracketTournament",
  verifyToken,
  async (req, res) => await joinBracketTournament(req, res, io)
);
app.get("/api/tourneys/getAllBracketTournaments", getAllBracketTournaments);
app.get("/api/tourneys/getTournament/:id", getTournament);
app.post(
  "/api/tourneys/cancelBracketTournament",
  verifyToken,
  async (req, res) => await cancelBracketTournamentEndpoint(req, res, io)
);
app.post(
  "/api/tourneys/leaveTournament",
  verifyToken,
  async (req, res) => await leaveTournament(req, res, io)
);
app.post(
  "/api/tourneys/startTournament",
  verifyToken,
  async (req, res) => await startBracketTournamentManually(req, res, io)
);
app.post(
  "/api/tourneys/kickTeam",
  verifyToken,
  async (req, res) => await kickTeamFromTournament(req, res, io)
);
app.post(
  "/api/tourneys/deleteTournament",
  verifyToken,
  async (req, res) => await deleteBracketTournament(req, res, io)
);
// app.post("/api/sendTestNoti", async (req, res) => {
//   try {
//     const userdata = await UserData.findOne({ username: "gunhours" });
//     let newNotification = {
//       read: false,
//       body: "you have registered for tournament",
//       attached: "6265e729490391ce6ebea248",
//       type: "new_register",
//       actionable: false,
//       timestamp: new Date(),
//     };
//     userdata.notifications.addToSet(newNotification);
//     await userdata.save();
//     io.in(userdata?.username).emit(NEW_NOTIFICATION_EVENT, newNotification);
//     res.status(200).send({ error: null, message: "noti sent!" });
//   } catch (err) {
//     console.log(err);
//     res
//       .status(503)
//       .send({ error: true, message: "could not send notification" });
//   }
// });
app.get("/api/wager/:wagerId", verifyToken, getCurrentWager);
app.get("/api/tourneys/getListOfAdmins", getListOfAdmins);
app.post("/api/wager/cancel", verifyToken, async (req, res) => {
  console.log("Cancel endpoint called by " + req.body.username);
  // console.log("calling cancel here");
  const username = req.body.username;
  const wagerId = req.body.wagerId;
  const userToken = req.headers["authorization"]?.split(" ")[1];

  const doesMatchUserToken = doesUsernameMatchToken(username, userToken);

  if (!doesMatchUserToken) {
    console.log("user does not match");
    return res.send({
      error: true,
      message: "You are trying to take an action for a user that is not you!",
    });
  }

  if (!username || !wagerId) {
    console.log("no wagerid or username in cancel data");
    return res.send({ error: true, message: "Incorrect wagerid or username" });
  }

  try {
    const profitdata = await ProfitData.findOne({ wagerId });
  } catch (err) {
    if (err) return res.send({ error: true, message: "Cannot cancel token." });
  }
  ProfitData.findOne({ wagerId: wagerId }, (err, profitData) => {
    if (err) {
      return;
    } else if (profitData) {
      profitData.remove({ wagerId: wagerId });
      //profitData.save();
      return;
    } else {
      // console.log("Profit has not been paid out for this token.");
      return;
    }
  });

  getUserByName(username, (userdata) => {
    getWagerObject(wagerId, (wagerdata) => {
      if (userdata?.role < 200) {
        if (
          !(
            wagerdata?.blue_users?.includes(username) ||
            wagerdata?.red_users?.includes(username)
          )
        ) {
          // user not in this wager
          console.log("a user is not a mod or not in this token");
          return res.send({
            error: true,
            message: "User is not a mod or not in this token",
          });
        }
      }

      if (
        wagerdata?.state === wagerdata?.READY_STATE ||
        wagerdata?.state === wagerdata?.JOIN_STATE ||
        userdata?.role > 100
      ) {
        const Note = new NoteData({
          username: username,
          note: username + " cancelled " + wagerId,
          author: username,
          timestamp: new Date(),
        });
        Note.save();
        // console.log("canceling wager");
        cancelSocketHelper(wagerdata, (newwager) => {
          if (!newwager) {
            return res
              .status(409)
              .send({ error: true, message: "Unable to cancel token!" });
          }
          // THE RIGHT ONE
          resetWagerBalance(wagerId, io);
          io.in(wagerId).emit(NEW_CANCEL_EVENT, newwager);
          io.emit(REMOVE_ACTIVE_TOKEN, wagerId);

          const allUsers = wagerdata?.blue_users?.concat(wagerdata?.red_users);

          allUsers.forEach((user) => {
            io.in(user).emit(NEW_REMOVE_CURRENT_TOKEN_EVENT, wagerId);
          });

          return res.status(200).send({ error: null, message: "Cancelled!" });
        });
      } else {
        return res.send({ error: true, message: "Unable to cancel token!" });
      }
    });
  });
});
app.post("/api/wager/wagerStatus", verifyToken, getCurrentWagerStatus);
app.get("/api/token/getCurrentToken/:tokenId", verifyToken, getCurrentToken);
app.post(
  "/api/wager/join/:wagerId",
  verifyToken,
  async (req, res) => await joinWager(req, res, io)
);
app.post(
  "/api/wager/acceptRematch",
  verifyToken,
  async (req, res) => await acceptRematch(req, res, io)
);
app.post("/api/wager/ready/:wagerId", verifyToken, readyUpAPI);
app.get("/api/user/getUser/:username", verifyToken, getUserByUsername);
app.post("/api/wager/submit/:wagerId", verifyToken, async (req, res) => {
  const status = req.body.status;
  const wagerId = req.body.wagerId;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  if (!wagerId) {
    return res.send({ error: true, message: "Incorrect parameters." });
  }

  const wagerdata = await WagerObjectData.findOne({ wagerid: wagerId });
  // callback returns new wager data and status results
  submit(wagerdata, username, status, io, (newWagerData, results) => {
    const allUsers = wagerdata?.red_users?.concat(wagerdata?.blue_users);
    if (newWagerData.isTourneyMatch) {
      io.in(wagerId).emit(NEW_SUBMIT_EVENT, newWagerData);
      return;
    }

    if (results === 1) {
      team_leave_wager(wagerdata.redteamid);
      team_leave_wager(wagerdata.blueteamid);
      // send back wagerdata
      io.in(wagerId).emit(NEW_SUBMIT_EVENT, newWagerData);
      allUsers.forEach((user) => {
        io.in(user).emit(NEW_REMOVE_CURRENT_TOKEN_EVENT, wagerId);
      });

      return;
    } else if (results === 2) {
      markWagerComplete(wagerId);
      io.in(wagerId).emit(NEW_SUBMIT_EVENT, newWagerData);

      return;
    } else {
      // console.log("erroring");
      io.in(wagerId).emit(NEW_SUBMIT_EVENT, newWagerData);
      return;
    }
  });
  // // console.log(results);
});
app.post("/api/wager/forceWin/:wagerId", verifyToken, forceWin);
app.post("/api/wager/reset/:wagerId", verifyToken, resetToken);
app.post(
  "/api/user/punish/:userToPunish",
  verifyToken,
  async (req, res) => await punishUser(req, res, io)
);
app.post("/api/wager/chat/:wagerId", verifyToken, async (req, res) => {
  const message = req.body.message;
  const wagerId = req.body.wagerId;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  if (!message || !wagerId) {
    return res.send({ error: true, message: "No message or wager id!" });
  }

  WagerData.findOne({ _id: wagerId }, (err, wagerdata) => {
    if (err || !wagerdata) {
      if (!res) {
        return;
      }
      return res.status(409).send();
    }

    const messageObj = { username, text: message };
    wagerdata?.chat?.addToSet(messageObj);
    wagerdata.save({}, (err, chatdata) => {
      io.in(wagerId).emit(NEW_CHAT_EVENT, {
        message,
        name: req?.body?.username === "Game" ? "Game" : username,
        id: wagerdata?.chat[wagerdata?.chat?.length - 1]?._id,
      });
      return res.status(200).send();
    });
    if (!res) {
      return;
    }
  });
});
app.post("/api/wager/getChat/:wagerId", verifyToken, getChat);
app.post("/api/teams/createTeam", verifyToken, createTeam);
app.post("/api/teams/kickUser", verifyToken, kickUser);
app.post("/api/teams/leaveTeam", verifyToken, leaveTeam);
app.post("/api/teams/join/:teamId", verifyToken, joinTeam);
app.post("/api/notifications/read", verifyToken, readNoti);
app.get("/api/getNotifications/:username", verifyToken, getNotifications);
app.post("/api/notifications/clear", verifyToken, clearNotifications);
app.post("/api/notifications/dismiss", verifyToken, dismissNotification);
app.post("/api/confirmPoofDeposit", confirmPoofDeposit);
app.post(
  "/api/squareIsGangStyll",
  async (req, res) => await squareIsGangStyll(req, res, io)
);
app.get("/api/getAdminStats/:username", verifyToken, getAdminStats);
app.get("/api/getAdminStatsByEmail/:email", verifyToken, getAdminStatsByEmail);
app.get("/api/getAdminStatsByEpic/:epic", verifyToken, getAdminStatsByEpic);
app.post("/api/promoteUser", verifyToken, promoteUser);
app.post("/api/banPlayer", verifyToken, banPlayer);
app.post("/api/banPlayerChargeback", verifyToken, banPlayerChargeback);
app.post("/api/unbanPlayer", verifyToken, unbanPlayer);
app.post("/api/resetEpic", verifyToken, resetEpic);
app.get("/api/getDisputes", verifyToken, getDisputes);
app.post("/api/addNote", verifyToken, addNote);
app.post("/api/reportUser", verifyToken, addUserReportNote);
app.post("/api/verifyUserPanel", verifyToken, verifyUserPanel);
app.post("/api/addCode", verifyToken, addCode);
app.get("/api/getReferrals", verifyToken, getReferrals);
app.get("/api/getNotes/:username", verifyToken, getNotes);
app.get("/api/getReports/:username", verifyToken, getReports);
app.get("/api/getLogs", verifyToken, getLogs);
app.get("/api/user/transactions/:username", verifyToken, getUserTransactions);
app.get("/api/user/withdrawals/:username", verifyToken, getUserWithdrawals);
app.get("/api/user/deposits/:username", verifyToken, getUserDeposits);
app.get("/api/user/getDepositByID/:transactionId", verifyToken, getDepositByID);
app.get("/api/user/getAvatar/:username", verifyToken, getUserAvatar);
app.post(
  "/api/user/setAvatar",
  verifyToken,
  async (req, res) => await changeUserAvatar(req, res, io)
);
app.get("/api/getTotalEarningsLeaderboard", getTotalEarningsLeaderboard);
app.get("/api/admin/withdraw", verifyToken, getAllPendingWithdraws);
app.get("/api/wager/agreedUsers/:wagerid", verifyToken, getAgreedCancelUsers);
app.get("/api/admin/checkForAlts/:username", verifyToken, checkForAlts);
app.get("/api/getFirstThreeTokens", getFirstThreeWagers);
app.post("/api/admin/kmarg/", getValMatches);
app.post("/api/user/val", verifyToken, setValUser);
app.post("/api/user/clash", verifyToken, setClashUser);
app.post("/api/user/fivem", verifyToken, setFivemUser);
app.post("/api/user/epic", (req, res) => {
  const epicUsername = req.body.epic;
  const id = req.body.id;

  VerifyEpicData.findOne(
    { epic: epicUsername.toLowerCase() },
    (err, epicData) => {
      if (err) {
        return;
      }

      if (epicData) {
        epicData.id = id;
        epicData.save({}, (error, data) => {
          if (error) {
            return;
          }
        });

        if (epicData.epic.toLowerCase() == epicUsername.toLowerCase()) {
          getUserByName(epicData.username, (user) => {
            user.epic = epicUsername;
            user.save({}, (err, data) => {
              if (err) {
                return;
              }
              io.in(epicData.username).emit("newEpic", {
                epic: data.epic,
                id: data.id,
              });
            });

            return res.status(200).send({ username: epicData.username });
          });
        }
      } else {
        // console.log("epic not found");
        return res.status(409).send("Epic not found");
      }
    }
  );
});
app.post("/api/user/refreshEpic", (req, res) => {
  // console.log(req);
  try {
    const id = req.body.id;
    //console.log(id);
    const username = req.body.username;
    let apiKey = "9f420bef-5adc-43f2-9d97-6e5dde489094";
    let headers = {
      // "Content-Type": "application/json",
      "TRN-Api-Key": apiKey,
    };

    fetch("https://api.fortnitetracker.com/v1/profile/all/" + id, {
      method: "get",
      headers: headers,
    })
      .then((response) => response.json())
      .then((fortniteApiData) => {
        //console.log(fortniteApiData);
        if (!fortniteApiData?.epicUserHandle) {
          return res.send({
            error: true,
            message:
              "Your Fortnite Tracker must be on public to link your Epic account.",
          });
        }
        // console.log(fortniteApiData.data.account['name']);
        getUserByName(username, (user) => {
          user.epic = fortniteApiData.epicUserHandle;
          user.save({}, (error, data) => {
            if (error) {
              return;
            }
          });
          io.in(username).emit("newEpic", {
            epic: fortniteApiData.epicUserHandle,
            id: id,
          });
          return res.status(200).send({ epic: fortniteApiData.epicUserHandle });
        });
      })
      .catch((err) => {
        return res.status(409).send({
          error: true,
          message: "Fortnite tracker is currently experiencing issues.",
        });
      });
  } catch (err) {
    console.log(err);
    return;
  }
});

app.get("/api/user/getEpicID/:username", (req, res) => {
  const username = req.params.username;
  VerifyEpicData.findOne({ username: username }, (err, epicData) => {
    if (epicData) {
      if (err) {
        res.send({ error: true, message: "Unable to refresh via Epic ID." });
        return;
      } else {
        return res.send({ error: null, id: epicData.id });
      }
    } else {
      return;
    }
  });
});

const getHomeStats = async (req, res) => {
  let paidOut = 0;
  let earnings = 0;
  const profitData = await ProfitData.find({});
  // const activeWagers = await ActiveWagerData.find({});
  let numbers = [2];
  const activeWagers = await WagerObjectData.find({ state: numbers });
  const withdrawalData = await WithdrawData.find({});
  const earningsData = await EarningsData.find({});
  for (let i = 0; i < withdrawalData.length; i++) {
    paidOut += withdrawalData[i].amount;
  }
  for (let i = 0; i < earningsData.length; i++) {
    earnings += earningsData[i].total;
  }
  StatData.findOne({ singleObjIdentifier: "1" }, (err, statdata) => {
    if (err) {
      return;
    }
    if (statdata) {
      statdata.profitData = profitData.length;
      statdata.activeWagers = activeWagers.length;
      statdata.withdrawalData = paidOut;
      statdata.earningsData = earnings;
      statdata.save({}, (err, data) => {
        if (err) {
          console.log(err);
          return;
        }
      });
    } else {
      const stats = new StatData({
        singleObjIdentifier: "1",
        profitData: profitData.length,
        activeWagers: activeWagers.length,
        withdrawalData: paidOut,
        earningsData: earnings,
      });
      stats.save({}, (err, data) => {
        if (err) {
          return res.send(err);
        } else {
          return res.status(200).send(stats);
        }
      });
    }
  });
};

const getCurrentStats = async (req, res) => {
  StatData.findOne({ singleObjIdentifier: "1" }, (err, statdata) => {
    if (err) {
      return;
    } else {
      return res.status(200).send(statdata);
    }
  });
};

app.get("/api/stats/getCurrentStats", getCurrentStats);
app.post("/api/stats/getHomeStats", getHomeStats);
app.post("/api/user/tempEpic", setTempEpic);
app.post(
  "/api/user/makeWithdrawal",
  verifyToken,
  async (req, res) => await makeWithdrawal(req, res, io)
);
app.post("/api/user/markWithdrawal", verifyToken, markWithdrawal);
app.post("/api/user/resetTempEpic", verifyToken, resetTempEpic);
app.get("/api/user/getTempEpic/:username", verifyToken, getTempEpic);

const forgotPass = (req, res) => {
  // var currentCode = req.body.code;
  // // console.log(currentCode);
  if (res.headersSent) {
    return;
  }
  const { firstPassword, confirmPassword, code } = req.body;

  if (firstPassword != confirmPassword) {
    return res.send({ error: true, message: "Passwords do not match." });
  }
  VerifyData.findOne({ code: code }, (err, verifydata) => {
    if (verifydata) {
      const unique_value = hash({
        username: verifydata.username,
        time: new Date(),
      });
      //// console.log("verify data found: " + data);
      UserDetails.findOne(
        { username: verifydata.username },
        (err, userdata) => {
          //// console.log("user data found" + userdata);
          if (userdata) {
            userdata.setPassword(confirmPassword, function (err, data) {
              if (err) {
                console.log(err);
                // console.log("error setting pw : " + err);
                return res.send({
                  error: true,
                  message:
                    "Error setting password. Please request a new verification code.",
                });
              } else {
                userdata.save({}, (err, data) => {
                  if (err) {
                    return;
                  }
                });
                verifydata.code = unique_value;
                verifydata.save({}, (err, data) => {
                  if (err) {
                    return;
                  }
                });

                return res.send({
                  error: false,
                  message: "Successfully changed your password.",
                });
              }
            });
          }
        }
      );
    } else {
      return res.status(409).send("This verification code has expired.");
    }
  });
};

const forgot = (req, res) => {
  var queriedEmail = req.body.email;
  if (res.headersSent) {
    return;
  }

  UserDetails.findOne({ email: queriedEmail }, (err, data) => {
    // console.log(data);
    if (data) {
      VerifyData.findOne({ username: data.username }, (err, verifydata) => {
        if (verifydata) {
          sendForgotPwEmail(queriedEmail, verifydata.code);
          return res.send({
            error: false,
            message:
              "Successfully sent email. Please check your spam folder if you do not see it.",
          });
        }
      });
    } else if (!data) {
      return res.send({
        error: true,
        message: "No email associated with this username.",
      });
    }
  });

  // return res.redirect('/dashboard');
};

app.post("/api/forgot", forgot);
app.post("/api/resetPassword", forgotPass);

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                    OLD API ROUTES                                              //
////////////////////////////////////////////////////////////////////////////////////////////////////
app.get("/api/poof/style/css", (req, res) => {
  res.sendFile(__dirname + "/public/style/deposit.css");
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      if (info.message == "Password or username is incorrect") {
        info.message = "Username or password is incorrect."; // had to fix the wording
      }
      return res.redirect("/login?info=" + info.message);
    }

    getUserByName(user.username, (userdata) => {
      if (!userdata["role"] || userdata.role == 3 || userdata.role == 1) {
        return res.redirect(
          "/login?info=" + "Only Premium and Beta users can log in."
        );
      }

      getVerifiedUserByName(user.username, (verifyData) => {
        if (!userdata["role"] || userdata.role == 3 || userdata.role == 1) {
          return res.redirect(
            "/login?info=" + "Only Premium and Beta users can log in."
          );
        } else if (verifyData && verifyData.verified == false) {
          return res.redirect("/login?info=" + "Please verify your email");
        }

        req.logIn(user, function (err) {
          if (err) {
            return next(err);
          }

          log(user.username.toString() + " logged in");

          return res.redirect("/dashboard");
        });
      });
    });
  })(req, res, next);
});

app.get("/login", (req, res) =>
  res.sendFile("/public/login.html", { root: __dirname })
);

app.post("/register", (req, res, next) => {
  var codeQuery = req.body.promoCode;
  //// console.log(req.body.promoCode);

  // var codeQuery = req.body.code;
  // // console.log(window.location.code);
  // // console.log(window.location.search);

  username = req.body.username.toString().toLowerCase();
  password = req.body.password.toString();
  email = req.body.email.toString().toLowerCase();

  if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,5})+$/.test(email)) {
    return res.redirect("/register?info=" + "Invalid email format.");
  }

  if (!/^[a-zA-Z0-9_]*$/.test(username)) {
    return res.redirect(
      "/register?info=" +
        "Username may only contain letters, numbers, and underscores."
    );
  }

  if (!username || !password || !email) {
    return res.redirect("/register?info=" + "Please fill out all fields.");
  }
  UserDetails.countDocuments({ email: email }, (err, count) => {
    if (count != 0) {
      return res.redirect("/register?info=" + "Email is already registered.");
    }

    UserDetails.register(
      { username: username, active: false },
      password,
      function (err, user) {
        if (err) {
          if (err.toString().includes("UserExistsError")) {
            return res.redirect(
              "/register?info=" +
                "A user with the given username is already registered."
            );
          }
          return next(err);
        }

        if (!user) {
          return res.redirect("/register?info=" + info.message);
        }

        user.email = email;
        user.save();

        var newUser = new UserData({
          username: username,
          balance: 0,
          role: 1,
          max_withdrawal: 0,
          pun_points: 0,
          is_banned: false,
          unban_timestamp: new Date(),
          prior_bans: 0,
          notifications: [],
          match_history: [],
          avatar: [],
        });
        newUser.save();

        generateVerifyCode(username, email);

        usernames = [];
        usernames.push(username);

        // create new team doc
        var newTeam = new TeamData({
          usernames: usernames,
          name: "Solo Team",
          in_wager: false,
          wager_id: "",
        });
        newTeam.save();

        if (codeQuery) {
          ReferralData.findOne({ code: codeQuery }, (err, data) => {
            if (data) {
              data.signups += 1;
              data.users.push(username);
              data.save();
              res.redirect("/login");
            } else {
              return res.redirect(
                "/register?info=" + "Referral code does not exist"
              );
            }
          });
        } else {
          res.redirect("/login");
        }

        //UserDetail.authenticate();
      }
    );
  });
});

app.get("/register", (req, res) => {
  res.sendFile("/public/register.html", { root: __dirname });
});

app.get("/register", (req, res) => {
  //// console.log(req.query);
  res.sendFile("/public/register.html", { root: __dirname });
});

app.get("/dashboard", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  getUser(req, res, (req, res, userdata) => {
    res.render("dashboard.ejs", {
      site_name: "Tokens",
      account_name: userdata.username,
      balance: currencyFormatter.format(userdata.balance),
    });
  });
});

app.get("/isInWager", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  getUser(req, res, (req, res, userdata) => {
    TeamData.findOne(
      { usernames: userdata.username, in_wager: true },
      (err, data) => {
        if (data) {
          return res.status(200).send(JSON.stringify({ wager: data.wager_id }));
        } else {
          return res.status(200).send(JSON.stringify({ wager: "" }));
        }
      }
    );
  });
});

app.post("/createTeam", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var teamName = req.body.name;
  if (!/^[\w\-\s]+$/.test(teamName)) {
    return res.status(409).send("Team names must be alphanumeric");
  }

  getUser(req, res, (req, res, userdata) => {
    TeamData.countDocuments({ usernames: userdata.username }, (err, count) => {
      if (count >= 10) {
        return res.status(409).send("You may only be in 10 teams at one time!");
      }

      username = userdata.username;
      usernames = [];
      usernames.push(username);

      // create new team doc
      var newTeam = new TeamData({
        usernames: usernames,
        name: teamName,
        in_wager: false,
        wager_id: "",
      });
      newTeam.save();

      res.sendStatus(200);
    });
  });
});

app.get("/getTeams", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  getUser(req, res, (req, res, data) => {
    TeamData.find({ usernames: data.username }, (err, data) => {
      res.send(data);
    });
  });
});

app.post("/leaveTeam", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var teamid = req.body.teamid;
  if (!teamid) {
    return res.status(409).send("Please provide a teamid.");
  }

  getUser(req, res, (req, res, userdata) => {
    var username = userdata.username;

    getTeam(teamid, (teamdata) => {
      if (!teamdata) {
        return res.status(409).send("No team with that id.");
      }

      if (!teamdata.usernames.includes(username)) {
        return res.status(409).send("You are not in that team.");
      }

      teamdata.usernames.splice(teamdata.usernames.indexOf(username), 1);
      teamdata.save();
      res.status(200).send();
    });
  });
});

app.post("/addTeammate", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  // send notification to teammate with an action of joining this user
  var teammate = req.body.teammate;
  var teamid = req.body.teamid;

  getUser(req, res, (req, res, userdata) => {
    TeamData.findOne({ _id: teamid }, (err, data) => {
      if (!data.usernames.includes(userdata.username)) {
        return res.status(409).send("You are not in this team.");
      } else if (data.usernames.length >= 4) {
        return res.status(409).send("Team is already full!");
      }

      if (data.usernames.includes(teammate)) {
        return res.status(409).send("That player is already in this team!");
      }

      sendNotification(
        teammate,
        userdata.username + " sent you an invite.",
        true,
        ACTION_JOIN_TEAM,
        teamid,
        res
      );
    });
  });
});

app.post("/processNotification", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var actionable = req.body.actionable;
  var id = req.body.id;

  getUser(req, res, (req, res, userdata) => {
    var notis = userdata.notifications;

    // find notification object
    var index = -1;
    for (var i = 0; i < notis.length; i++) {
      var noti = notis[i];
      if (noti._id == id) {
        index = i;
        break;
      }
    }

    // return if notification not found
    if (index < 0) {
      return;
    }

    // process if actionable
    var noti = notis[index];
    if (noti.actionable) {
      if (noti.action == ACTION_JOIN_TEAM) {
        // get username of the inviter
        var targetTeam = noti.data;

        getTeam(targetTeam, (destTeam) => {
          if (destTeam.in_wager) {
            res
              .status(409)
              .send("You cannot join this team while they are in a match.");
            return;
          }

          TeamData.countDocuments(
            { usernames: userdata.username },
            (err, count) => {
              if (count >= 10) {
                return res
                  .status(409)
                  .send(
                    "You may only be in 10 teams at one time! Please leave a team."
                  );
              }

              if (destTeam.usernames.includes(userdata.username)) {
                return res.status(409).send("User is already in this team");
              } else {
                destTeam.usernames.push(userdata.username);
                destTeam.save();
              }

              userdata.notifications.splice(index, 1);
              userdata.save();
              res.sendStatus(200);
            }
          );
        });
      }
    }
  });
});

app.post("/closeNotification", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var id = req.body.id;

  getUser(req, res, (req, res, userdata) => {
    var notis = userdata.notifications;

    // find notification object
    var index = -1;
    for (var i = 0; i < notis.length; i++) {
      var noti = notis[i];
      if (noti._id == id) {
        index = i;
        break;
      }
    }

    // return if notification not found
    if (index < 0) {
      return;
    }

    // remove notification from list
    userdata.notifications.splice(index, 1);
    userdata.save();
    res.sendStatus(200);
  });
});

app.get("/checkNotis", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  getUser(req, res, (req, res, userdata) => {
    var notiData = [];

    for (var i = 0; i < userdata.notifications.length; i++) {
      var noti = {
        text: userdata.notifications[i].text,
        actionable: userdata.notifications[i].actionable,
        id: userdata.notifications[i]._id,
      };
      notiData.push(noti);
    }

    res.send(JSON.stringify(notiData));
  });
});

function createWagerObject(id, teamid, teamusers) {
  // // console.log("CREATING WAGER OBJECT AGAIN");
  var newWagerObject = new WagerObjectData({
    wagerid: id,
    blueteamid: teamid,
    blue_users: teamusers,
    redteamid: "",
    red_users: [],
    readied_users: [],
    is_readied: [],

    bluesubmit: -1,
    redsubmit: -1,
    single_sub: -1,
    winner: -1,

    CANCEL_STATE: -1,
    JOIN_STATE: 0,
    READY_STATE: 1,
    PLAYING_STATE: 2,
    DONE_STATE: 3,
    DISPUTE_STATE: 4,
    state: 0,
    timer: 0,
    isTourneyMatch: false,
  });
  // // console.log("saving wager object in function" + newWagerObject.state);
  newWagerObject.save();
}

function teamMinBal(usernames, minBal, callback) {
  if (usernames.length == 0) {
    return callback(minBal);
  }

  getUserByName(usernames[0], (userdata) => {
    var balance = userdata.balance;

    if (minBal < 0 || balance < minBal) {
      minBal = balance;
    }

    usernames.shift(); // remove first index
    teamMinBal(usernames, minBal, callback);
  });
}

function teamCheckEpics(usernames, callback) {
  if (usernames.length == 0) {
    return callback(1);
  }

  getUserByName(usernames[0], (userdata) => {
    if (userdata.is_banned) {
      return callback(-2);
    }

    if (!userdata["epic"] || userdata["epic"].length == 0) {
      return callback(-1);
    }

    usernames.shift(); // remove first index
    teamCheckEpics(usernames, callback);
  });
}

app.post("/createWager", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  if (isNaN(req.body.entry_fee)) {
    return res.status(409).send("Invalid price.");
  }

  if (!req.body.first_to || !req.body.console_only) {
    return res.status(409).send("Please fill in all fields.");
  }

  var entry_fee = Math.floor(100 * parseFloat(req.body.entry_fee)) / 100;
  var region = req.body.region;
  var match_type = req.body.match_type;
  var team = req.body.teamid;
  var first_to = parseInt(req.body.first_to);
  var console_only = req.body.console_only === "true";

  if (team.length == 0) {
    return res.status(409).send("You must select a team.");
  }

  if (!entry_fee || !region || !match_type || !team || !first_to) {
    res.status(409).send("Please enter all fields.");
    return;
  }

  // check for reasonable bounds on data, even if bounds are set on client side
  if (entry_fee < 0.1 || entry_fee > 100) {
    res.status(409).send("Wager price must be between $0.10 and $100.00.");
    return;
  }
  if (
    !(region == "NAE" || region == "NAW" || region == "EU" || region == "OCE")
  ) {
    res.status(409).send("Region must be NAE, NAW, EU, or OCE.");
    return;
  }
  if (!(match_type == "ZW" || match_type == "REAL" || match_type == "BOX")) {
    res
      .status(409)
      .send("Match type must be Zone Wars, Realistics, or Boxfights.");
    return;
  }
  if (first_to < 3 || first_to > 11) {
    res.status(409).send("Wager rounds must be either 3, 5, or 7.");
    return;
  }

  getUser(req, res, (req, res, userdata) => {
    var myUsername = userdata.username;

    // get team data
    getTeam(team, (teamdata) => {
      if (teamdata.in_wager) {
        res.status(409).send("Your current team is already in a match.");
        return;
      }

      var users = teamdata.usernames;

      if (!users.includes(myUsername)) {
        res.status(409).send("You are not in this team.");
      }

      var usersToCheck = JSON.parse(JSON.stringify(teamdata.usernames));
      teamMinBal(usersToCheck, -1, (minBalance) => {
        if (entry_fee > minBalance) {
          return res
            .status(409)
            .send(
              "At least one of the team's members does not have a high enough balance."
            );
        }

        teamCheckEpics(
          JSON.parse(JSON.stringify(teamdata.usernames)),
          (epicsSet) => {
            if (epicsSet == -1) {
              return res
                .status(409)
                .send(
                  "At least one of the team's members must submit their epic username on their profile."
                );
            } else if (epicsSet == -2) {
              return res
                .status(409)
                .send("At least one of your team's members is banned.");
            }

            var team_size = teamdata.usernames.length;

            // create wager and save
            const unique_value = hash({
              team,
              users,
              entry_fee,
              region,
              match_type,
              team_size,
              first_to,
            });
            var newWager = new WagerData({
              unique_value: unique_value,
              blueteamid: team,
              redteamid: "",
              blueteam_users: users,
              redteam_users: [],
              entry_fee: entry_fee,
              region: region,
              match_type: match_type,
              team_size: team_size,
              first_to: first_to,
              done: false,
              chat: [],
              cancelled: false,
              paid_entry: false,
              paid_prizes: false,
              console_only: console_only,
            });

            // newWager.save().then(result =>
            //   {
            //     wager_id = newWager._id.toString();

            //     teamdata.in_wager = true;
            //     teamdata.wager_id = wager_id;
            //     teamdata.save();
            //     createWagerObject(newWager._id, team, users);

            //     res.send("/wager/" + wager_id);
            //     log("Wager " + wager_id + " created");
            //   }).catch(err => {
            //     return res.status(409).send("You have already created this wager. ");
            //   });

            newWager.save(function (err, user) {
              if (err) {
                // console.log(err);
                res.status(409).send("Error creating this wager.");
                return;
              }
              wager_id = newWager._id.toString();

              teamdata.in_wager = true;
              teamdata.wager_id = wager_id;
              teamdata.save();
              createWagerObject(newWager._id, team, users);

              res.send("/wager/" + wager_id);
              log("Wager " + wager_id + " created");
            });
          }
        );
      });
    });
  });
});

function clearNonActiveWagers() {
  console.log("clearing non active wagers");
  const wagerDataObj = {
    redteamid: { $not: { $ne: "" } },
    cancelled: false,
  };

  ActiveWagerData.find((err, data) => {
    for (let i = 0; i < data.length; i++) {
      data[i].remove();
      console.log(data[i]);
    }
  });

  WagerData.find(
    wagerDataObj,
    "blueteamid redteamid blueteam_users redteam_users entry_fee region match_type team_size first_to console_only done cancelled",
    (err, wagers) => {
      for (let i = 0; i < wagers.length; i++) {
        const newActiveWagers = new ActiveWagerData({
          wagerid: wagers[i]._id,
        });
        newActiveWagers.save({}, (err, data) => {
          if (err) {
            return;
          }
        });
      }
    }
  );
}

function markWagerDone(wagerid) {
  // console.log("WAGER MARKED DONE");

  getWagerObject(wagerid, (data) => {
    team_leave_wager(data.blueteamid);
    if (data.redteamid) {
      team_leave_wager(data.redteamid);
    }
  });

  WagerData.findOne({ _id: wagerid }, (err, wagerdata) => {
    if (err) {
      return console.err(err);
    }

    const start = Date.now();

    const unique_value = hash({
      team: wagerdata.team,
      users: wagerdata.users,
      entry_fee: wagerdata.entry_fee,
      region: wagerdata.region,
      match_type: wagerdata.match_type,
      team_size: wagerdata.team_size,
      first_to: wagerdata.first_to,
      start,
    });
    wagerdata.unique_value = unique_value;
    wagerdata.done = true;
    // // console.log('from /markWagerDone' + wagerdata.state);
    wagerdata.save();
  });
}

function tick(wagerObj) {
  if (wagerObj.timer <= 0 && !wagerObj.isTourneyMatch) {
    console.log("timer less than or equal to 0 ");
    return;
  }

  if (!wagerObj.timer) {
    console.log("timer doesnt exist");
    return;
  }

  wagerObj.timer -= 1;
  const red_readied_users = [];
  const blue_readied_users = [];
  let winner = 0;
  // if (wagerObj.isTourneyMatch) {
  //   for (let i = 0; i < wagerObj.readied_users.length; i++) {
  //     if (wagerObj.is_readied[i] === true) {
  //       if (wagerObj.blue_users.includes(wagerObj.readied_users[i])) {
  //         blue_readied_users.push(wagerObj.readied_users[i]);
  //       }
  //       if (wagerObj.red_users.includes(wagerObj.readied_users[i])) {
  //         red_readied_users.push(wagerObj.readied_users[i]);
  //       }
  //     }
  //   }
  //   //if more red readied users than blue
  //   if (red_readied_users.length > blue_readied_users.length) {
  //     //red winner
  //     winner = 2;
  //   } else {
  //     //blue winner
  //     winner = 1;
  //   }
  // }
  if (
    wagerObj.state == wagerObj.READY_STATE &&
    wagerObj.timer === 0 &&
    !wagerObj.isTourneyMatch
  ) {
    // //// console.log("cancelled ongoing wager because non ready up ")
    // cancel(wagerObj);
    return;
  }
  // if (
  //   (wagerObj.state == wagerObj.PLAYING_STATE ||
  //     wagerObj.state == wagerObj.READY_STATE) &&
  //   wagerObj.timer === 0 &&
  //   wagerObj.isTourneyMatch
  // ) {
  //   if (wagerObj.bluesubmit == 1 && wagerObj.redsubmit == -1) {
  //     //blue winning because of auto win
  //     bracketTournamentWinTick(wagerObj, 1, io, (newToken) => {
  //       io.in(wagerObj.wagerid).emit(NEW_SUBMIT_EVENT, newToken);
  //     });
  //   } else if (wagerObj.bluesubmit == -1 && wagerObj.redsubmit == 1) {
  //     bracketTournamentWinTick(wagerObj, 2, io, (newToken) => {
  //       io.in(wagerObj.wagerid).emit(NEW_SUBMIT_EVENT, newToken);
  //     });
  //   } else if (winner != 0 && winner == 1) {
  //     console.log("winning for teamnum 1");
  //     bracketTournamentWinTick(wagerObj, 1, io, (newToken) => {
  //       io.in(wagerObj.wagerid).emit(NEW_SUBMIT_EVENT, newToken);
  //     });
  //   } else if (winner != 0 && winner == 2) {
  //     console.log("winning for teamnum 2");
  //     bracketTournamentWinTick(wagerObj, 2, io, (newToken) => {
  //       io.in(wagerObj.wagerid).emit(NEW_SUBMIT_EVENT, newToken);
  //     });
  //   }
  // }
  if (
    wagerObj.state == wagerObj.PLAYING_STATE &&
    wagerObj.timer === 0 &&
    !wagerObj.isTourneyMatch
  ) {
    if (wagerObj.bluesubmit == 1 && wagerObj.redsubmit == -1) {
      win(wagerObj, 1, io, (newWagerData) => {
        console.log("marking blue team won");
        markWagerComplete(wagerObj.wagerid);
        return;
      });
    } else if (wagerObj.bluesubmit == -1 && wagerObj.redsubmit == 1) {
      win(wagerObj, 2, io, (newWagerData) => {
        console.log("marking red team won");
        markWagerComplete(wagerObj.wagerid);
        return;
      });
    }
  }

  wagerObj.save({}, (err, data) => {
    if (err) {
      console.log("catching parallel save for: " + wagerObj.wagerid);
      return;
    }
  });
}
//// console.log("ticking in " + wagerObj.wagerid + " " + wagerObj.timer)

function tickWagers() {
  // update timers on all wagers
  WagerObjectData.find(
    { winner: -1, timer: { $gt: 0 } },
    (err, all_wager_objs) => {
      //// console.log("tickwagers length: " + all_wager_objs.length)
      if (err) {
        return log(err);
      }

      for (var i = 0; i < all_wager_objs.length; i++) {
        tick(all_wager_objs[i]);
      }
    }
  );
}

function clearNonActiveWagers() {
  console.log("clearing non active wagers");
  const wagerDataObj = {
    redteamid: { $not: { $ne: "" } },
    cancelled: false,
  };

  ActiveWagerData.find((err, data) => {
    for (let i = 0; i < data.length; i++) {
      data[i].remove();
    }
  });

  WagerData.find(
    wagerDataObj,
    "blueteamid redteamid blueteam_users redteam_users entry_fee region match_type team_size first_to console_only done cancelled",
    (err, wagers) => {
      for (let i = 0; i < wagers.length; i++) {
        const newActiveWagers = new ActiveWagerData({ wagerid: wagers[i]._id });
        newActiveWagers.save({}, (err, data) => {
          if (err) {
            return;
          }
        });
      }
    }
  );
}

function loadWagers() {
  setInterval(tickWagers, 1000);
  // setInterval(clearNonActiveWagers, 300000);
  setInterval(getHomeStats, 3600000);
  // setInterval(getHomeStats, 9000);
  // setInterval(confirmPoofDeposit, 600000);
}

app.get("/wager/*", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  if (req.originalUrl.split("wager/").length < 2) {
    return res.redirect("/dashboard");
  }

  WagerData.findOne(
    { _id: req.originalUrl.split("wager/")[1] },
    (err, wagerdata) => {
      if (!wagerdata) {
        return res.redirect("/dashboard");
      }

      getUser(req, res, (req, res, userdata) => {
        if (role < 100) {
          if (
            !(
              wagerdata.blueteam_users.includes(userdata.username) ||
              wagerdata.redteam_users.includes(userdata.username)
            )
          ) {
            return res.redirect("/dashboard");
          }
        }

        var role = userdata.role;
        var tools = role > 100;

        var platform_string = "All Platforms";
        if (wagerdata.console_only) {
          platform_string = "Console Only";
        }

        res.render("wager.ejs", {
          tools: tools,
          platform: platform_string,
          site_name: "Tokens",
          account_name: userdata.username,
          balance: currencyFormatter.format(userdata.balance),
          team_size:
            wagerdata.team_size.toString() +
            "v" +
            wagerdata.team_size.toString(),
          match_type: wagerdata.match_type,
          entry_fee: currencyFormatter.format(wagerdata.entry_fee),
          region: wagerdata.region,
          first_to: wagerdata.first_to.toString(),
        });
      });
    }
  );
});

function whichTeam(wager, username) {
  if (wager.blue_users.includes(username)) {
    return 1;
  } else if (wager.red_users.includes(username)) {
    return 2;
  }
  return -1;
}

app.post("/wagerStatus/*", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  if (req.originalUrl.split("wagerStatus/").length < 2) {
    return res.redirect("/dashboard");
  }

  var wager_id = req.originalUrl.split("wagerStatus/")[1];

  getWagerObject(wager_id, (data) => {
    if (data.state == data.CANCEL_STATE) {
      return res.send(
        '{"state": ' +
          data.CANCEL_STATE.toString() +
          ', "CANCEL_STATE": ' +
          data.CANCEL_STATE.toString() +
          " }"
      );
    }

    WagerData.findOne({ _id: wager_id }, (err, wagerdata) => {
      if (!wagerdata) {
        return res.redirect("/dashboard");
      }

      getUser(req, res, (req, res, userdata) => {
        if (userdata.role < 100) {
          if (
            !(
              wagerdata.blueteam_users.includes(userdata.username) ||
              wagerdata.redteam_users.includes(userdata.username)
            )
          ) {
            return res.redirect("/dashboard");
          }
        }

        // make COPY of object
        var wagerObject = JSON.parse(JSON.stringify(data));
        wagerObject["your_username"] = userdata.username;
        wagerObject["your_team"] = whichTeam(data, userdata.username);

        res.send(wagerObject);
      });
    });
  });
});

function team_leave_wager(teamid) {
  TeamData.findOne({ _id: teamid }, (err, data) => {
    if (err) {
      return log(err);
    }

    if (!data) {
      return log("Error finding team " + teamid.toString());
    }
    data.in_wager = false;
    data.wager_id = "";
    data.save();
  });
}

function reset(wagerid) {
  getWagerObject(wagerid, (objData) => {
    if (!objData) {
      return;
    }

    WagerData.findOne({ _id: wagerid }, (err, data) => {
      if (err || !data) {
        return;
      }

      data.done = false;
      data.cancelled = false;
      objData.timer = 0;
      // console.log("timer set to 0 on reset");

      if (data.paid_prizes) {
        if (objData.winner == 1) {
          for (var i = 0; i < data.blueteam_users.length; i++) {
            var name = data.blueteam_users[i];
            getUserByName(name, (userdata) => {
              userdata.balance -= data.entry_fee * 2;
              userdata.save();
            });
          }
        } else if (objData.winner == 2) {
          for (var i = 0; i < data.redteam_users.length; i++) {
            var name = data.redteam_users[i];
            getUserByName(name, (userdata) => {
              userdata.balance -= data.entry_fee * 2;
              userdata.save();
            });
          }
        }
      }

      data.paid_prizes = false;
      // // console.log("GAME HAS BEEN RESET IN FUNCTION" + data.state);
      data.save();
      objData.bluesubmit = -1;
      objData.redsubmit = -1;
      objData.single_sub = -1;
      objData.winner = -1;

      objData.state = objData.PLAYING_STATE;
      // console.log("Saved in reset func" + objData.state);
      objData.save();
    });
  });
}

app.post("/reset", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var wagerid = req.body.wagerid;

  if (!wagerid) {
    return res.status(409).send();
  }

  getUser(req, res, (req, res, userdata) => {
    if (userdata.role < 200) {
      return res.status(409).send("You do not have permission to do this.");
    }

    reset(wagerid);

    res.status(200).send();

    log("Match " + wagerid + " reset.");
  });
});

function readyUp(wager, username) {
  // check if we're in the correct state
  if (wager.state != wager.READY_STATE) {
    return false;
  }

  // check if user is even in this wager
  if (wager.readied_users.includes(username)) {
    wager.is_readied[wager.readied_users.indexOf(username)] = true;

    // check if everyone is readied up, if so start game, otherwise return true to say we readied this user up
    for (var i = 0; i < wager.blue_users.length; i++) {
      var index = wager.readied_users.indexOf(wager.blue_users[i]);
      if (!wager.is_readied[index]) {
        // // console.log("save in readyUp func" + wager.state);
        wager.save();
        return true;
      }
    }

    for (var i = 0; i < wager.red_users.length; i++) {
      var index = wager.readied_users.indexOf(wager.red_users[i]);
      if (!wager.is_readied[index]) {
        // // console.log("save in readyUp func" + wager.state);
        wager.save();
        return true;
      }
    }

    WagerData.findOne({ _id: wager.wagerid }, (err, data) => {
      var today = new Date();
      today.toString();
      var wagerString = wager.wagerid;
      //"https://tkns.gg/wager/" +
      // + ' ' + ' ' + data.match_type + ' ' + wager.winner

      var prize = data.entry_fee;
      // subtract fee from each user
      for (var i = 0; i < wager.readied_users.length; i++) {
        getUserByName(wager.readied_users[i], (userdata) => {
          userdata.balance -= prize;

          var newMatchHistory = {
            wager_id: "https://tkns.gg/wager/" + wager.wagerid,
            game_mode: data.match_type,
            entry_fee: data.entry_fee,
            date: today,
            status: "-1",
            game: data.game || null,
          };

          //userdata.notifications.addToSet(newNotification);

          userdata.match_history.addToSet(newMatchHistory);
          // userdata.match_history.match_info=(data.match_type);
          //  userdata.match_history[1] = (data.match_type);

          userdata.save();
        });
      }

      data.paid_entry = true;
      // // console.log("save in readyUp func " + wager.state);
      data.save();
    });

    wager.timer = -1;
    //in ready state setting playing state
    wager.state = wager.PLAYING_STATE;
    // // console.log("playing state and timer 0 plus save");

    wager.save();

    var host = "Blue";
    if (Math.random() < 0.5) {
      host = "Red";
    }
    gameMessage(
      wager.wagerid,
      "Host: " +
        host +
        " team, please send your epic username in chat. If you see the message 'Other team has submitted a win, please either confirm or dispute.', don't worry. It's just a visual bug. Play and mark your match normally."
    );

    return true;
  }

  return false;
}

app.post("/ready", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var wagerid = req.body.wagerid;

  if (!wagerid) {
    res.status(409).send();
  }

  getUser(req, res, (req, res, userdata) => {
    var wagerid = req.body.wagerid;
    var username = userdata.username;

    getWagerObject(wagerid, (data) => {
      readyUp(data, username);

      res.status(200).send();
    });
  });
});

function gameMessage(wagerid, message) {
  sendMessage(wagerid, "[GAME]", message, null);
}

function dispute(wager) {
  wager.state = wager.DISPUTE_STATE;
  log("Dispute for wager " + wager.wagerid.toString() + " submitted.");
  // // console.log("Dispute for wager " + wager.wagerid.toString() + " submitted.");
  wager.save();
}

app.post("/verifyUserPanel", (req, res) => {
  //// console.log(req);
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var currentUser = req.query.user;

  getUser(req, res, (req, res, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      UserData.findOne({ username: currentUser }, (err, userVerifyData) => {
        // console.log(currentUser);
        userVerifyData.role = 2;
        userVerifyData.save();
      });
    }
  });
});

app.get("/verify", (req, res) => {
  //// console.log(req);
  // if (!req.isAuthenticated()) {
  //   return res.redirect("/");
  // }

  var currentCode = req.query.code;
  // console.log(currentCode);

  VerifyData.findOne({ code: currentCode }, (err, data) => {
    if (data) {
      data.verified = true;
      data.save();
      res.redirect("/login");
    } else {
      return res.redirect(
        "/register?info=" + "Error verifying account. Please contact an admin."
      );
    }
  });
});

app.get("/verify", (req, res) =>
  res.sendFile("/public/verify.html", { root: __dirname })
);

app.get("/resetPassword", (req, res) =>
  res.sendFile("/public/reset_password.html", { root: __dirname })
);

app.get("/getNotes", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }
  var currentUser = req.query.user;
  getUser(req, res, (req, res, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      NoteData.find({ username: currentUser }, (err, data) => {
        // console.log(data.map((item) => item.note));
        res.send(data.map((item) => item.note));
      });
    }
  });
});

app.get("/adminpanel", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.sendFile(__dirname + "/public/adminpanel.html");
});

app.get("/disputes", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.sendFile(__dirname + "/public/disputes.html");
});

const BAN_THRESHOLDS = [200, 400, 650, 700];
const BAN_TIMEOUTS = [2, 7, 30, -1];

function ban(user, length, new_num_bans) {
  user.is_banned = true;
  user.prior_bans = new_num_bans;
  if (length == -1) {
    var date = new Date();
    date.setFullYear(3000);
    user.unban_timestamp = date;
  } else {
    var date = new Date();
    date.setDate(date.getDate() + length);
    user.unban_timestamp = date;
  }

  user.save();
}

function checkBans(user) {
  var num_bans = user.prior_bans;
  var pun_points = user.pun_points;

  if (num_bans <= 3 && pun_points >= BAN_THRESHOLDS[3]) {
    ban(user, BAN_TIMEOUTS[3], 4);
  }

  if (num_bans <= 2 && pun_points >= BAN_THRESHOLDS[2]) {
    ban(user, BAN_TIMEOUTS[2], 3);
  }

  if (num_bans <= 1 && pun_points >= BAN_THRESHOLDS[1]) {
    ban(user, BAN_TIMEOUTS[1], 2);
  }

  if (num_bans == 0 && pun_points >= BAN_THRESHOLDS[0]) {
    ban(user, BAN_TIMEOUTS[0], 1);
  }
}

app.post("/punish", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var user = req.body.user;
  var points = req.body.points;
  if (!user || !points) {
    return res.status(409).send();
  }

  getUser(req, res, (req, res, userdata) => {
    if (!userdata.role) {
      return res
        .status(409)
        .send("You do not have permission for this action.");
    }

    if (userdata.role < 200) {
      return res
        .status(409)
        .send("You do not have permission for this action.");
    }

    getUserByName(user, (userdata) => {
      if (!userdata) {
        return res.status(409).send("No user found with that username.");
      }

      userdata.pun_points += parseInt(points);

      checkBans(userdata);

      userdata.save();
      return res.status(200).send();
    });
  });
});

var num_formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

app.post("/withdraw", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  var email = req.body.email;
  // if (!(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,5})+$/.test(email))) {
  //   return res.status(409).send("Invalid email format.");
  // }

  var amount_input = req.body.amount;
  if (isNaN(amount_input)) {
    return res.status(409).send("Amount must be a number.");
  }
  var amount = Math.floor(parseFloat(amount_input) * 100) / 100;

  getUser(req, res, (req, res, data) => {
    if (!data) {
      return res.status(409).send("You are not logged in.");
    }

    var max = data.max_withdrawal;
    if (amount > max) {
      return res
        .status(409)
        .send(
          "You have only won " +
            num_formatter.format(max) +
            ", that is the maximum amount you can withdraw."
        );
    }
    if (amount > data.balance) {
      return res
        .status(409)
        .send("You do not have a high enough balance for this.");
    }

    if (amount < 10) {
      return res
        .status(409)
        .send("You may only withdraw amounts greater than $10.");
    }

    var today = new Date();
    var time =
      today.getDate() + ":" + today.getHours() + ":" + today.getMinutes();

    const unique_value = hash({
      username: data.username,
      amount: data.amount,
      paypal: data.email,
      time,
    });

    var newWithdrawal = new WithdrawData({
      username: data.username,
      amount: amount,
      paypal: email,
      time: new Date(),
      unique_value,
      processed: false,
    });
    newWithdrawal.save({}, (err, promisedata) => {
      if (!err) {
        data.balance -= amount;
        data.max_withdrawal -= amount;
        data.save({}, (err, data) => {
          res.status(200).send();
        });
      } else {
        // console.log(err);
      }
    });

    log("User '" + data.username + "' withdrew $" + amount.toString());
  });
});

app.get("/withdraw", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.sendFile(__dirname + "/public/withdraw.html");
});

app.get("/riot.txt", (req, res) => {
  res.sendFile(__dirname + "/public/riot.txt");
});

app.post("/updateEpic", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  // var epicId = req.body.epicId;
  var epic = req.body.new_u;
  if (!epic) {
    return res.status(409).send();
  }

  if (epic.length > 50) {
    return res.status(409).send();
  }

  getUser(req, res, (req, res, data) => {
    // VerifyEpicData.findOne({'tknsUsername': data.username }, (err, epicData) => {

    //   if (!epicData) {
    //     var newUser = new VerifyEpicData({ tknsUsername: data.username, epicUsername: epic, epicId: epicId});
    //     newUser.save();
    //   }
    //   else {
    //     return res.status(409).send();
    //   }
    //   if (err){
    //     // console.log(err);
    //   }

    // })

    data.epic = epic;
    data.save();
    res.status(200).send();
  });
});

app.get("/epic", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.sendFile(__dirname + "/public/epic.html");
});

app.get("/getEpic", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  getUser(req, res, (req, res, data) => {
    var username = "";
    if (data["epic"]) {
      username = data.epic;
    }
    res.status(200).send(username);
  });
});

app.get("/signupCount", (req, res) => {
  UserData.countDocuments({}, function (err, count) {
    res.status(200).send(count.toString());
  });
});

app.get("/rules", (req, res) => {
  res.sendFile(__dirname + "/public/rules.html");
});

app.get("/terms", (req, res) => {
  res.sendFile(__dirname + "/public/tos.html");
});

app.get("/privacy", (req, res) => {
  res.sendFile(__dirname + "/public/privacy.html");
});

app.get("/ping", (req, res) => {
  res.status(200).send(new Date());
});

/*app.get('/style/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public', req.originalUrl));
});*/

app.use("/style", express.static(__dirname + "/public/style"));

/*app.get('/html/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public', req.originalUrl));
});*/

app.use("/html", express.static(__dirname + "/public/html"));

/*app.get('/images/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public', req.originalUrl));
});*/

app.use("/images", express.static(__dirname + "/public/images"));

/*app.get('/logo/*', (req, res) => {
  res.sendFile(path.join(__dirname + '/public', req.originalUrl));
});*/

app.use("/logo", express.static(__dirname + "/public/logo"));

server.listen(process.env.PORT || port, () => {
  loadWagers();
  log("Started Server");
  console.log(port);
});

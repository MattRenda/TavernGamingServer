const { TeamData } = require("../models/Team");
const { UserData, UserDataSchema } = require("../models/User");
const { WagerObjectData } = require("../models/WagerObject");
const { WagerData } = require("../models/Wager");
const { VerifyData } = require("../models/Verify");
const hash = require("object-hash");
const nodemailer = require("nodemailer");
const { constants } = require("./constants");
const { getEmailString } = require("./emailString");
const { ProfitData } = require("../models/Profit");
const { TourneyProfitData } = require("../models/TourneyProfit");
const { EarningsData } = require("../models/Earnings");
const { ActiveWagerData } = require("../models/ActiveWagers");
const { WagerDataV2 } = require("../models/WagerDataV2");
const { NoteData } = require("../models/NoteData");
const {
  BracketTourneyData,
  MatchData,
} = require("../models/BracketTournament");
const { each } = require("async");
const jwt = require("jsonwebtoken");
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  auth: {
    user: "apikey",
    pass: "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",
  },
});
const {
  getCurrentTokenGame,
  getCurrentTokenPrize,
  getCurrentTokenTitle,
} = require("./tokenHelpers");
const {
  generateTournamentMatch,
  bracketTournamentWin,
} = require("./bracketTournamentHelpers");
const NEW_UPDATE_BALANCE_EVENT = "updateBalance";
const NEW_BRACKET_UPDATE_EVENT = "newBracket";

const BAN_THRESHOLDS = [200, 400, 650, 700];
const BAN_TIMEOUTS = [2, 7, 30, -1];

const getUserIdFromToken = (jwtToken) => {
  try {
    const jwt = JSON.parse(atob(jwtToken.split(".")[1]));
    return (jwt && jwt.userId) || null;
  } catch (err) {
    console.log(err);
    return;
  }
};

const getUserByName = (username, callback) => {
  UserData.findOne({ username }, (err, userdata) => {
    if (err) {
      log(err);
      return;
    }

    callback(userdata);
  });
};

const getUserToken = (req) => {
  return req.headers["authorization"]?.split(" ")[1];
};

const getUsernameFromToken = async (token) => {
  const userId = getUserIdFromToken(token);
  const userdata = await UserData.findOne({ _id: userId });
  return userdata?.username;
};

const doesUsernameMatchToken = async (username, token) => {
  const userId = getUserIdFromToken(token);

  const userdata = await UserData.findOne({ username });
  const userdatafromtoken = await UserData.findOne({ _id: userId });

  // console.log(
  //   "user making request: " +
  //     userdata._id.toString() +
  //     " (" +
  //     userdata.username +
  //     ")"
  // );
  // console.log(
  //   "user trying to be requested upon: " + userdatafromtoken._id.toString() + (" + userdata.username + ")
  // );

  if (!userdata) {
    return false;
  }

  if (userdata._id.toString() === userdatafromtoken._id.toString()) {
    return true;
  }

  return false;
};

const getTeam = (teamid, callback) => {
  TeamData.findOne({ _id: teamid }, (err, teamData) => {
    if (err) {
      // console.log(err);
      return;
    }

    if (!teamData) {
      // console.log("Error finding team " + teamid.toString());
      return;
    }

    callback(teamData);
  });
};

async function teamMinBal(usernames, minBal) {
  if (usernames.length == 0) {
    return minBal;
  }
  const balances = [];
  for (let i = 0; i < usernames.length; i++) {
    const userdata = await UserData.findOne({ username: usernames[i] });
    balances.push(userdata?.balance);
  }

  return Math.min(...balances);
}

async function teamCheckEpics(usernames) {
  if (usernames.length == 0) {
    return 1;
  }

  let epic = [];
  let banned = [];
  for (let i = 0; i < usernames.length; i++) {
    // console.log("current user: " + usernames[i]);
    const userdata = await UserData.findOne({ username: usernames[i] });
    if (userdata) {
      banned.push(userdata.is_banned);
      epic.push(userdata.epic);
    }
  }
  if (banned.includes(true)) {
    return -2;
  }
  if (epic.some((x) => x == undefined || x.length == 0)) {
    return -1;
  }
}

const createWagerObject = (id, teamid, teamusers) => {
  const newWagerObject = new WagerObjectData({
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
  newWagerObject.save();
};

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

  const reactURL = `${constants.clientURL}/verify?code=${unique_value}`;
  sendVerificationEmail(email, reactURL);
}

function sendVerificationEmail(email, verifyUrl) {
  transporter
    .sendMail({
      from: '"Tkns.GG" <support@tkns.gg>', // sender address
      to: email, // list of receivers
      subject: "Verify - Tkns.GG", // Subject line
      html: getEmailString()
        .replace("{#verification_code#}", verifyUrl)
        .replace("{#discord_invite#}", "https://www.taverngaming.com/www.discord.gg/tknsgg"), // html body
    })
    .then((info) => {
      // console.log({ info });
    })
    .catch(console.error);
}

const getWagerObject = (wagerid, callback) => {
  if (!wagerid) {
    return;
  }
  WagerObjectData.findOne({ wagerid }, (err, data) => {
    if (err) {
      return;
    }
    if (!data) {
      return;
    }
    callback(data);
  });
};

const getTokenObject = async (tokenId) => {
  if (!tokenId) return;

  try {
    const wagerdata = await WagerObjectData.findOne({ wagerid: tokenId });
    const tokendata = await WagerData.findOne({ _id: tokenId });
    const blueTeamData = await TeamData.findOne({ id: wagerdata.blueteamid });
    const redTeamData = await TeamData.findOne({ id: wagerdata.redteamid });

    if (!wagerdata || !tokendata) {
      return;
    }

    // make user set
    const userSet = {};

    // get blue team users info
    for (let i = 0; i < tokendata.blueteam_users?.length; i++) {
      const blueUsername = tokendata.blueteam_users[i];
      const blueUser = await UserData.findOne({ username: blueUsername });

      if (!blueUser) {
        return res
          .status(409)
          .send({ error: true, message: "User does not exist!" });
      }

      if (!userSet[blueUsername]) {
        userSet[blueUsername] = {};
      }

      // set username
      userSet[blueUsername].username = blueUsername;

      // get blue user avatar
      if (blueUser?.avatar?.length > 0) {
        userSet[blueUsername].avatar = blueUser?.avatar;
      }

      // get blue user game name
      if (
        tokendata.game === "FN" ||
        tokendata.game == null ||
        tokendata.game == ""
      ) {
        // get epic
        userSet[blueUsername].gameUsername = blueUser?.epic;
      } else if (tokendata.game === "VAL") {
        // get val id
        userSet[blueUsername].gameUsername = blueUser?.connections[0]?.valId;
      } else if (tokendata.game === "CLASH") {
        // get clash id
        userSet[blueUsername].gameUsername = blueUser?.connections[1]?.clashId;
      } else if (tokendata.game === "FIVEM") {
        userSet[blueUsername].gameUsername = blueUser.connections[2]?.fivemID;
      }
    }

    // get red ream users info
    for (let i = 0; i < tokendata.redteam_users?.length; i++) {
      const redUsername = tokendata.redteam_users[i];
      const redUser = await UserData.findOne({ username: redUsername });

      if (!redUser) {
        return res
          .status(409)
          .send({ error: true, message: "User does not exist!" });
      }

      if (!userSet[redUsername]) {
        userSet[redUsername] = {};
      }

      // set username
      userSet[redUsername].username = redUsername;

      // get red user avatar
      if (redUser?.avatar?.length > 0) {
        userSet[redUsername].avatar = redUser?.avatar;
      }

      // get red user game name
      if (
        tokendata.game === "FN" ||
        tokendata.game == null ||
        tokendata.game == ""
      ) {
        // get epic
        userSet[redUsername].gameUsername = redUser?.epic;
      } else if (tokendata.game === "VAL") {
        // get val id
        userSet[redUsername].gameUsername = redUser?.connections[0]?.valId;
      } else if (tokendata.game === "CLASH") {
        // get clash id
        userSet[redUsername].gameUsername = redUser?.connections[1]?.clashId;
      } else if (tokendata.game === "FIVEM") {
        userSet[redUsername].gameUsername = redUser?.connections[2]?.fivemID;
      }
    }
    // console.log(tokendata.game);
    // console.log(userSet[redUsername].gameUsername);

    const getTournament = async (isTourneyMatch) => {
      if (isTourneyMatch) {
        const tournamentdata = await BracketTourneyData.findOne({
          _id: tokendata?.tourneyId,
        });
        return tournamentdata;
      }
      return {};
    };

    const tournament = await getTournament(wagerdata?.isTourneyMatch);

    let token = {
      userSet,
      ...wagerdata?._doc,
      ...tokendata?._doc,
      title: getCurrentTokenTitle(tokendata?.team_size, tokendata?.match_type),
      gameTitle: getCurrentTokenGame(tokendata?.game),
      prize: getCurrentTokenPrize(tokendata?.entry_fee),
      blueTeam: blueTeamData,
      redTeam: redTeamData,
      tournament,
    };

    return token;
  } catch (err) {
    console.log(err);
    if (err) return;
  }
};

const getUser = (username, callback) => {
  if (!username) {
    return;
  }
  UserData.findOne({ username }, (err, userdata) => {
    if (err) {
      return;
    }
    if (!userdata) {
      return;
    }
    callback(userdata);
  });
};

// helper method to remove teams from the wager
const team_leave_wager = async (teamid) => {
  const data = await TeamData.findOne({ _id: teamid });

  if (!data) {
    return;
  }
  data.in_wager = false;
  data.wager_id = "";
  await data?.save();
  return;
};

// cancel wager helper method
const cancel = (wagerObj) => {
  console.log("cancelling here");
  // console.log("METHOD IS BEING CALLED INDEED");
  if (!wagerObj) {
    return;
  }

  wagerObj.state = wagerObj?.CANCEL_STATE;
  wagerObj?.save();

  WagerData.findOne({ _id: wagerObj?.wagerid }, (err, data) => {
    const start = Date.now();

    const unique_value = hash({
      team: data?.team,
      users: data?.users,
      entry_fee: data?.entry_fee,
      region: data?.region,
      match_type: data?.match_type,
      team_size: data?.team_size,
      first_to: data?.first_to,
      start,
    });
    data.unique_value = unique_value;

    data.cancelled = true;
    data?.save();
  });

  team_leave_wager(wagerObj?.blueteamid);
  if (wagerObj?.redteamid) {
    team_leave_wager(wagerObj?.redteamid);
  }

  return;
};

const resetWagerBalance = async (wagerid, io) => {
  // console.log("calling reset once");
  const newwagerdata = await WagerDataV2.findOne({ wagerid });
  const wagerdata = await WagerData.findOne({ _id: wagerid });
  let entry_fee = wagerdata?.entry_fee;

  let blue_adjustment = 0;
  let red_adjustment = 0;
  if (wagerdata?.paid_entry) {
    blue_adjustment = entry_fee;
    red_adjustment = entry_fee;
  }

  if (wagerdata?.paid_prizes) {
    if (wagerdata?.winner == 1) {
      blue_adjustment = -entry_fee;
    } else {
      red_adjustment = -entry_fee;
    }
  }

  if (blue_adjustment || red_adjustment) {
    // if blue is winner and blue put up
    if (
      newwagerdata &&
      newwagerdata?.userThatPutUpBlue !== "" &&
      newwagerdata?.userThatPutUpBlue != null
    ) {
      console.log("blue is winner cancel put up");
      const blueputupdata = await UserData.findOne({
        username: newwagerdata?.userThatPutUpBlue,
      });
      blueputupdata.balance += entry_fee * wagerdata?.blueteam_users?.length;
      await blueputupdata?.save();
      if (io) {
        io.in(blueputupdata.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          blueputupdata.balance.toString()
        );
      }
    } else {
      for (let i = 0; i < wagerdata?.blueteam_users?.length; i++) {
        const bluedata = await UserData.findOne({
          username: wagerdata?.blueteam_users[i],
        });
        bluedata.balance += blue_adjustment;
        await bluedata?.save();
        if (io) {
          io.in(wagerdata?.blueteam_users[i]).emit(
            NEW_UPDATE_BALANCE_EVENT,
            bluedata.balance.toString()
          );
        }
      }
    }

    // if red is winner and red put up
    if (
      newwagerdata &&
      newwagerdata?.userThatPutUpRed !== "" &&
      newwagerdata?.userThatPutUpRed != null
    ) {
      console.log("red is winner cancel put up");
      const redputupdata = await UserData.findOne({
        username: newwagerdata?.userThatPutUpRed,
      });
      redputupdata.balance += entry_fee * wagerdata?.redteam_users?.length;
      try {
        await redputupdata?.save();
      } catch (err) {
        console.log(err);
      }
      if (io) {
        io.in(redputupdata.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          redputupdata.balance.toString()
        );
      }
    } else {
      for (let i = 0; i < wagerdata?.redteam_users?.length; i++) {
        const reddata = await UserData.findOne({
          username: wagerdata?.redteam_users[i],
        });
        reddata.balance += red_adjustment;
        try {
          await reddata?.save();
        } catch (err) {
          console.log(err);
        }

        if (io) {
          io.in(wagerdata?.redteam_users[i]).emit(
            NEW_UPDATE_BALANCE_EVENT,
            reddata.balance.toString()
          );
        }
      }
    }
  }

  wagerdata.paid_entry = false;
  wagerdata.paid_prizes = false;
  await wagerdata?.save();
};

const gameMessage = (wagerid, message, io) => {
  // store it in the db
  WagerData.findOne({ _id: wagerid }, (err, wagerdata) => {
    if (err || !wagerdata) {
      return;
    }
    const messageObj = { username: "Game", text: message };
    wagerdata?.chat?.addToSet(messageObj);
    wagerdata.save({}, (err, chatdata) => {
      if (err) {
        return;
      }
      // send it using sockets
      io.in(wagerid).emit("newChatMessage", {
        name: "Game",
        message: message,
        id: wagerdata?.chat[wagerdata?.chat?.length - 1]?._id,
      });
      return;
    });
  });
};

const whichTeam = (wager, username) => {
  if (wager?.blue_users?.includes(username)) {
    return 1;
  } else if (wager?.red_users?.includes(username)) {
    return 2;
  }
  return -1;
};

const readyUpHelper = async (wager, username, io) => {
  if (wager?.state != wager?.READY_STATE) {
    return false;
  }

  if (wager?.readied_users?.includes(username)) {
    wager.is_readied[wager?.readied_users?.indexOf(username)] = true;

    for (let i = 0; i < wager?.blue_users?.length; i++) {
      const index = wager?.readied_users?.indexOf(wager?.blue_users[i]);
      if (!wager?.is_readied[index]) {
        try {
          await wager?.save();
          return true;
        } catch (err) {
          console.log(err);
          if (err) return false;
        }
      }
    }

    for (let i = 0; i < wager?.red_users?.length; i++) {
      const index = wager?.readied_users?.indexOf(wager?.red_users[i]);
      if (!wager?.is_readied[index]) {
        try {
          await wager?.save();
          return true;
        } catch (err) {
          console.log(err);
          if (err) return false;
        }
      }
    }

    try {
      const data = await WagerData.findOne({ _id: wager?.wagerid });
      const today = new Date().toString();
      const wagerString = wager?.wagerid;
      const prize = data?.entry_fee;

      const newwagerdata = await WagerDataV2.findOne({ wagerid: wagerString });
      if (!newwagerdata) {
        for (let i = 0; i < wager?.readied_users?.length; i++) {
          const userdata = await UserData.findOne({
            username: wager?.readied_users[i],
          });
          userdata.balance -= prize;
          await userdata?.save();
          io.in(wager?.readied_users[i]).emit(
            NEW_UPDATE_BALANCE_EVENT,
            userdata.balance.toString()
          );
        }
      } else {
        const amountToTake = prize * data?.team_size;
        // check if both teams put up
        if (
          newwagerdata?.userThatPutUpBlue !== "" &&
          newwagerdata?.userThatPutUpRed !== "" &&
          newwagerdata?.userThatPutUpRed != null &&
          newwagerdata?.userThatPutUpBlue != null
        ) {
          // console.log("both users put up");
          const namesToTakeMoneyFrom = [
            newwagerdata?.userThatPutUpBlue,
            newwagerdata?.userThatPutUpRed,
          ];
          for (let i = 0; i < namesToTakeMoneyFrom?.length; i++) {
            const brokeuserdata = await UserData.findOne({
              username: namesToTakeMoneyFrom[i],
            });
            // take entry fee * num players on their team
            brokeuserdata.balance -= amountToTake;
            await brokeuserdata.save();
            io.in(namesToTakeMoneyFrom[i]).emit(
              NEW_UPDATE_BALANCE_EVENT,
              brokeuserdata.balance.toString()
            );
          }
        }
        // check if only blue put up
        if (
          newwagerdata?.userThatPutUpBlue !== "" &&
          newwagerdata?.userThatPutUpBlue != null &&
          (newwagerdata?.userThatPutUpRed === "" ||
            newwagerdata?.userThatPutUpRed == null)
        ) {
          // console.log("only blue put up");
          // take amountToTake from blue put up
          const blueputupdata = await UserData.findOne({
            username: newwagerdata?.userThatPutUpBlue,
          });
          blueputupdata.balance -= amountToTake;
          await blueputupdata.save();
          io.in(blueputupdata.username).emit(
            NEW_UPDATE_BALANCE_EVENT,
            blueputupdata.balance.toString()
          );
          // take prize from all red players
          for (let i = 0; i < wager?.red_users?.length; i++) {
            const reduserdata = await UserData.findOne({
              username: wager?.red_users[i],
            });
            reduserdata.balance -= prize;
            await reduserdata.save();
            io.in(wager?.red_users[i]).emit(
              NEW_UPDATE_BALANCE_EVENT,
              reduserdata.balance.toString()
            );
          }
        }
        // check if only red put up
        if (
          (newwagerdata?.userThatPutUpBlue === "" ||
            newwagerdata?.userThatPutUpBlue == null) &&
          newwagerdata?.userThatPutUpRed !== "" &&
          newwagerdata?.userThatPutUpRed != null
        ) {
          // console.log("only red put up");
          // take amountToTake from red put up
          const redputupdata = await UserData.findOne({
            username: newwagerdata?.userThatPutUpRed,
          });
          redputupdata.balance -= amountToTake;
          await redputupdata.save();
          io.in(redputupdata.username).emit(
            NEW_UPDATE_BALANCE_EVENT,
            redputupdata.balance.toString()
          );
          // take prize from all blue players
          for (let i = 0; i < wager?.blue_users?.length; i++) {
            const blueuserdata = await UserData.findOne({
              username: wager?.blue_users[i],
            });
            blueuserdata.balance -= prize;
            await blueuserdata.save();
            io.in(wager?.blue_users[i]).emit(
              NEW_UPDATE_BALANCE_EVENT,
              blueuserdata.balance.toString()
            );
          }
        }
      }

      for (let i = 0; i < wager?.readied_users?.length; i++) {
        const userdata = await UserData.findOne({
          username: wager?.readied_users[i],
        });
        const newMatchHistory = {
          wager_id: "https://www.taverngaming.com/token/" + wager?.wagerid,
          game_mode: data?.match_type,
          entry_fee: data?.entry_fee,
          date: today,
          status: "-1",
          game: data?.game || null,
          team_size: data?.team_size,
        };

        userdata?.match_history?.addToSet(newMatchHistory);
        await userdata?.save();
      }

      data.paid_entry = true;
      await data?.save();

      wager.timer = -1;
      wager.state = wager?.PLAYING_STATE;
      await wager?.save();

      const host = Math.random() < 0.5 ? "Red" : "Blue";
      gameMessage(wager?.wagerid, `${host} team is the host!`, io);
      if (data?.game == "VAL") {
        gameMessage(
          wager?.wagerid,
          `${host} will play the first half on the defending side.`,
          io
        );
      }
      if (data?.game == "CLASH") {
        gameMessage(
          wager?.wagerid,
          `${host}, send your friend invite link in the chat.`,
          io
        );
      }

      return true;
    } catch (err) {
      console.log(err);
      if (err) return false;
    }
  }
  return false;
};

const win = async (wager, teamnum, io, callback) => {
  // console.log("PAYING OUT HERE");
  try {
    if (!wager) {
      // console.log("no wager");
      return;
    }

    wager.state = wager?.DONE_STATE;
    wager.winner = teamnum;

    wager?.save({}, (err, data) => {
      if (err) {
        console.log(err);
        return;
      }
    });
    const newwagerdata = await WagerDataV2.findOne({ wagerid: wager?.wagerid });

    const data = await WagerData.findOne({ _id: wager?.wagerid });

    const blueTeamData = await TeamData.findOne({ _id: data.blueteamid });
    const redTeamData = await TeamData.findOne({ _id: data.redteamid });
    var earnings = 0;
    if (data.game === "FIVEM") {
      earnings = parseFloat(data?.entry_fee * 0.9);
    } else {
      earnings = parseFloat(data?.entry_fee * 0.8);
    }
    var match_type = data.match_type;
    const prize =
      data?.entry_fee *
      (data.blueteam_users.length + data.redteam_users.length);
    let winners = [];
    let nonWinners = [];
    if (data.isTourneyMatch === false) {
      if (teamnum == 1) {
        winners = data?.blueteam_users;
        nonWinners = data?.redteam_users;

        for (let i = 0; i < winners.length; i++) {
          const blueEarnings = await EarningsData.findOne({
            username: winners[i],
          });
          const redEarnings = await EarningsData.findOne({
            username: nonWinners[i],
          });
          if (!redEarnings) {
            const earnedData = new EarningsData({
              username: nonWinners[i],
              BF: 0,
              ZW: 0,
              REAL: 0,
              PG: 0,
              END: 0,
              FIVEM: 0,
              total: 0,
              wins: 0,
              losses: 0,
              eliteTrophies: 0,
              goldTrophies: 0,
              silverTrophies: 0,
              bronzeTrophies: 0,
              avatar: [],
            });
            await earnedData.save();
          }
          if (!blueEarnings) {
            const earnedData = new EarningsData({
              username: winners[i],
              BF: 0,
              ZW: 0,
              REAL: 0,
              PG: 0,
              END: 0,
              FIVEM: 0,
              total: 0,
              wins: 0,
              losses: 0,
              eliteTrophies: 0,
              goldTrophies: 0,
              silverTrophies: 0,
              bronzeTrophies: 0,
              avatar: [],
            });
            await earnedData.save();
          }
          const fetchedBlueEarnings = await EarningsData.findOne({
            username: winners[i],
          });
          const fetchedRedEarnings = await EarningsData.findOne({
            username: nonWinners[i],
          });
          fetchedBlueEarnings.wins++;
          fetchedRedEarnings.losses++;
          await fetchedBlueEarnings.save();
          await fetchedRedEarnings.save();
        }

        //blue win
        blueTeamData.win += earnings;
        blueTeamData.wins += 1;
        //red loss
        redTeamData.loss += data?.entry_fee;
        redTeamData.losses += 1;
      } else {
        winners = data?.redteam_users;
        nonWinners = data?.blueteam_users;
        for (let i = 0; i < winners.length; i++) {
          const redEarnings = await EarningsData.findOne({
            username: winners[i],
          });
          const blueEarnings = await EarningsData.findOne({
            username: nonWinners[i],
          });
          if (!blueEarnings) {
            const earnedData = new EarningsData({
              username: nonWinners[i],
              BF: 0,
              ZW: 0,
              REAL: 0,
              PG: 0,
              END: 0,
              FIVEM: 0,
              total: 0,
              wins: 0,
              losses: 0,
              eliteTrophies: 0,
              goldTrophies: 0,
              silverTrophies: 0,
              bronzeTrophies: 0,
              avatar: [],
            });
            await earnedData.save();
          }
          if (!redEarnings) {
            const earnedData = new EarningsData({
              username: winners[i],
              BF: 0,
              ZW: 0,
              REAL: 0,
              PG: 0,
              END: 0,
              FIVEM: 0,
              total: 0,
              wins: 0,
              losses: 0,
              eliteTrophies: 0,
              goldTrophies: 0,
              silverTrophies: 0,
              bronzeTrophies: 0,
              avatar: [],
            });
            await earnedData.save();
          }

          const fetchedRedEarnings = await EarningsData.findOne({
            username: winners[i],
          });
          const fetchedBlueEarnings = await EarningsData.findOne({
            username: nonWinners[i],
          });
          fetchedRedEarnings.wins += 1;
          fetchedBlueEarnings.losses += 1;
          await fetchedRedEarnings.save();
          await fetchedBlueEarnings.save();
        }
      }

      //red win
      redTeamData.win += earnings;
      redTeamData.wins += 1;
      //blue loss
      blueTeamData.losses += 1;
      blueTeamData.loss += data?.entry_fee;
    }
    await blueTeamData.save();
    await redTeamData.save();
    data.paid_prizes = true;
    await data.save();
    let eachUserEarnings = 0;
    if (data.game === "FIVEM") {
      eachUserEarnings = (prize / data.blueteam_users.length) * 0.95;
    } else {
      eachUserEarnings = (prize / data.blueteam_users.length) * 0.9;
    }

    const putUpEarnings = eachUserEarnings * blueTeamData?.usernames?.length;
    const updatedObjForSure = await WagerData.findOne({ _id: wager?.wagerid });
    if (updatedObjForSure.paid_prizes === true) {
      if (
        newwagerdata &&
        teamnum === 1 &&
        newwagerdata?.userThatPutUpBlue !== "" &&
        newwagerdata?.userThatPutUpBlue !== "" &&
        newwagerdata?.userThatPutUpBlue != null
      ) {
        // console.log(newwagerdata?.userThatPutUpBlue + " put up for blue and won");

        const blueputupdata = await UserData.findOne({
          username: newwagerdata?.userThatPutUpBlue,
        });
        blueputupdata.balance += putUpEarnings;
        blueputupdata.max_withdrawal += putUpEarnings;

        const last_match_history = blueputupdata.match_history.find(
          (match) =>
            match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
        );
        const index = blueputupdata.match_history.indexOf(last_match_history);
        blueputupdata.match_history[index].status = winners.toString();

        await blueputupdata?.save();

        //saving teammates of blueputup match history status
        for (let i = 0; i < data.blueteam_users.length; i++) {
          if (data.blueteam_users[i] !== blueputupdata.username) {
            const winnerTeamData = await UserData.findOne({
              username: data.blueteam_users[i],
            });
            const last_match_history = winnerTeamData.match_history.find(
              (match) =>
                match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
            );
            const index =
              winnerTeamData.match_history.indexOf(last_match_history);
            winnerTeamData.match_history[index].status = winners.toString();
            await winnerTeamData?.save();
          }
        }
        //saving non winners match history status
        for (let i = 0; i < nonWinners.length; i++) {
          const nonWinnerData = await UserData.findOne({
            username: nonWinners[i],
          });
          const last_match_history = nonWinnerData.match_history.find(
            (match) =>
              match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
          );
          const index = nonWinnerData.match_history.indexOf(last_match_history);
          nonWinnerData.match_history[index].status = winners.toString();
          await nonWinnerData?.save();
        }

        io.in(blueputupdata.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          blueputupdata.balance.toString()
        );
        const earningsData = await EarningsData.findOne({
          username: blueputupdata?.username,
        });
        // const match_type = data.match_type;
        if (!earningsData) {
          const earnedData = new EarningsData({
            username: blueputupdata.username,
            BF: 0,
            ZW: 0,
            REAL: 0,
            PG: 0,
            END: 0,
            FIVEM: 0,
            total: 0,
            wins: 0,
            losses: 0,
            eliteTrophies: 0,
            goldTrophies: 0,
            silverTrophies: 0,
            bronzeTrophies: 0,
            avatar: [],
          });
          switch (match_type) {
            case "ZW":
              earnedData.ZW += earnings;
              break;

            case "BOX":
              earnedData.BF += earnings;
              break;

            case "REAL":
              earnedData.REAL += earnings;
              break;
            case "PG":
              earnedData.PG += earnings;
              break;
            case "END":
              earnedData.END += earnings;
              break;

            default:
              break;
          }
          switch (data.game) {
            case "FIVEM":
              earnedData.FIVEM += earnings;
              break;
            default:
              break;
          }
          earnedData.total += earnings;

          await earnedData.save();
        } else {
          switch (match_type) {
            case "ZW":
              earningsData.ZW += earnings;
              break;

            case "BOX":
              earningsData.BF += earnings;
              break;

            case "REAL":
              earningsData.REAL += earnings;
              break;
            case "PG":
              earningsData.PG += earnings;
              break;
            case "END":
              earningsData.END += earnings;
              break;

            default:
              break;
          }
          switch (data.game) {
            case "FIVEM":
              earningsData.FIVEM += earnings;
              break;
            default:
              break;
          }
          earningsData.total += earnings;
          await earningsData.save();
        }
      } else if (
        newwagerdata &&
        teamnum === 2 &&
        newwagerdata?.userThatPutUpRed !== "" &&
        newwagerdata?.userThatPutUpRed != null
      ) {
        // console.log(newwagerdata?.userThatPutUpRed + " put up for red and won");
        const redputupdata = await UserData.findOne({
          username: newwagerdata?.userThatPutUpRed,
        });
        redputupdata.balance += putUpEarnings;
        redputupdata.max_withdrawal += putUpEarnings;

        //saving teammates of redputup match history status
        for (let i = 0; i < data.redteam_users.length; i++) {
          if (data.redteam_users[i] !== redputupdata.username) {
            const winnerTeamData = await UserData.findOne({
              username: data.redteam_users[i],
            });
            const last_match_history = winnerTeamData.match_history.find(
              (match) =>
                match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
            );
            const index =
              winnerTeamData.match_history.indexOf(last_match_history);
            winnerTeamData.match_history[index].status = winners.toString();
            await winnerTeamData?.save();
          }
        }

        const last_match_history = redputupdata.match_history.find(
          (match) =>
            match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
        );
        const index = redputupdata.match_history.indexOf(last_match_history);
        redputupdata.match_history[index].status = winners.toString();

        await redputupdata?.save();

        for (let i = 0; i < nonWinners.length; i++) {
          const nonWinnerData = await UserData.findOne({
            username: nonWinners[i],
          });
          const last_match_history = nonWinnerData.match_history.find(
            (match) =>
              match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
          );
          const index = nonWinnerData.match_history.indexOf(last_match_history);
          nonWinnerData.match_history[index].status = winners.toString();
          await nonWinnerData?.save();
        }

        io.in(redputupdata.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          redputupdata.balance
        );
        const earningsData = await EarningsData.findOne({
          username: redputupdata?.username,
        });
        // const match_type = data.match_type;
        if (!earningsData) {
          const earnedData = new EarningsData({
            username: redputupdata.username,
            BF: 0,
            ZW: 0,
            REAL: 0,
            PG: 0,
            END: 0,
            FIVEM: 0,
            total: 0,
            avatar: [],
          });
          switch (match_type) {
            case "ZW":
              earnedData.ZW += earnings;
              break;

            case "BOX":
              earnedData.BF += earnings;
              break;

            case "REAL":
              earnedData.REAL += earnings;
              break;
            case "PG":
              earnedData.PG += earnings;
              break;
            case "END":
              earnedData.END += earnings;
              break;

            default:
              break;
          }
          switch (data.game) {
            case "FIVEM":
              earnedData.FIVEM += earnings;
              break;
            default:
              break;
          }
          earnedData.total += earnings;

          await earnedData.save();
        } else {
          switch (match_type) {
            case "ZW":
              earningsData.ZW += earnings;
              break;

            case "BOX":
              earningsData.BF += earnings;
              break;

            case "REAL":
              earningsData.REAL += earnings;
              break;
            case "PG":
              earningsData.PG += earnings;
              break;
            case "END":
              earningsData.END += earnings;
              break;

            default:
              break;
          }
          switch (data.game) {
            case "FIVEM":
              earningsData.FIVEM += earnings;
              break;
            default:
              break;
          }
          earningsData.total += earnings;
          await earningsData.save();
        }
      } else {
        // if no one put up
        for (let i = 0; i < winners.length; i++) {
          // getUserByName(winners[i], (userdata) => {
          const nonWinnerData = await UserData.findOne({
            username: nonWinners[i],
          });
          const userdata = await UserData.findOne({ username: winners[i] });
          userdata.balance += eachUserEarnings;
          // console.log("PAYING OUT HERE TWO");

          if (!userdata?.max_withdrawal) {
            userdata.max_withdrawal = 0;
          }
          userdata.max_withdrawal += eachUserEarnings;
          // have to save winner AND loser match history, last_match_history = winner, other one is loser
          // loser match history is from nonWinners array

          const last_match_history = userdata.match_history.find(
            (match) =>
              match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
          );
          const loser_match_history = nonWinnerData.match_history.find(
            (match) =>
              match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
          );

          const index = userdata.match_history.indexOf(last_match_history);
          const loserIndex =
            nonWinnerData.match_history.indexOf(loser_match_history);

          userdata.match_history[index].status = winners.toString();
          nonWinnerData.match_history[loserIndex].status = winners.toString();
          await nonWinnerData?.save();
          // console.log("winners: " + winners);
          await userdata?.save();
          io.in(userdata.username).emit(
            NEW_UPDATE_BALANCE_EVENT,
            userdata.balance
          );
          const earningsData = await EarningsData.findOne({
            username: userdata?.username,
          });
          if (!earningsData) {
            const earnedData = new EarningsData({
              username: userdata.username,
              BF: 0,
              ZW: 0,
              REAL: 0,
              PG: 0,
              END: 0,
              FIVEM: 0,
              total: 0,
              avatar: [],
            });
            switch (match_type) {
              case "ZW":
                earnedData.ZW += earnings;
                break;

              case "BOX":
                earnedData.BF += earnings;
                break;

              case "REAL":
                earnedData.REAL += earnings;
                break;
              case "PG":
                earnedData.PG += earnings;
                break;
              case "END":
                earnedData.END += earnings;
                break;

              default:
                break;
            }
            switch (data.game) {
              case "FIVEM":
                earnedData.FIVEM += earnings;
                break;
              default:
                break;
            }
            earnedData.total += earnings;

            await earnedData.save();
          } else {
            switch (match_type) {
              case "ZW":
                earningsData.ZW += earnings;
                break;

              case "BOX":
                earningsData.BF += earnings;
                break;

              case "REAL":
                earningsData.REAL += earnings;
                break;
              case "PG":
                earningsData.PG += earnings;
                break;
              case "END":
                earningsData.END += earnings;
                break;

              default:
                break;
            }
            switch (data.game) {
              case "FIVEM":
                earningsData.FIVEM += earnings;
                break;
              default:
                break;
            }
            earningsData.total += earnings;
            await earningsData.save();
          }
        }
        // const match_type = data.match_type;
      }
    }
    let profit = prize * 0.1;
    const profitData = await ProfitData.findOne({ wagerId: wager?.wagerid });
    if (!profitData) {
      const newProfit = new ProfitData({
        wagerId: wager?.wagerid,
        profit: profit,
      });
      await newProfit.save();
    } else {
      profitData.profit = profit;
      profitData.wagerId = wager?.wagerid;
      await profitData.save();
    }

    let winColor = "Blue";
    if (teamnum == 2) {
      winColor = "Red";
    }

    const activewagerdata = await ActiveWagerData.findOne({
      wagerid: wager?.wagerid,
    });
    // console.log(activewagerdata);
    if (activewagerdata) {
      await activewagerdata.remove();
    }

    const token = await getTokenObject(wager?.wagerid);
    //console.log("token: ", token);
    return callback(token);
  } catch (err) {
    console.log(err);
    console.log("Catching error in win func");
    if (err) return;
  }
};

const dispute = async (wager) => {
  if (!wager) {
    return;
  }

  try {
    wager.state = wager?.DISPUTE_STATE;
    await wager?.save();
    return;
  } catch (err) {
    console.log(err);
    if (err) return;
  }
  return;
};

const resolve = async (wager, blue, red, io) => {
  if (!wager) return false;
  wager.timer = 0;
  const wagerdata = await WagerData.findOne({ _id: wager.wagerid });

  if (blue == 1 && red == 0) {
    // blue wins

    if (wagerdata.isTourneyMatch) {
      const newToken = await bracketTournamentWin(wager, 1, io);
      return callback(newToken, 1);
    }

    win(wager, 1, io, (wagerdata) => {
      if (!wagerdata) return false;
      return true;
    });
  }

  if (blue == 0 && red == 1) {
    // red wins
    if (wagerdata.isTourneyMatch) {
      const newToken = await bracketTournamentWin(wager, 2, io);
      return callback(newToken, 2);
    }
    win(wager, 2, io, (wagerdata) => {
      if (!wagerdata) return false;
      return true;
    });
  }

  if (blue == 0 && red == 0) {
    // both submitted losses give it to blue
    if (wager.isTourneyMatch) {
      const newToken = await bracketTournamentWin(wager, 1, io);
      return callback(newToken, 1);
    }
    win(wager, 1, io, (wagerdata) => {
      if (!wagerdata) return false;
      return true;
    });
  }

  if (blue == 1 && red == 1) {
    gameMessage(
      wager?.wagerid,
      `A dispute has begun. Please submit all of your evidence in this chat while a moderator arrives.`,
      io
    );
    await dispute(wager);
    return false;
  }
};

const submit = async (wager, username, status, io, callback) => {
  // make sure we are in the playing phase
  if (
    wager?.state != wager?.PLAYING_STATE &&
    wager?.state != wager?.DISPUTE_STATE
  ) {
    const token = await getTokenObject(wager?.wagerid);
    return callback(token, -1);
  }

  // check if the results are already in
  // if (wager?.winner >= 0) {
  //   getTokenObject(wager?.wagerid, (token) => {
  //     return callback(token, -1);
  //   });
  // }

  const wagerdata = await WagerData.findOne({ _id: wager.wagerid });

  // check if the user is even in this wager
  if (wager?.readied_users?.includes(username)) {
    if (wager?.blue_users?.includes(username)) {
      // console.log(status);
      // check if it is already submitted
      if (wager?.bluesubmit == 1 && wager?.state != wager?.DISPUTE_STATE) {
        const token = await getTokenObject(wager?.wagerid);
        return callback(token, -1);
      }

      wager.bluesubmit = status;
      wager.single_sub = 1;

      if (status == 0) {
        if (wager.redsubmit !== 0 && wager.winner == -1) {
          if (wagerdata.isTourneyMatch) {
            const newToken = await bracketTournamentWin(wager, 2, io);
            return callback(newToken, 2);
          }

          win(wager, 2, io, (newWagerData) => {
            gameMessage(wager?.wagerid, `Blue team marked their loss.`, io);
            // console.log("failing here");
            return callback(newWagerData, 2);
          });
        }
        const token = await getTokenObject(wager?.wagerid);
        return callback(token, -1);
      }
    } else if (wager?.red_users?.includes(username)) {
      // console.log(status);
      // check if its already submitted
      if (wager?.redsubmit == 1 && wager?.state != wager?.DISPUTE_STATE) {
        const token = await getTokenObject(wager?.wagerid);
        return callback(token, -1);
      }

      wager.redsubmit = status;
      wager.single_sub = 2;

      if (status == 0) {
        if (wager.bluesubmit !== 0 && wager.winner == -1) {
          if (wagerdata.isTourneyMatch) {
            const newToken = await bracketTournamentWin(wager, 1, io);
            return callback(newToken, 1);
          }

          win(wager, 1, io, (newWagerData) => {
            gameMessage(wager?.wagerid, `Red team marked their loss.`, io);
            return callback(newWagerData, 1);
          });
        }
        const token = await getTokenObject(wager?.wagerid);
        return callback(token, -1);
      }
    } else {
      const token = await getTokenObject(wager?.wagerid);
      return callback(token, -1);
    }

    // check if both teams have submitted
    if (wager?.bluesubmit == 1 && wager?.redsubmit == 1) {
      const resolved = await resolve(
        wager,
        wager?.bluesubmit,
        wager?.redsubmit,
        io
      );
      if (resolved) {
        const token = await getTokenObject(wager?.wagerid);
        console.log("dispute token: ", token);
        return callback(token, 2);
      } else {
        const token = await getTokenObject(wager?.wagerid);
        return callback(token, 1);
      }
    } else {
      // start 10 minute timer for auto winning tokens and 5 minutes for tournaments
      if (
        wager.isTourneyMatch === true &&
        wager.isTourneyMatch !== false &&
        wager.isTourneyMatch !== null
      ) {
        wager.timer = 5 * 60;
        setTimeout(() => {
          WagerObjectData.findOne(
            { wagerid: wager.wagerid },
            (err, updatedwagerdata) => {
              if (err) {
                console.log(err);
                return;
              }
              if (updatedwagerdata?.winner <= 0) {
                if (
                  updatedwagerdata?.redsubmit >= 0 &&
                  updatedwagerdata?.redsubmit !== -1 &&
                  updatedwagerdata?.bluesubmit < 0 &&
                  updatedwagerdata?.state === 2
                ) {
                  bracketTournamentWin(updatedwagerdata, 2, io);
                }

                if (
                  updatedwagerdata?.bluesubmit >= 0 &&
                  updatedwagerdata?.bluesubmit !== -1 &&
                  updatedwagerdata?.redsubmit < 0 &&
                  updatedwagerdata?.state === 2
                ) {
                  bracketTournamentWin(updatedwagerdata, 1, io);
                }
              }
            }
          );
        }, 5 * 60 * 1000);
      } else {
        wager.timer = 10 * 60;
      }

      // console.log("hitting");
      try {
        await wager?.save();
        const token = await getTokenObject(wager?.wagerid);
        if (token?.bluesubmit == 1) {
          gameMessage(wager?.wagerid, `Blue team marked their win.`, io);
        } else if (token?.redsubmit == 1) {
          gameMessage(wager?.wagerid, `Red team marked their win.`, io);
        }
        return callback(token, 1);
      } catch (err) {
        console.log(err);
        console.log("Catching parallel save for match:" + wager?.wagerid);
        if (err) return;
      }
    }
  }
  const token = await getTokenObject(wager?.wagerid);
  return callback(token, -1);
  // not playing because user is not in this wager
};

// reset token helper
const resetTokenHelper = async (wagerId) => {
  console.log("RESETTING HERE");
  if (!wagerId) {
    return;
  }

  const wagerdata = await WagerObjectData.findOne({ wagerid });
  if (!wagerdata) {
    return;
  }

  const wager = await WagerData.findOne({ _id: wagerId });

  let earnings = 0;
  if (wager.game == "FIVEM") {
    earnings = wager.entry_fee * 0.9;
  } else {
    earnings = wager.entry_fee * 0.8;
  }

  wager.done = false;
  wager.cancelled = false;
  wagerdata.timer = 0;

  if (wager?.paid_prizes) {
    if (wagerdata?.winner == 1) {
      for (let i = 0; i < wager?.blueteam_users?.length; i++) {
        const name = wager?.blueteam_users[i];
        getUserByName(name, (userdata) => {
          userdata.balance -= wager?.entry_fee * 2;
          userdata?.save();
        });
      }
    } else if (wagerdata?.winner == 2) {
      for (let i = 0; i < wager?.redteam_users?.length; i++) {
        const name = wager?.redteam_users[i];
        getUserByName(name, (userdata) => {
          userdata.balance -= wager?.entry_fee * 2;
          userdata?.save();
        });
      }
    }
  }

  // set blue team in wager
  getTeam(wagerdata?.blueteamid, (blueTeamData) => {
    if (!blueTeamData) {
      return res.send({
        error: true,
        message: "Could not find blue team!",
      });
    }
    blueTeamData.in_wager = true;
    blueTeamData.wager_id = wagerId;
    blueTeamData.save();
  });

  // set red team in wager
  getTeam(wagerdata?.redteamid, (redTeamData) => {
    if (!redTeamData) {
      return res.send({ error: true, message: "Could not find red team!" });
    }
    redTeamData.in_wager = true;
    redTeamData.wager_id = wagerId;
    redTeamData.save();
  });

  wager.paid_prizes = false;

  await wager?.save();
  wagerdata.bluesubmit = -1;
  wagerdata.redsubmit = -1;
  wagerdata.single_sub = -1;
  wagerdata.winner = -1;

  wagerdata.state = wagerdata?.PLAYING_STATE;

  await wagerdata?.save();
  return;
};

const ban = (user, length, new_num_bans) => {
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

  user.save({}, (err, data) => {
    if (err) {
      return;
    }
    const Note = new NoteData({
      username: user.username,
      note: user.username + " was banned via pun points. ",
      author: user.username,
      timestamp: new Date(),
    });
    Note.save({}, (error, data) => {
      if (error) {
        return;
      }
    });
  });
};

const checkUserBans = (user) => {
  var num_bans = user?.prior_bans;
  var pun_points = user?.pun_points;

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
};

// send chat message
const sendChatMessage = (wagerId, username, text, res) => {
  // WagerData.findOne({ _id: wagerId }, (err, wagerdata) => {
  //   if (err || !wagerdata) {
  //     if (!res) {
  //       return;
  //     }
  //     return res.status(409).send();
  //   }
  //   const messageObj = { username, text };
  //   wagerdata?.chat?.addToSet(messageObj);
  //   wagerdata.save();
  //   if (!res) {
  //     return;
  //   }
  //   return res.status(200).send();
  // });
};

// get chat messages
const getChatMessages = (wagerId, res) => {
  WagerData.findOne({ _id: wagerId }, (err, wagerdata) => {
    if (err || !wagerdata) {
      return -1;
    }

    return res.send({ error: null, chat: wagerdata.chat });
  });
};

const readNoti = async (req, res) => {
  try {
    const notification = req.body.notification;
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const userData = await UserData.findOne({ username });

    const noti_to_change = userData?.notifications?.find(
      (noti) =>
        new Date(noti?.timestamp)?.toString() ===
        new Date(notification?.timestamp)?.toString()
    );
    const index = userData?.notifications?.indexOf(noti_to_change);
    if (index !== -1) {
      userData.notifications[index].read = true;
    }

    await userData?.save();
    return res.status(200).send({
      error: false,
      message: "Successfully read notification.",
      notis: userData.notifications,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(409)
      .send({ error: true, message: "Notification does not exist." });
  }
};

module.exports = {
  generateVerifyCode,
  sendVerificationEmail,
  getUserByName,
  getTeam,
  teamMinBal,
  teamCheckEpics,
  createWagerObject,
  getWagerObject,
  getUser,
  cancel,
  resetWagerBalance,
  gameMessage,
  whichTeam,
  readyUpHelper,
  team_leave_wager,
  win,
  resolve,
  submit,
  resetTokenHelper,
  checkUserBans,
  sendChatMessage,
  getChatMessages,
  doesUsernameMatchToken,
  getUserIdFromToken,
  getUsernameFromToken,
  getUserToken,
  getTokenObject,
  readNoti,
  bracketTournamentWin,
};

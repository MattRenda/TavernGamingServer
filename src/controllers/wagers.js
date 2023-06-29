const { WagerData } = require("../models/Wager");
const { WagerObjectData } = require("../models/WagerObject");
const { ActiveWagerData } = require("../models/ActiveWagers");
const { TeamData } = require("../models/Team");
const { BracketTourneyData } = require("../models/BracketTournament");
const {
  teamMinBal,
  teamCheckEpics,
  getTeam,
  createWagerObject,
  getWagerObject,
  getUser,
  cancel,
  resetWagerBalance,
  whichTeam,
  getUserByName,
  readyUpHelper,
  team_leave_wager,
  submit,
  win,
  resetTokenHelper,
  checkUserBans,
  sendChatMessage,
  getChatMessages,
  doesUsernameMatchToken,
  getUserToken,
  getUsernameFromToken,
  getTokenObject,
  gameMessage,
} = require("../utils/helperMethods");
const hash = require("object-hash");
const { v4: uuidv4 } = require("uuid");
const { UserData } = require("../models/User");
const { WagerDataV2 } = require("../models/WagerDataV2");
const { NoteData } = require("../models/NoteData");
const { filter } = require("async");
const {
  generateRandomAvatarOptions,
} = require("../utils/generateRandomAvatarOptions");
const NEW_ACTIVE_TOKEN = "newActiveToken";
const REMOVE_ACTIVE_TOKEN = "removeActiveToken";
const NEW_CURRENT_TOKEN_EVENT = "newCurrentToken";
const {
  getCurrentTokenGame,
  getCurrentTokenPrize,
  getCurrentTokenTitle,
} = require("../utils/tokenHelpers");

// get an active wager with id
const getCurrentWager = (req, res) => {
  const wagerId = req.params.wagerId;
  WagerData.findOne({ _id: wagerId }, (err, wager) => {
    if (err) {
      return res.send({ error: true, message: "Could not get token!" });
    }
    if (wager) {
      return res.send({ error: null, wager });
    }
    return res.send({ error: null, wager: {} });
  });
};

const getCurrentToken = async (req, res) => {
  const tokenId = req.params.tokenId;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  try {
    const userdata = await UserData.findOne({ username });
    const wagerdata = await WagerObjectData.findOne({ wagerid: tokenId });
    const tokendata = await WagerData.findOne({ _id: tokenId });

    if (!userdata) {
      return res
        .status(409)
        .send({ error: true, message: "This user does not exist!" });
    }
    if (!tokendata || !wagerdata) {
      return res
        .status(409)
        .send({ error: true, message: "Token does not exist!" });
    }

    // check if user is allowed to view token
    if (userdata?.role < 100) {
      // check if they are in the token
      if (
        !tokendata?.isTourneyMatch &&
        !(
          tokendata.blueteam_users.includes(userdata.username) ||
          tokendata.redteam_users.includes(userdata.username)
        )
      ) {
        return res
          .status(401)
          .send({ error: true, message: "User is not in this token!" });
      }
    }

    // make avatar set
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
      if (tokendata.game === "FN") {
        // get epic
        userSet[blueUsername].gameUsername = blueUser?.epic;
      } else if (tokendata.game === "VAL") {
        // get val id
        userSet[blueUsername].gameUsername = blueUser?.connections[0]?.valId;
      } else if (tokendata.game === "CLASH") {
        // get clash id
        userSet[blueUsername].gameUsername = blueUser?.connections[1]?.clashId;
      } else if (tokendata.game === "FIVEM") {
        // get fivem id
        userSet[blueUsername].gameUsername = blueUser?.connections[2]?.fivemID;
      } else {
        // get epic
        userSet[blueUsername].gameUsername = blueUser?.epic;
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
      if (tokendata.game === "FN") {
        // get epic
        userSet[redUsername].gameUsername = redUser?.epic;
      } else if (tokendata.game === "VAL") {
        // get val id
        userSet[redUsername].gameUsername = redUser?.connections[0]?.valId;
      } else if (tokendata.game === "CLASH") {
        // get clash id
        userSet[redUsername].gameUsername = redUser?.connections[1]?.clashId;
      } else if (tokendata.game === "FIVEM") {
        // get fivem id
        userSet[redUsername].gameUsername = redUser?.connections[2]?.fivemID;
      } else {
        // get epic
        userSet[redUsername].gameUsername = redUser?.epic;
      }
    }

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

    // combine both wager objects and user set
    let token = {
      userSet,
      ...wagerdata?._doc,
      ...tokendata?._doc,
      title: getCurrentTokenTitle(tokendata?.team_size, tokendata?.match_type),
      gameTitle: getCurrentTokenGame(tokendata?.game),
      prize: getCurrentTokenPrize(tokendata?.entry_fee),
      tournament,
    };

    return res.status(200).send({ error: false, token });
  } catch (err) {
    if (err) {
      console.log(err);
      return res
        .status(409)
        .send({ error: true, message: "Error getting this token!" });
    }
  }
};

// get wager status
const getCurrentWagerStatus = (req, res) => {
  const wagerId = req.body.wagerId;
  const username = req.body.username;

  getWagerObject(wagerId, (data) => {
    if (!wagerId) {
      return res.json({
        error: true,
        message: "Please include wager id",
        redirect: true,
      });
    }

    if (!username) {
      return res.json({
        error: true,
        message: "Please include username",
        redirect: true,
      });
    }

    if (!data) {
      return res.json({
        error: true,
        message: "Wager does not exist",
        redirect: true,
      });
    }

    WagerData.findOne({ _id: wagerId }, (err, wagerdata) => {
      if (!wagerdata) {
        return res.json({
          error: true,
          message: "Wager does not exist",
          redirect: true,
        });
      }
      getUser(username, (userdata) => {
        if (!userdata) {
          return res.json({
            error: true,
            message: "No userdata",
            redirect: true,
          });
        }
        if (userdata.role < 100) {
          if (
            !(
              wagerdata.blueteam_users.includes(userdata.username) ||
              wagerdata.redteam_users.includes(userdata.username)
            )
          ) {
            return res.json({
              error: true,
              redirect: true,
              message: "User is not in this token",
            });
          }
        }

        let wagerObject = JSON.parse(JSON.stringify(data));
        wagerObject["your_username"] = userdata?.username;
        wagerObject["your_team"] = whichTeam(data, userdata?.username);

        return res.json({ error: null, wagerStatus: wagerObject });
      });
    });
  });
};

// cancel wager
const cancelWager = (req, res) => {
  // const wagerId = req.body.wagerId;
  // const username = req.body.username;
  // if (!wagerId) {
  //   return res
  //     .status(409)
  //     .send({ error: true, message: "Must include wagerId to cancel" });
  // }
  // getUser(username, (userdata) => {
  //   getWagerObject(wagerId, (data) => {
  //     if (userdata?.role <= 100) {
  //       if (
  //         !(
  //           data?.blue_users?.includes(username) ||
  //           data?.red_users?.includes(username)
  //         )
  //       ) {
  //         // user not in this wager
  //         return res.send({
  //           error: true,
  //           message: "User is not included in this token!",
  //         });
  //       }
  //     }
  //     if (data?.state == data?.JOIN_STATE || userdata?.role > 100) {
  //       cancel(data);
  //       //resetWagerBalance(wagerId);
  //     }
  //     if (
  //       !(
  //         data?.blue_users?.includes(username) ||
  //         data?.red_users?.includes(username)
  //       )
  //     ) {
  //       return;
  //     }
  //     res.status(200).send({ error: null, wager: data });
  //     return;
  //   });
  // });
};

// get active user wagers
const getActiveUserWagers = (req, res) => {
  const username = req.params.username;
  if (!username) {
    return res.status(409).send({ error: true, message: "Must add username!" });
  }
  TeamData.findOne({ usernames: username, in_wager: true }, (err, wager) => {
    if (err) {
      return res.status(500).send({ error: true, message: "Internal Error!" });
    }
    if (wager) {
      return res.status(200).send({ error: null, wager: wager?.wager_id });
    }
    return res.status(200).send({ error: null, wager: null });
  });
};

// get agreed users
const getAgreedCancelUsers = (req, res) => {
  const wagerId = req.params.wagerid;

  if (!wagerId) {
    return res.send({ error: true, message: "Must add wagerId" });
  } else {
    WagerDataV2.findOne({ wagerid: wagerId }, (err, wagerdata) => {
      if (err) {
        return res.send({ error: true, message: "Could not get agreed users" });
      }
      return res.send({ error: null, agreedUsers: wagerdata?.agreedPlayers });
    });
  }
};

const getFirstThreeWagers = async (req, res) => {
  const activewagers = await ActiveWagerData.find({}, "wagerid").limit(3);
  WagerData.find(
    { _id: { $in: activewagers.map((m) => m.wagerid) } },
    "blueteamid redteamid blueteam_users redteam_users entry_fee region match_type team_size first_to console_only done cancelled password",
    (err, wagers) => {
      if (err) {
        return res.status(409).send();
      } else {
        return res.status(200).send(wagers);
      }
    }
  );
};
// get wagers
const getWagers = (req, res) => {
  const team_size = req.params.team_size;
  const region = req.params.region;
  const match_type = req.params.match_type;
  const console_only = req.params.console_only;
  const game = req.params.game;
  ActiveWagerData.find({}, "wagerid", (err, activewagers) => {
    // console.log(activewagers);
    if (err) {
      return res.status(500).json({ error: true, message: err });
    }
    WagerData.find(
      { _id: { $in: activewagers.map((m) => m.wagerid) } },
      "blueteamid redteamid blueteam_users redteam_users entry_fee region match_type team_size first_to console_only done cancelled password game showMe",
      (err, wagers) => {
        let filters = [];
        if (game !== "null" || game != null || game != "") {
          if (filters?.length < 1) {
            filters = wagers?.filter((w) => w.game === game);
          } else {
            let gameFilter = filters?.filter((w) => w.game === game);
            filters = gameFilter;
          }
        }

        if (region !== "null") {
          if (filters?.length < 1) {
            filters = wagers?.filter((w) => w.region === region);
          } else {
            let regionFilters = filters?.filter((w) => w.region === region);
            filters = regionFilters;
          }
        }

        if (match_type !== "null") {
          if (filters?.length < 1) {
            filters = wagers?.filter((w) => w.match_type === match_type);
          } else {
            let matchTypeFilters = filters?.filter(
              (w) => w.match_type === match_type
            );
            filters = matchTypeFilters;
          }
        }

        if (team_size !== "null") {
          if (filters?.length < 1) {
            filters = wagers?.filter(
              (w) => w.team_size === parseInt(team_size)
            );
          } else {
            let teamSizeFilters = filters?.filter(
              (w) => w.team_size === parseInt(team_size)
            );
            filters = teamSizeFilters;
          }
        }

        if (console_only == "true") {
          if (filters?.length < 1) {
            filters = wagers?.filter((w) => w.console_only === true);
          } else {
            let consoleFilters = filters?.filter(
              (w) => w.console_only === true
            );
            filters = consoleFilters;
          }
        }

        if (err) {
          return res.status(500).json({ error: true, message: err });
        }

        if (
          region !== "null" ||
          match_type !== "null" ||
          console_only !== "null" ||
          team_size !== "null" ||
          game !== "null"
        ) {
          return res.status(200).json({ error: null, wagers: filters });
        } else {
          return res.status(200).json({ error: null, wagers: wagers });
        }
      }
    );
  });
};

// create wager
const createWager = async (req, res, io) => {
  const entry_fee = Math.floor(100 * parseFloat(req.body.entry_fee)) / 100;
  const region = req.body.region;
  const match_type = req.body.match_type;
  const team = req.body.teamid;
  const first_to = parseInt(req.body.first_to);
  const console_only = req.body.console_only;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);
  const userThatPutUp = req.body.userThatPutUp;
  const password = req.body.password;
  const game = req.body.game;
  const showMe = req.body.showMe;

  const userData = await UserData.findOne({ username });
  if (userData.connections[0] == null && game == "VAL") {
    return res.send({
      error: true,
      message: "Please link your Valorant ID in your profile first.",
    });
  }
  if (userData.connections[1] == null && game == "CLASH") {
    return res.send({
      error: true,
      message: "Please link your Clash ID in your profile first.",
    });
  }
  if (userData.connections[2] == null && game == "FIVEM") {
    return res.send({
      error: true,
      message: "Please link your FiveM ID in your profile first.",
    });
  }

  if (isNaN(req.body.entry_fee)) {
    return res.send({ error: true, message: "Invalid Price" });
  }
  if (!req.body.first_to && game !== "CLASH" && game !== "FIVEM") {
    return res.send({ error: true, message: "Missing 'first_to'" });
  }
  if (req.body.console_only == null && game == "FN") {
    return res.send({ error: true, message: "Missing console_only" });
  }

  if (team.length === 0) {
    return res.send("You must select a team!");
  }

  if (
    !entry_fee ||
    (!region && game !== "CLASH" && game !== "FIVEM") ||
    !match_type ||
    !team ||
    (!first_to && game !== "CLASH") ||
    !game
  ) {
    return res.send({ error: true, message: "Please enter all fields." });
  }

  if (entry_fee < 0.1 || entry_fee > 100) {
    return res.send({
      error: true,
      message: "Token price must be between $0.10 and $100.00",
    });
  }
  if (
    !(
      region == "NAE" ||
      region == "NAW" ||
      region == "EU" ||
      region == "OCE" ||
      region == "CENTRAL"
    ) &&
    game !== "CLASH" &&
    game !== "FIVEM"
  ) {
    res.send("Region must be NAE, NAW, CENTRAL, EU, or OCE.");
    return;
  }
  if (
    !(
      match_type == "ZW" ||
      match_type == "REAL" ||
      match_type == "BOX" ||
      match_type == "PG" ||
      match_type == "RACE" ||
      match_type == "ARENA_RACE" ||
      match_type == "ICEBOX" ||
      match_type == "BIND" ||
      match_type == "HAVEN" ||
      match_type == "SPLIT" ||
      match_type == "ASCENT" ||
      match_type == "BREEZE" ||
      match_type == "FRACTURE" ||
      match_type == "BATTLE" ||
      match_type == "ELIXIR" ||
      match_type == "RAMPS" ||
      match_type == "BIG_ARENA" ||
      match_type == "STABLES" ||
      match_type == "PARK" ||
      match_type == "VANS"
    )
  ) {
    res.send("Incorrect Match Type.");
    return;
  }

  if (game === "VAL") {
    if (first_to !== 5 && first_to !== 7 && first_to !== 9 && first_to !== 13) {
      return res.send({
        error: true,
        message: "Token rounds must be either 5, 7, 9 or 13",
      });
    }
  }

  if (game === "FN") {
    if (match_type == "ARENA_RACE" || match_type == "RACE") {
      if (first_to < 1 || first_to > 3) {
        return res.send({
          error: true,
          message: "Token rounds must be either 1, or 3",
        });
      }
    } else {
      if (first_to < 3 || first_to > 11) {
        return res.send({
          error: true,
          message: "Token rounds must be either 3, 5, or 7",
        });
      }
    }
  }

  if (!username) {
    return res.send({ error: true, message: "Could not find user!" });
  }

  const teamdata = await TeamData.findOne({ _id: team }).exec();

  if (game === "FIVEM") {
    if (
      match_type === "RAMPS" &&
      teamdata.usernames.length !== 1 &&
      teamdata.usernames.length !== 2
    ) {
      return res.send({
        error: true,
        message: "Ramp matches must be 1v1 or 2v2.",
      });
    }
    if (
      match_type === "BIG_ARENA" &&
      teamdata.usernames.length !== 3 &&
      teamdata.usernames.length !== 4 &&
      teamdata.usernames.length !== 5
    ) {
      return res.send({
        error: true,
        message: "Arena matches must be 3v3, 4v4 or 5v5.",
      });
    }
    if (
      match_type === "STABLES" &&
      teamdata.usernames.length !== 3 &&
      teamdata.usernames.length !== 4 &&
      teamdata.usernames.length !== 5
    ) {
      return res.send({
        error: true,
        message: "Stable matches must be 3v3, 4v4 or 5v5.",
      });
    }
    if (
      match_type === "VANS" &&
      teamdata.usernames.length !== 1 &&
      teamdata.usernames.length !== 2
    ) {
      return res.send({
        error: true,
        message: "Van matches must be 1v1 or 2v2.",
      });
    }
  }

  if (teamdata.in_wager) {
    return res.send({
      error: true,
      message: "This team is already in a token!",
    });
  }

  const wager = await TeamData.findOne({ usernames: username, in_wager: true });
  if (wager) {
    return res.send({
      error: true,
      message: "Cannot create a token while in one.",
    });
  }

  const teamUsers = teamdata.usernames;

  if (!teamUsers.includes(username)) {
    return res.send({ error: true, message: "You are not on this team!" });
  }

  if (!userThatPutUp) {
    // console.log(req.body.username + " created token without putting up.");
    const minBalance = await teamMinBal([...teamdata?.usernames], -1);
    if (entry_fee > minBalance) {
      return res.send({
        error: true,
        message:
          "At least one of the team's members does not have a high enough balance",
      });
    }
  } else if (userThatPutUp) {
    // check if users balance is enough
    const userMinBal = await teamMinBal([userThatPutUp], -1);
    if (entry_fee * teamdata.usernames.length > userMinBal) {
      return res.send({
        error: true,
        message: "You do not have enough tokens to put up for your teammates.",
      });
    }
  }
  if (game !== "CLASH" && game !== "VAL" && game !== "FIVEM") {
    const epicsSet = await teamCheckEpics([...teamdata?.usernames]);
    if (epicsSet == -1) {
      return res.send({
        error: true,
        message:
          "At least one of your team's members must submit their battletag on their profile",
      });
    } else if (epicsSet == -2) {
      return res.send({
        error: true,
        message: "At least one of your team's members is banned",
      });
    }
  }

  const team_size = teamdata.usernames.length;
  const uuid = uuidv4();

  const unique_value = hash({
    team,
    teamUsers,
    entry_fee,
    region,
    match_type,
    team_size,
    first_to,
    uuid,
  });

  let newWagerObj = {
    unique_value: unique_value,
    blueteamid: team,
    redteamid: "",
    blueteam_users: teamUsers,
    redteam_users: [],
    entry_fee: entry_fee,
    region: region ?? "",
    match_type: match_type,
    team_size: team_size,
    first_to: game === "CLASH" ? 1 : first_to,
    done: false,
    chat: [],
    cancelled: false,
    paid_entry: false,
    paid_prizes: false,
    console_only: console_only ?? false,
    password: "",
    game: game,
    rematchSent: false,
    rematchAccepted: false,
    isTourneyMatch: false,
    tourneyId: null,
    showMe: showMe,
  };

  if (password != "" || password != null) {
    newWagerObj.password = password;
  }

  const newWager = new WagerData(newWagerObj);

  newWager.save((err, wager) => {
    if (err) {
      return res.send({
        error: true,
        message: "Error creating this token",
      });
    }
    const wager_id = newWager._id.toString();

    teamdata.in_wager = true;
    teamdata.wager_id = wager_id;
    teamdata.save();
    createWagerObject(newWager._id, team, teamdata.usernames);
    const newActiveWager = new ActiveWagerData({ wagerid: newWager._id });
    newActiveWager.save({}, (err, data) => {
      if (err) {
        console.log("Error saving new active wager");
        return;
      } else {
        if (userThatPutUp != null) {
          const newWagerData = new WagerDataV2({
            wagerid: wager_id,
            agreedPlayers: [],
            userThatPutUpBlue: userThatPutUp,
            userThatPutUpRed: "",
          });

          newWagerData.save((err, savedData) => {
            if (err) {
              return;
            }
          });
        }
        return;
      }
    });
    teamUsers?.forEach((user) =>
      io.in(user).emit(NEW_CURRENT_TOKEN_EVENT, wager_id)
    );
    io.emit("newActiveToken", wager);
    return res.status(200).send({ error: null, wager });
  });
};

const joinWager = async (req, res, io) => {
  const wagerId = req.body.wagerId;
  const teamId = req.body.teamId;
  const username = req.body.username;
  const userToken = req.headers["authorization"]?.split(" ")[1];
  const userThatPutUp = req.body.userThatPutUp;
  const game = req.body.game;
  // const balances = req.body.balances;
  // console.log(teamId);

  // check that username matches userId
  // console.log(username);
  // console.log(userToken);
  try {
    const doesMatchUserToken = await doesUsernameMatchToken(
      username,
      userToken
    );

    if (!doesMatchUserToken) {
      return res.send({
        error: true,
        message: "You are trying to take an action for a user that is not you!",
      });
    }

    const userData = await UserData.findOne({ username });
    if (userData.connections[0] == null && game == "VAL") {
      return res.send({
        error: true,
        message: "Please link your Valorant ID in your profile first.",
      });
    }
    if (userData.connections[1] == null && game == "CLASH") {
      return res.send({
        error: true,
        message: "Please link your Clash ID in your profile first.",
      });
    }
    if (userData.connections[2] == null && game == "FIVEM") {
      return res.send({
        error: true,
        message: "Please link your Fivem ID in your profile first.",
      });
    }

    const teamData = await TeamData.findOne({ _id: teamId }).exec();
    const epicsSet = await teamCheckEpics([...teamData?.usernames]);
    const wagerdata = await WagerData.findOne({ _id: wagerId });
    const data = await WagerObjectData.findOne({ wagerid: wagerId });
    const entryFee = wagerdata?.entry_fee;
    const minBalance = await teamMinBal(
      userThatPutUp === "" ? [...teamData?.usernames] : [userThatPutUp],
      -1
    );

    // console.log("Entry fee of current token: " + entryFee);
    // console.log("Minimum balance of current token: " + minBalance);
    if (
      userThatPutUp === ""
        ? minBalance < entryFee
        : minBalance < entryFee * teamData?.usernames?.length
    ) {
      if (res.headersSent) {
        return;
      }
      return res.status(409).send({
        error: true,
        message: "At least one of your teammates has NO BONES.",
      });
    } else {
      if (!wagerdata) {
        if (res.headersSent) {
          return;
        }
        return res.status(409).send({ error: true, message: "Server Error!" });
      }

      // console.log("line 400 after wagerdata");
      const wager = await TeamData.findOne({
        usernames: username,
        in_wager: true,
      });
      if (wager) {
        return res
          .status(409)
          .send({ error: true, message: "Cannot join a token while in one." });
      }
      if (wagerdata?.cancelled == true) {
        // console.log("hitting this");
        if (res.headersSent) {
          return;
        }
        return res?.status(409).send({
          error: true,
          message: "This token has already been cancelled.",
        });
      }
      if (wagerdata?.redteam_users?.length > 0) {
        if (res.headersSent) {
          return;
        }
        return res?.status(409).send({
          error: true,
          message: "This token has already been accepted by another team.",
        });
      } else {
        if (teamData?.usernames?.length != wagerdata?.blueteam_users?.length) {
          const size = wagerdata?.blueteam_users?.length.toString();
          return res.send({
            error: true,
            message:
              "This token is a " +
              size +
              "v" +
              size +
              " match, you must have " +
              size +
              " player(s) in your team.",
          });
        }

        if (
          teamData?._id == wagerdata?.blueteamid ||
          wagerdata?.blueteam_users.includes(teamData?.usernames)
        ) {
          if (res.headersSent) {
            return;
          }
          return res.status(409).send({
            error: true,
            message: "You cannot join your own token!",
          });
        }
        // TeamData.findOne({ _id: teamdata }, (err, currentTeam) => {
        // console.log("line 455 before checking own token join");
        // console.log(teamData.usernames);
        for (let user of teamData?.usernames) {
          // console.log("before if statement");
          // console.log("blueteam users" + wagerdata?.blueteam_users);
          // console.log("user" + user);
          if (wagerdata?.blueteam_users.includes(user)) {
            // console.log("Does this include blue users but line 454:" + wagerdata?.blueteam_users.includes(user));
            // console.log("cannot join own token");
            return res.status(409).send("Cannot join own token.");
          }
        }
        // console.log("checking epics");
        // console.log("Does this include blue users:" + wagerdata?.blueteam_users.includes(user));
        if (game !== "VAL" && game !== "CLASH" && game !== "FIVEM") {
          if (epicsSet == -1) {
            if (res.headersSent) {
              return;
            }
            return res.status(409).send({
              error: true,
              message:
                "At least one of the team's members must submit their battletag on their profile.",
            });
          } else if (epicsSet == -2) {
            if (res.headersSent) {
              return;
            }
            return res.status(409).send({
              error: true,
              message: "At least one of your team's members is banned.",
            });
          }
        }

        wagerdata.redteamid = teamId;
        wagerdata.redteam_users = teamData?.usernames;

        await wagerdata?.save();
        teamData.in_wager = true;
        teamData.wager_id = wagerId;
        if (userThatPutUp !== "") {
          const putUpData = await WagerDataV2.findOne({ wagerid: wagerId });
          if (!putUpData) {
            const newWagerData = new WagerDataV2({
              wagerid: wagerId,
              agreedPlayers: [],
              userThatPutUpBlue: "",
              userThatPutUpRed: userThatPutUp,
            });
            newWagerData.save((err, _) => {
              if (err) {
                return;
              }
            });
          } else {
            putUpData.userThatPutUpRed = userThatPutUp;
            putUpData.save((err, _) => {
              if (err) {
                return;
              }
            });
          }
        }
        await teamData?.save();
        data.redteamid = teamId;
        data.red_users = teamData?.usernames;

        data.state = data?.READY_STATE;
        data.timer = 120;

        // pushing blue ready users
        for (let i = 0; i < data?.blue_users?.length; i++) {
          data?.readied_users?.push(data?.blue_users[i]);
          data?.is_readied?.push(false);
        }
        // pushing red ready users
        for (let i = 0; i < data?.red_users?.length; i++) {
          data?.readied_users?.addToSet(data?.red_users[i]);
          data?.is_readied?.push(false);
        }

        // pushing epics via readied users array
        for (let i = 0; i < data?.readied_users?.length; i++) {
          const teamsdata = await UserData.findOne({
            username: data?.readied_users[i],
          });
          data?.epics?.addToSet(teamsdata?.epic);
          if (data?.epics?.length == data?.readied_users?.length) {
            await data?.save();
            console.log(
              req.body.username +
                " is now live playing: " +
                data.wagerid +
                " for $" +
                entryFee +
                " with: " +
                data?.readied_users
            );
            io.in(data?.readied_users[i]).emit(
              NEW_CURRENT_TOKEN_EVENT,
              wagerId
            );
            // return res.status(200).send({
            //   error: null,
            //   navigate: true,
            //   message: "Success!",
            // });
          }
        }
        await data?.save();
        const tokendata = await getTokenObject(wagerId);
        io.in(wagerId).emit("newJoin", tokendata);
        ActiveWagerData.findOne(
          { wagerid: wagerId },
          (err, activewagerdata) => {
            //console.log(activewagerdata);
            if (err) {
              return;
            } else if (activewagerdata) {
              activewagerdata.remove();
            } else if (!activewagerdata) {
              return;
            }
          }
        );
        io.emit(REMOVE_ACTIVE_TOKEN, wagerId);
        return res.status(200).send({
          error: null,
          navigate: true,
          message: "Success!",
        });
      }
    }
  } catch (err) {
    console.log(err);
    return;
  }
};

const acceptRematch = async (req, res, io) => {
  const oldTokenId = req.body.tokenId;

  try {
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const oldwagerdata = await WagerData.findOne({ _id: oldTokenId });
    const oldwagerdatav2 = await WagerDataV2.findOne({ wagerid: oldTokenId });
    const redusers = oldwagerdata?.redteam_users;
    const blueusers = oldwagerdata?.blueteam_users;
    const allUsers = oldwagerdata?.blueteam_users?.concat(
      oldwagerdata?.redteam_users
    );

    if (!allUsers?.includes(username)) {
      return res.send({
        error: true,
        message: "You were not in the original token!",
      });
    }

    if (oldwagerdata?.rematchAccepted) {
      return res.send({
        error: true,
        message: "Rematch has already been accepted by one of your teammates.",
      });
    }

    // check if any player is currently in a token
    for (let i = 0; i < allUsers?.length; i++) {
      const inToken = await TeamData.findOne({
        usernames: allUsers[i],
        in_wager: true,
      });
      if (inToken) {
        return res.send({
          error: true,
          message: "Cannot accept rematch while a player is in a token.",
        });
      }
    }

    // check clash id is linked for first user if clash
    if (oldwagerdata?.game === "CLASH") {
      const blueuser = await UserData.findOne({ username: blueusers[0] });
      const reduser = await UserData.findOne({ username: redusers[0] });

      if (blueuser?.connections[1] == null) {
        return res.send({
          error: true,
          message: "Please link your Clash ID in your profile first.",
        });
      }

      if (reduser?.connections[1] == null) {
        return res.send({
          error: true,
          message: "Please link your Clash ID in your profile first.",
        });
      }
    }

    // check valorant id is linked for first user if valorant
    if (oldwagerdata?.game === "VAL") {
      const blueuser = await UserData.findOne({ username: blueusers[0] });
      const reduser = await UserData.findOne({ username: redusers[0] });

      if (blueuser?.connections[0] == null) {
        return res.send({
          error: true,
          message: "Please link your Valorant ID in your profile first.",
        });
      }

      if (reduser?.connections[0] == null) {
        return res.send({
          error: true,
          message: "Please link your Valorant ID in your profile first.",
        });
      }
    }

    // check all users have an epic if fortnite
    if (oldwagerdata?.game === "FN") {
      const epicsSet = await teamCheckEpics([...allUsers]);
      if (epicsSet == -1) {
        return res.send({
          error: true,
          message:
            "At least one members involved in the token does not have an Epic linked.",
        });
      } else if (epicsSet == -2) {
        return res.send({
          error: true,
          message:
            "At least one of the members involved in the token is banned.",
        });
      }
    }

    // check balances
    const bluePutUpUser = oldwagerdatav2?.userThatPutUpBlue;
    const redPutUpUser = oldwagerdatav2?.userThatPutUpRed;
    const entry_fee =
      Math.floor(100 * parseFloat(oldwagerdata?.entry_fee)) / 100;

    if (bluePutUpUser != null && bluePutUpUser !== "") {
      // check blue user balance
      const blueUserMinBal = await teamMinBal([bluePutUpUser], -1);
      if (entry_fee * oldwagerdata?.blueteam_users?.length > blueUserMinBal) {
        return res.send({
          error: true,
          message:
            "The player who put up for their teammates does not have enough to put up for their teammates.",
        });
      }
    } else {
      // check all blue team balance
      const minBalance = await teamMinBal(
        [...oldwagerdata?.blueteam_users],
        -1
      );
      if (entry_fee > minBalance) {
        return res.send({
          error: true,
          message:
            "At least one member involved in the token does not have enough tokens.",
        });
      }
    }

    if (redPutUpUser != null && redPutUpUser !== "") {
      // check red put up user balance
      const redUserMinBal = await teamMinBal([redPutUpUser], -1);
      if (entry_fee * oldwagerdata?.redteam_users?.length > redUserMinBal) {
        return res.send({
          error: true,
          message:
            "The player who put up for their teammates does not have enough to put up for their teammates.",
        });
      }
    } else {
      // check all red team balance
      const minBalance = await teamMinBal([...oldwagerdata?.redteam_users], -1);
      if (entry_fee > minBalance) {
        return res.send({
          error: true,
          message:
            "At least one member involved in the token does not have enough tokens.",
        });
      }
    }

    const newWagerObj = {
      unique_value: oldwagerdata?.unique_value + "#rematch",
      blueteamid: oldwagerdata?.blueteamid,
      redteamid: oldwagerdata?.redteamid,
      blueteam_users: oldwagerdata?.blueteam_users,
      redteam_users: oldwagerdata?.redteam_users,
      entry_fee: entry_fee,
      region: oldwagerdata?.region,
      match_type: oldwagerdata?.match_type,
      team_size: oldwagerdata?.team_size,
      first_to: oldwagerdata?.first_to,
      done: false,
      chat: [],
      cancelled: false,
      paid_entry: false,
      paid_prizes: false,
      console_only: oldwagerdata?.console_only,
      password: "",
      game: oldwagerdata?.game,
      rematchSent: false,
      rematchAccepted: false,
      isTourneyMatch: false,
      tourneyId: null,
      showMe: null,
    };

    const newWager = new WagerData(newWagerObj);
    await newWager.save();
    const newTokenId = newWager?._id?.toString();

    const blueteamdata = await TeamData.findOne({
      _id: oldwagerdata?.blueteamid,
    });
    const redteamdata = await TeamData.findOne({
      _id: oldwagerdata?.redteamid,
    });

    if (!blueteamdata || !redteamdata) {
      return res.send({ error: true, message: "Team does not exist!" });
    }

    blueteamdata.in_wager = true;
    blueteamdata.wager_id = newTokenId;
    await blueteamdata?.save();

    redteamdata.in_wager = true;
    redteamdata.wager_id = newTokenId;
    await redteamdata?.save();

    const newWagerObjData = new WagerObjectData({
      wagerid: newTokenId,
      blueteamid: oldwagerdata?.blueteamid,
      redteamid: oldwagerdata?.redteamid,
      blue_users: oldwagerdata?.blueteam_users,
      red_users: oldwagerdata?.redteam_users,
      readied_users: [...allUsers],
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
      state: 1,
      timer: 180,
      isTourneyMatch: false,
    });
    await newWagerObjData?.save();

    if (oldwagerdatav2) {
      const newWagerDataV2 = new WagerDataV2({
        wagerid: newTokenId,
        agreedPlayers: [],
        userThatPutUpBlue: oldwagerdatav2?.userThatPutUpBlue || "",
        userThatPutUpRed: oldwagerdatav2?.userThatPutUpRed || "",
      });
      await newWagerDataV2.save();
    }

    oldwagerdata.rematchAccepted = true;
    await oldwagerdata?.save();

    allUsers.forEach((user) =>
      io.in(user).emit(NEW_CURRENT_TOKEN_EVENT, newTokenId)
    );
    return res.status(200).send({ error: null, tokenId: newTokenId });
  } catch (err) {
    console.log(err);
    return;
  }
};

// ready up in a wager
const readyUpAPI = (req, res) => {
  const wagerId = req.body.wagerId;
  const username = req.body.username;

  if (!wagerId) {
    res.json({ error: true, message: "Must include wager id to ready up!" });
  }

  getWagerObject(wagerId, (data) => {
    const readied = readyUpHelper(data, username);

    if (readied) {
      return res.send({ error: null, message: "Success!" });
    }
    return res.send({ error: true, message: "Unable to ready up!" });
  });
};

// markWagerDone
const markWagerComplete = async (wagerId) => {
  try {
    const data = await WagerObjectData.findOne({ wagerid: wagerId });
    team_leave_wager(data?.blueteamid);
    team_leave_wager(data?.redteamid);

    const wagerdata = await WagerData.findOne({ _id: wagerId });

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
    await wagerdata?.save();
  } catch (err) {
    console.log(err);
    return;
  }
};

// submitWagerResult
const submitWagerResult = (req, res) => {
  const status = req.body.status;
  const wagerId = req.body.wagerId;
  const username = req.body.username;

  if (!wagerId) {
    return res.send({ error: true, message: "Incorrect parameters." });
  }

  getWagerObject(wagerId, (data) => {
    const results = submit(data, username, status);

    if (results == 1) {
      res.status(200).send();
    } else if (results == 2) {
      markWagerComplete(wagerId);
      return res.status(200).send();
    } else {
      return res.send({
        error: true,
        message:
          "Failed to submit results, they may already be submitted. Try refreshing.",
      });
    }
  });
};

const forceWin = (req, res) => {
  const wagerId = req.body.wagerId;
  const teamNum = req.body.teamNum;
  const username = req.body.username;

  if (!wagerId || !teamNum) {
    return res.send({ error: true, message: "Missing wagerId or teamNum" });
  }

  getUser(username, (userdata) => {
    if (userdata?.role <= 100) {
      return res.send({
        error: true,
        message: "User must be a mod or admin to force a win!",
      });
    }

    getWagerObject(wagerId, (wagerdata) => {
      win(wagerdata, parseInt(teamNum));
      markWagerComplete(wagerId);

      return res.send({ error: null, message: "Success" });
    });
  });
};

// reset token
const resetToken = (req, res) => {
  const wagerId = req.body.wagerId;
  const username = req.body.username;

  if (!wagerId) {
    return res.send({
      error: true,
      message: "Must include a wagerId to reset token!",
    });
  }

  getUser(username, (userdata) => {
    if (userdata?.role < 200) {
      return res.send({
        error: true,
        message: "You do not have permission to reset the match!",
      });
    }

    resetTokenHelper(wagerId);

    return res
      .status(200)
      .send({ error: null, message: "Successfully reset!" });
  });
};

const punishUser = async (req, res, io) => {
  const userToPunish = req.body.userToPunish;
  const points = req.body.points;
  const wagerId = req.body.wagerId;
  let actualId = wagerId.split("/")[4];
  let reason = "";

  if (points == 75) {
    reason = "Minor Toxicity (Not TOS)";
  }
  if (points == 100) {
    reason = "False Mark / Stalling";
  }
  if (points == 200) {
    reason = "Very Toxic/ TOS";
  }
  if (points == 700) {
    reason = "Temp Cheating Ban - Awaiting Perm";
  }

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  if (!userToPunish || !points) {
    return res.send({ error: true, message: "Must include points or user!" });
  }
  const newuserdata = await UserData.findOne({ username: userToPunish });

  const moduserdata = await UserData.findOne({ username });
  if (!moduserdata) {
    return res.send({
      error: true,
      message: "No user found with that username",
    });
  }
  if (!moduserdata.role) {
    return res.status(409).send();
  }
  if (moduserdata.role < 200) {
    return res.status(409).send();
  }

  let newNotification = {
    read: false,
    body:
      "You were punished by " +
      moduserdata.username +
      " for " +
      reason +
      ", repeated offenses will result in a ban.",
    attached: actualId,
    type: "pun",
    actionable: false,
    timestamp: Date.now(),
    avatar: moduserdata.avatar[0],
  };

  newuserdata.pun_points += parseInt(points);
  gameMessage(
    wagerId,
    `${newuserdata.username} has been given ` + points + ` pun points.`,
    io
  );
  io.in(userToPunish).emit("newNotification", newNotification);
  newuserdata.notifications.addToSet(newNotification);
  await newuserdata.save();

  checkUserBans(newuserdata);

  newuserdata?.save({}, (err, data) => {
    if (err) {
      console.log("Pun point parallel save catch");
      return;
    }
    const Note = new NoteData({
      username: userToPunish,
      note:
        username +
        " gave this user " +
        points +
        " pun points for token: " +
        wagerId,
      author: newuserdata.username,
      timestamp: new Date(),
    });
    Note.save({}, (error, data) => {
      //console.log("saving note here");
      const AnotherNote = new NoteData({
        username: username,
        note:
          username +
          " gave " +
          userToPunish +
          " " +
          points +
          " pun points for token: " +
          wagerId,
        author: newuserdata.username,
        timestamp: new Date(),
      });
      AnotherNote.save({}, (error, data) => {
        if (error) {
          return;
        }
      });
    });
  });
  return res.status(200).send({ error: null, message: "Success!" });
};

const sendChat = (req, res) => {
  // const message = req.body.message;
  // const wagerId = req.body.wagerId;
  // const username = req.body.username;
  // if (!message || !wagerId) {
  //   return res.send({ error: true, message: "No message or wager id!" });
  // }
  // sendChatMessage(wagerId, username, message, res);
  // return;
};

const getChat = (req, res) => {
  const wagerId = req.body.wagerId;
  getChatMessages(wagerId, res);
};

module.exports = {
  getWagers,
  createWager,
  getActiveUserWagers,
  getCurrentWager,
  getCurrentWagerStatus,
  joinWager,
  readyUpAPI,
  markWagerComplete,
  submitWagerResult,
  forceWin,
  resetToken,
  punishUser,
  sendChat,
  getChat,
  getAgreedCancelUsers,
  cancelWager,
  getFirstThreeWagers,
  getCurrentToken,
  acceptRematch,
};

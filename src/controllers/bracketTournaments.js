const {
  BracketTourneyData,
  TourneySchema,
  MatchData,
  RoundData,
} = require("../models/BracketTournament");
const { WagerObjectData } = require("../models/WagerObject");
const { WagerData } = require("../models/Wager");
const { UserData } = require("../models/User");
const { TeamData } = require("../models/Team");
const { bracket } = require("consolidate");
const {
  getUser,
  getUserIdFromToken,
  getUserToken,
  getUsernameFromToken,
  teamMinBal,
  teamCheckEpics,
} = require("../utils/helperMethods");
const { v4: uuidv4 } = require("uuid");
const hash = require("object-hash");
const {
  generateTournamentMatch,
} = require("../utils/bracketTournamentHelpers");
// const { TeamData } = require("../models/Team");
const NEW_UPDATE_BALANCE_EVENT = "updateBalance";
const NEW_BRACKET_UPDATE_EVENT = "newBracket";
const NEW_NOTIFICATION_EVENT = "newNotification";
const NEW_CURRENT_TOKEN_EVENT = "newCurrentToken";
const NEW_TOURNAMENT_CREATED_EVENT = "newTournament";
const NEW_TOURNAMENT_REMOVED_EVENT = "removedTournament";
const mongoose = require("mongoose");

const generateTournamentBracket = (numTeams) => {
  const numRounds = Math.log(numTeams) / Math.log(2);
  const matches = [];
  for (let i = 0; i < numRounds; i++) {
    matches.push([]);
  }

  let numTeamsPerRound = numTeams / 2;

  // loop through each round
  for (let i = 0; i < matches.length; i++) {
    // for each round loop through numTeamsPerRound and push in a new match object
    if (numTeamsPerRound > 0) {
      for (let j = 0; j < numTeamsPerRound; j++) {
        matches[i].push(
          new MatchData({
            redteamid: null,
            blueteamid: null,
            winner: -1,
            redteam_users: null,
            blueteam_users: null,
          })
        );
      }
      numTeamsPerRound = numTeamsPerRound / 2;
    }
  }
  const bracketObj = {
    num_rounds: numRounds,
    round: 0,
    matches,
  };

  return bracketObj;
};

const createBracketTournament = async (req, res, io) => {
  //state 0 = waiting to start tourney
  //state 1 = ongoing tournament
  //state 2 = finished tournament
  //state -1 = cancelled/something wrong
  try {
    const userToken = getUserToken(req);
    //const username = "arya";
    const username = await getUsernameFromToken(userToken);

    const userdata = await UserData.findOne({ username: username });
    if (!userdata) {
      return res.status(409).send({
        error: true,
        message: "Not great enough role to create tournament.",
      });
    }
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 502 && userdata.role != 69) {
      return res.status(409).send({
        error: true,
        message: "Not great enough role to create tournament.",
      });
    }

    const timeRemaining = (startDate) => {
      return new Date(startDate) - new Date();
    };
    // if (timeRemaining(req.body.start_date) < 600000) {
    //   return res.status(409).send({
    //     error: true,
    //     message: "You must create a tournament more than 10 minutes from now.",
    //   });
    // }

    if (
      !(
        req.body.start_date ||
        req.body.team_size ||
        req.body.game ||
        req.body.region ||
        req.body.num_teams ||
        req.body.prize ||
        req.body.num_winners ||
        req.body.admins ||
        req.body.format ||
        req.body.match_type ||
        req.body.first_to
      )
    ) {
      return res.status(409).send({
        error: true,
        message: "One of the required fields are missing.",
      });
    }

    if (req.body.entry_fee == 0 && req.body.prize >= 0) {
      if (userdata.balance >= req.body.prize) {
        userdata.balance -= req.body.prize;
        await userdata.save();
        io.in(userdata.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          userdata.balance.toString()
        );
      } else {
        return res.status(409).send({
          error: true,
          message: "You do not have enough tokens to fund this tournament.",
        });
      }
    }

    const bracket = generateTournamentBracket(req.body.num_teams);
    // const adminsForTourney = [];
    // const adminArray = req.body.admins.split(",");
    // console.log(adminArray);
    // for (let i = 0; i < adminArray.length; i++) {
    //   const adminData = await UserData.findOne({
    //     username: adminArray[i],
    //   });
    //   if (adminData && adminData.role >= 300) {
    //     let adminObj = {
    //       username: adminData.username,
    //       avatar: adminData.avatar,
    //     };
    //     adminsForTourney.push(adminObj);
    //   } else {
    //     return res.status(409).send({
    //       error: true,
    //       message: "One of these admins does not exist.",
    //     });
    //   }
    // }

    const newBracketTournament = new BracketTourneyData({
      start_date: new Date(req.body.start_date),
      team_size: req.body.team_size,
      game: req.body.game,
      region: req.body.region,
      teams: [],
      num_teams: req.body.num_teams,
      state: 0,
      match_type: req.body.match_type,
      first_to: req.body.first_to,
      bracket: bracket,
      title: req.body.title ?? null,
      description: req.body.description ?? null,
      prize:
        req.body.entry_fee > 0
          ? req.body.team_size * req.body.entry_fee * req.body.num_teams
          : req.body.prize,
      entry_fee: req.body.entry_fee ?? 0,
      paid_prizes: false,
      num_winners: req.body.num_winners,
      winners: [],
      admins: [],
      format: req.body.format,
      hosted_by: req.body.hosted_by == null ? "Tkns.GG" : userdata,
      rules: req.body.rules ?? null,
      thumbnail: req.body.thumbnail,
      prize_dist: [],
    });
    await newBracketTournament.save();

    // start tournament when the time remaining hits 0
    console.log(timeRemaining(newBracketTournament.start_date));
    setTimeout(
      () => startBracketTournament(newBracketTournament._id, io),
      timeRemaining(newBracketTournament.start_date)
    );

    return res
      .status(200)
      .send({ error: null, tournament: newBracketTournament });
  } catch (err) {
    console.log(err);
    return res.status(409).send({
      error: true,
      message: "Something went wrong in tournament creation.",
    });
  }
};

const joinBracketTournament = async (req, res, io) => {
  try {
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const tourneyId = req.body.tourneyId;
    const teamId = req.body.teamId;
    const puttingUp = req.body.puttingUp;
    console.log(username);

    if (!mongoose.Types.ObjectId.isValid(tourneyId))
      return res
        .status(409)
        .send({ error: true, message: "Invalid tournament." });

    if (!mongoose.Types.ObjectId.isValid(teamId))
      return res.status(409).send({ error: true, message: "Invalid team." });

    const teamData = await TeamData.findOne({ _id: teamId });
    const userData = await UserData.findOne({ username });

    if (!teamData || !userData) {
      return res.status(409).send({
        error: true,
        message: "You are attempting to join with a team you are no longer in.",
      });
    }
    if (!teamData.usernames.includes(username)) {
      return res.status(409).send({
        error: true,
        message: "You are attempting to join with a team you are no longer in.",
      });
    }
    const tourneyToJoin = await BracketTourneyData.findOne({ _id: tourneyId });

    if (!tourneyToJoin) {
      return res
        .status(409)
        .send({ error: true, message: "Tournament no longer exists." });
    }
    if (tourneyToJoin.state !== 0) {
      return res
        .status(409)
        .send({ error: true, message: "Tournament has already begun." });
    }

    if (tourneyToJoin.team_size !== teamData.usernames.length) {
      return res.status(409).send({
        error: true,
        message: "Team size is incorrect for this tournament.",
      });
    }
    if (tourneyToJoin.teams.length === tourneyToJoin.num_teams) {
      return res.status(409).send({
        error: true,
        message: "Tournament is full.",
      });
    }
    if (tourneyToJoin.teamIds.includes(teamData._id)) {
      return res.status(409).send({
        error: true,
        message: "This team is already registered for this tournament.",
      });
    }
    if (tourneyToJoin.game == "FN") {
      const epicsSet = await teamCheckEpics([...teamData?.usernames]);
      if (epicsSet == -1) {
        return res.status(409).send({
          error: true,
          message:
            "At least one of the team's members must submit their battletag on their profile.",
        });
      }
    }
    for (let i = 0; i < tourneyToJoin.teams.length; i++) {
      for (let j = 0; j < teamData.usernames.length; j++) {
        if (tourneyToJoin.teams[i].usernames.includes(teamData.usernames[j])) {
          return res.send({
            error: true,
            message:
              "At least one player on this team is already registered for this tournament.",
          });
        }
      }
    }
    //they dont have enough money
    if (tourneyToJoin.entry_fee > userData.balance) {
      return res.status(409).send({
        error: true,
        message:
          "You do not have enough tokens to enter this tournament. Get your bread up.",
      });
    }
    //random
    if (puttingUp === true || puttingUp === "true") {
      // check blue user balance
      const puttingUpMinBal = await teamMinBal([username], -1);
      if (
        tourneyToJoin.entry_fee * teamData.usernames.length >
        puttingUpMinBal
      ) {
        return res.send({
          error: true,
          message:
            "You do not have enough tokens to put up for your teammates.",
        });
      } else {
        userData.balance -= tourneyToJoin.entry_fee * teamData.usernames.length;
        await userData?.save();
        io.in(userData.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          userData.balance.toString()
        );
      }
    } else {
      // check all team balance
      const minBalance = await teamMinBal([...teamData.usernames], -1);
      if (tourneyToJoin.entry_fee > minBalance) {
        return res.send({
          error: true,
          message:
            "At least one member on your team does not have enough tokens to participate in the tournament.",
        });
      } else {
        for (let i = 0; i < teamData?.usernames?.length; i++) {
          const userdata = await UserData.findOne({
            username: teamData.usernames[i],
          });
          userdata.balance -= tourneyToJoin.entry_fee;
          let newNotification = {
            read: false,
            body: "You have registered for: " + tourneyToJoin.title,
            attached: tourneyToJoin._id,
            type: "new_register",
            actionable: false,
            timestamp: new Date(),
          };
          userdata.notifications.addToSet(newNotification);
          await userdata?.save();
          io.in(userdata.username).emit(
            NEW_NOTIFICATION_EVENT,
            newNotification
          );
          io.in(userdata.username).emit(
            NEW_UPDATE_BALANCE_EVENT,
            userdata.balance.toString()
          );
        }
      }
    }
    tourneyToJoin.teamIds.addToSet(teamData._id);
    tourneyToJoin.teams.addToSet(teamData);
    await tourneyToJoin.save();
    io.in(tourneyToJoin._id.toString()).emit(
      NEW_BRACKET_UPDATE_EVENT,
      tourneyToJoin
    );
    io.emit("newTournament", tourneyToJoin);
    //if tourney is full
    //start tourney on backend
    //but dont show front end until actual date
    return res.status(200).send({
      error: null,
      message: "Successfully registered for " + tourneyToJoin.title,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(503)
      .send({ error: true, message: "Could not join tournament!" });
  }
};

const shuffleTeams = (teams) => {
  let newArr = [...teams];
  for (let i = 0; i < newArr.length; i++) {
    let j = Math.floor(Math.random() * (i + 1));

    let temp = newArr[i];
    newArr[i] = newArr[j];
    newArr[j] = temp;
  }
  return newArr;
};

const generateMatch = async (teamCounter, matchCounter, teams, matches, io) => {
  try {
    if (
      teamCounter >= teams.length - 1 ||
      matchCounter.length >= matches.length
    )
      return;

    matches[matchCounter].blueteamid = teams[teamCounter];
    matches[matchCounter].redteamid = teams[teamCounter + 1];
    const blueteamdata = await TeamData.findOne({ _id: teams[teamCounter] });
    const redteamdata = await TeamData.findOne({ _id: teams[teamCounter + 1] });

    matches[matchCounter].blueteam_users = [];
    matches[matchCounter].redteam_users = [];

    for (let i = 0; i < blueteamdata.usernames.length; i++) {
      const blueuserdata = await UserData.findOne({
        username: blueteamdata.usernames[i],
      });
      const reduserdata = await UserData.findOne({
        username: redteamdata.usernames[i],
      });
      const blueUserObj = {
        username: blueuserdata.username,
        avatar: blueuserdata.avatar,
      };
      const redUserObj = {
        username: reduserdata.username,
        avatar: reduserdata.avatar,
      };

      matches[matchCounter].redteam_users.push(redUserObj);
      matches[matchCounter].blueteam_users.push(blueUserObj);
      // let newNotification = {
      //   read: false,
      //   body: "You are now in a new tournament match.",
      //   attached: matches[matchCounter]._id,
      //   type: "tourneyMatch",
      //   actionable: false,
      //   timestamp: new Date(),
      // };
      // blueuserdata.notifications.addToSet(newNotification);
      // reduserdata.notifications.addToSet(newNotification);
      // await blueuserdata.save();
      // await reduserdata.save();
      // io.in(blueuserdata.username).emit(
      //   NEW_NOTIFICATION_EVENT,
      //   newNotification
      // );
      // io.in(reduserdata.username).emit(NEW_NOTIFICATION_EVENT, newNotification);
    }
    let newTeamCounter = (teamCounter += 2);
    let newMatchCounter = (matchCounter += 1);
    generateMatch(newTeamCounter, newMatchCounter, teams, matches, io);
  } catch (err) {
    console.log(err);
    return;
  }
};

const generateRoundOne = (roundOneMatches, teams, io) => {
  generateMatch(0, 0, teams, roundOneMatches, io);
};

const cancelBracketTournamentEndpoint = async (req, res, io) => {
  try {
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);

    const userdata = await UserData.findOne({ username });
    if (!userdata) {
      return res
        .status(409)
        .send({ error: true, message: "User does not exist." });
    }
    if (userdata?.role < 502) {
      return res.status(409).send({
        error: true,
        message:
          "You do not have a high enough role to cancel this tournament.",
      });
    }

    const tourneyToJoin = await BracketTourneyData.findOne({
      _id: req.body.tourneyId,
    });
    tourneyToJoin.state = -1;
    const hostUser = await UserData.findOne({
      username: tourneyToJoin.hosted_by.username,
    });
    if (
      (tourneyToJoin.entry_fee == 0 || tourneyToJoin.entry_fee === null) &&
      tourneyToJoin.prize > 0
    ) {
      hostUser.balance += tourneyToJoin.prize;
      let newNotification = {
        read: false,
        body:
          tourneyToJoin.title +
          " was cancelled automatically. The prize you put up has been refunded.",
        attached: tourneyToJoin._id,
        type: "tourney",
        actionable: false,
        timestamp: new Date(),
      };
      hostUser.notifications.addToSet(newNotification);
      await hostUser.save();
      io.in(hostUser.username).emit(
        NEW_UPDATE_BALANCE_EVENT,
        hostUser.balance.toString()
      );
      io.in(hostUser.username).emit(NEW_NOTIFICATION_EVENT, newNotification);
    }
    for (let i = 0; i < tourneyToJoin.teams.length; i++) {
      for (let j = 0; j < tourneyToJoin.teams[i].usernames.length; j++) {
        const userToRefund = await UserData.findOne({
          username: tourneyToJoin.teams[i].usernames[j],
        });
        userToRefund.balance += tourneyToJoin.entry_fee;
        let newNotification = {
          read: false,
          body:
            tourneyToJoin.title +
            " was cancelled. Any entry fees involved were refunded.",
          attached: tourneyToJoin._id,
          type: "tourney",
          actionable: false,
          timestamp: new Date(),
        };
        userToRefund.notifications.addToSet(newNotification);
        await userToRefund.save();
        io.in(userToRefund.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          userToRefund.balance.toString()
        );
        io.in(userToRefund.username).emit(
          NEW_NOTIFICATION_EVENT,
          newNotification
        );
      }
    }
    for (let i = 0; i < tourneyToJoin.teamIds.length; i++) {
      const teams = await TeamData.findOne({ _id: tourneyToJoin.teamIds[i] });
      teams.in_wager = false;
      teams.wager_id = "";
      await teams?.save();
    }

    await tourneyToJoin?.save();
    io.emit("removeTournament", tourneyToJoin._id);
    io.in(tourneyToJoin._id.toString()).emit(
      NEW_BRACKET_UPDATE_EVENT,
      tourneyToJoin
    );
    return res
      .status(200)
      .send({ error: null, message: "Tournament Canceled!" });
  } catch (err) {
    console.log(err);
    return res
      .status(503)
      .send({ error: true, message: "Could not cancel tournament" });
  }
};

const cancelBracketTournament = async (tourneyId, io) => {
  try {
    // const tourneyId = req.body.tourneyId;
    const tourneyToJoin = await BracketTourneyData.findOne({ _id: tourneyId });
    tourneyToJoin.state = -1;
    const hostUser = await UserData.findOne({
      username: tourneyToJoin.hosted_by.username,
    });
    if (
      (tourneyToJoin.entry_fee == 0 || tourneyToJoin.entry_fee === null) &&
      tourneyToJoin.prize > 0
    ) {
      hostUser.balance += tourneyToJoin.prize;
      let newNotification = {
        read: false,
        body:
          tourneyToJoin.title +
          " was cancelled automatically. The prize you put up has been refunded.",
        attached: tourneyToJoin._id,
        type: "tourney",
        actionable: false,
        timestamp: new Date(),
      };
      hostUser.notifications.addToSet(newNotification);
      await hostUser.save();
      io.in(hostUser.username).emit(
        NEW_UPDATE_BALANCE_EVENT,
        hostUser.balance.toString()
      );
      io.in(hostUser.username).emit(NEW_NOTIFICATION_EVENT, newNotification);
    }
    for (let i = 0; i < tourneyToJoin.teams.length; i++) {
      for (let j = 0; j < tourneyToJoin.teams[i].usernames.length; j++) {
        const userToRefund = await UserData.findOne({
          username: tourneyToJoin.teams[i].usernames[j],
        });
        userToRefund.balance += tourneyToJoin.entry_fee;
        let newNotification = {
          read: false,
          body:
            tourneyToJoin.title +
            " was cancelled. Any entry fees involved were refunded.",
          attached: tourneyToJoin._id,
          type: "tourney",
          actionable: false,
          timestamp: new Date(),
        };
        userToRefund.notifications.addToSet(newNotification);
        await userToRefund.save();
        io.in(userToRefund.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          userToRefund.balance.toString()
        );
        io.in(userToRefund.username).emit(
          NEW_NOTIFICATION_EVENT,
          newNotification
        );
      }
    }
    for (let i = 0; i < tourneyToJoin.teamIds.length; i++) {
      const teams = await TeamData.findOne({ _id: tourneyToJoin.teamIds[i] });
      teams.in_wager = false;
      teams.wager_id = "";
      await teams?.save();
    }

    await tourneyToJoin?.save();
    io.emit("removeTournament", tourneyToJoin._id);
    return;
  } catch (err) {
    console.log(err);
    return;
  }
};

const startBracketTournamentManually = async (req, res, io) => {
  try {
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const userdata = await UserData.findOne({ username });

    if (!userdata) {
      return res
        .status(409)
        .send({ error: true, message: "User does not exist." });
    }

    if (userdata.role < 500) {
      return res.status(409).send({
        error: true,
        message: "You do not have a high enough role to start this tournament.",
      });
    }

    const tourneyId = req.body.tourneyId;
    const tourneyToJoin = await BracketTourneyData.findOne({ _id: tourneyId });

    if (!tourneyToJoin) {
      return res
        .status(409)
        .send({ error: true, message: "Tournament does not exist." });
    }
    if (tourneyToJoin.teams.length !== tourneyToJoin.num_teams) {
      cancelBracketTournament(tourneyToJoin._id, io);
      return res
        .status(409)
        .send({ error: true, message: "Not enough teams to start." });
    }

    if (tourneyToJoin.state !== 0) {
      return res.status(409).send({
        error: true,
        message: "Tournament is not in the waiting state.",
      });
    }

    for (let i = 0; i < tourneyToJoin.teamIds.length; i++) {
      const teams = await TeamData.findOne({ _id: tourneyToJoin.teamIds[i] });
      teams.in_wager = true;
      await teams.save();
      // return res.status(200).send({ error: null, teams: teams });
    }

    generateRoundOne(
      tourneyToJoin.bracket.matches[0],
      shuffleTeams(tourneyToJoin.teamIds),
      io
    );
    await tourneyToJoin?.save();
    const roundOne = tourneyToJoin.bracket.matches[0];
    for (let i = 0; i < roundOne.length; i++) {
      const match = roundOne[i];
      const redteam_users = await TeamData.findOne({ _id: match.redteamid });
      const blueteam_users = await TeamData.findOne({ _id: match.blueteamid });
      if (redteam_users && blueteam_users) {
        const id = await generateTournamentMatch(
          match.blueteamid,
          match.redteamid,
          blueteam_users.usernames,
          redteam_users.usernames,
          tourneyToJoin,
          match,
          io
        );
        const allUsers = redteam_users.usernames.concat(
          blueteam_users.usernames
        );
        allUsers.forEach((user) => {
          io.in(user).emit(NEW_CURRENT_TOKEN_EVENT, id);
        });
      }
    }

    tourneyToJoin.bracket.round = 1;
    //playing state tourney
    tourneyToJoin.state = 1;
    await tourneyToJoin.save();
    io.in(tourneyToJoin._id.toString()).emit(
      NEW_BRACKET_UPDATE_EVENT,
      tourneyToJoin
    );
    res
      .status(200)
      .send({ error: null, message: "Successfully started tournament." });
  } catch (err) {
    console.log(err);
    res
      .status(503)
      .send({ error: true, message: "Could not start tournament." });
  }
};

const startBracketTournament = async (tourneyId, io) => {
  try {
    const tourneyToJoin = await BracketTourneyData.findOne({ _id: tourneyId });

    if (!tourneyToJoin) {
      return;
    }
    if (tourneyToJoin.teams.length !== tourneyToJoin.num_teams) {
      cancelBracketTournament(tourneyToJoin._id, io);
      return;
    }

    if (tourneyToJoin.state !== 0) {
      return;
    }

    if (new Date(tourneyToJoin.start_date) > new Date()) {
      return;
    }

    for (let i = 0; i < tourneyToJoin.teamIds.length; i++) {
      const teams = await TeamData.findOne({ _id: tourneyToJoin.teamIds[i] });
      teams.in_wager = true;
      await teams.save();
      // return res.status(200).send({ error: null, teams: teams });
    }

    generateRoundOne(
      tourneyToJoin.bracket.matches[0],
      shuffleTeams(tourneyToJoin.teamIds),
      io
    );
    await tourneyToJoin?.save();
    const roundOne = tourneyToJoin.bracket.matches[0];
    for (let i = 0; i < roundOne.length; i++) {
      const match = roundOne[i];
      const redteam_users = await TeamData.findOne({ _id: match.redteamid });
      const blueteam_users = await TeamData.findOne({ _id: match.blueteamid });
      if (redteam_users && blueteam_users) {
        const id = await generateTournamentMatch(
          match.blueteamid,
          match.redteamid,
          blueteam_users.usernames,
          redteam_users.usernames,
          tourneyToJoin,
          match,
          io
        );
        const allUsers = redteam_users.usernames.concat(
          blueteam_users.usernames
        );
        allUsers.forEach((user) => {
          io.in(user).emit(NEW_CURRENT_TOKEN_EVENT, id);
        });
      }
    }

    tourneyToJoin.bracket.round = 1;
    //playing state tourney
    tourneyToJoin.state = 1;
    await tourneyToJoin.save();
    io.in(tourneyToJoin._id.toString()).emit(
      NEW_BRACKET_UPDATE_EVENT,
      tourneyToJoin
    );
    return;
  } catch (err) {
    console.log(err);
    return;
  }
};

const getAllBracketTournaments = async (req, res) => {
  try {
    const tourneys = await BracketTourneyData.find({ state: [0, 1, 2] });
    if (tourneys) {
      return res.status(200).send({ error: false, tourneys: tourneys });
    } else {
      return res.status(200).send({
        error: false,
        message: "No tournaments are currently available to join.",
      });
    }
  } catch (err) {
    console.log(err);
    return;
  }
};

const getTournament = async (req, res) => {
  try {
    const tourney = await BracketTourneyData.findOne({
      _id: req.params.id,
    });
    if (tourney) {
      return res.status(200).send({ error: false, tourney: tourney });
    } else {
      return res.status(409).send({
        error: true,
        message: "No information for this tournament.",
      });
    }
  } catch (err) {
    console.log(err);
    return;
  }
};

const getListOfAdmins = async (req, res) => {
  const admins = await UserData.find({ role: 300 });
  const adminArray = [];
  if (admins) {
    for (let i = 0; i < admins.length; i++) {
      const adminUsernames = {
        username: admins[i].username,
        avatar: admins[i].avatar,
      };
      adminArray.push(adminUsernames);
    }
    return res.status(200).send({ error: false, admins: adminArray });
  } else {
    return res
      .status(409)
      .send({ error: true, message: "No admins available." });
  }
};

const deleteBracketTournament = async (req, res, io) => {
  try {
    const tourneyId = req.body.tourneyId;
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const userdata = await UserData.findOne({ username });

    if (!userdata) {
      return res
        .status(409)
        .send({ error: true, message: "Could not find user." });
    }
    if (userdata?.role < 501) {
      return res.status(409).send({
        error: true,
        message: "You do not have a high enough role to take this action.",
      });
    }

    const tourneyData = await BracketTourneyData.findOne({ _id: tourneyId });
    await tourneyData.remove();
    return res
      .status(200)
      .send({ error: null, message: "Successfully deleted tournament!" });
  } catch (err) {
    console.log(err);
    return res
      .status(503)
      .send({ error: true, message: "Could not delete tournament." });
  }
};

const kickTeamFromTournament = async (req, res, io) => {
  try {
    const teamId = req.body.teamId;
    const tourneyId = req.body.tourneyId;
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const userdata = await UserData.findOne({ username });

    if (!userdata) {
      return res
        .status(409)
        .send({ error: true, message: "Could not find user." });
    }
    if (userdata?.role < 501) {
      return res.status(409).send({
        error: true,
        message: "You do not have a high enough role to take this action.",
      });
    }

    const teamData = await TeamData.findOne({ _id: teamId });
    const tourneyData = await BracketTourneyData.findOne({ _id: tourneyId });

    if (tourneyData?.state !== 0) {
      return res.status(409).send({
        error: true,
        message:
          "Cannot kick a team when the tournament is ongoing or completed.",
      });
    }

    const newTourneyDataTeamIds = tourneyData?.teamIds?.filter(
      (team) => team.toString() !== teamId.toString()
    );
    const newTourneyDataTeams = tourneyData?.teams?.filter(
      (team) => team?._id.toString() !== teamId.toString()
    );
    tourneyData.teamIds = newTourneyDataTeamIds;
    tourneyData.teams = newTourneyDataTeams;

    if (tourneyData.entry_fee > 0) {
      for (let i = 0; i < teamData.usernames.length; i++) {
        const userdata = await UserData.findOne({
          username: teamData.usernames[i],
        });

        userdata.balance += tourneyData.entry_fee;
        await userdata.save();
        io.in(userdata.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          userdata.balance.toString()
        );
      }
    }
    await tourneyData.save();
    io.in(tourneyData._id.toString()).emit(
      NEW_BRACKET_UPDATE_EVENT,
      tourneyData
    );
    io.emit("newTournament", tourneyData);
    return res.status(200).send({
      error: null,
      message: `Successfully kicked ${teamData?.name} from ${tourneyData?.title}.`,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(503)
      .send({ error: true, message: "Could not kick team" });
  }
};

const leaveTournament = async (req, res, io) => {
  try {
    const teamId = req.body.teamId;
    const tourneyId = req.body.tourneyId;
    const userToken = getUserToken(req);
    //const username = "arya";
    const username = await getUsernameFromToken(userToken);

    const teamData = await TeamData.findOne({ _id: teamId });
    const tourneyData = await BracketTourneyData.findOne({ _id: tourneyId });
    if (!teamData.usernames.includes(username)) {
      return res.status(409).send({
        error: true,
        message: "You are trying to leave for a team you are not in.",
      });
    }

    const newTourneyDataTeamIds = tourneyData?.teamIds?.filter(
      (team) => team.toString() !== teamId.toString()
    );
    const newTourneyDataTeams = tourneyData?.teams?.filter(
      (team) => team?._id.toString() !== teamId.toString()
    );
    tourneyData.teamIds = newTourneyDataTeamIds;
    tourneyData.teams = newTourneyDataTeams;

    if (tourneyData.entry_fee > 0) {
      for (let i = 0; i < teamData.usernames.length; i++) {
        const userdata = await UserData.findOne({
          username: teamData.usernames[i],
        });

        userdata.balance += tourneyData.entry_fee;
        await userdata.save();
        io.in(userdata.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          userdata.balance.toString()
        );
      }
    }
    await tourneyData.save();
    io.in(tourneyData._id.toString()).emit(
      NEW_BRACKET_UPDATE_EVENT,
      tourneyData
    );
    io.emit("newTournament", tourneyData);
    return res
      .status(200)
      .send({ error: null, message: "Successfully left tournament." });
  } catch (err) {
    console.log(err);
    return res
      .status(409)
      .send({ error: true, message: "Error leaving tournament." });
  }
};
const getTournaments = async (req, res) => {
  const state = parseInt(req.params.state) ?? null;
  const game = req.params.game ?? null;
  const region = req.params.region ?? null;
  const bracketTourneyObj = {
    state: { $not: { $ne: -1 } },
  };
  let filterObj = {};

  if (game != null && game != "null") {
    filterObj.game = game;
  }
  if (state != null && state != "null") {
    filterObj.state = state;
  }
  if (region != null && region != "null") {
    filterObj.region = region;
  }
  // console.log(activetourneys);
  if (
    region != null &&
    region != "null" &&
    game != null &&
    game != "null" &&
    state != null &&
    state != "null"
  ) {
    return res.status(200).json({ error: null, tourneys: [] });
  }

  const tourneys = await BracketTourneyData.find(
    filterObj,
    "state entry_fee prize title start_date thumbnail game hosted_by.username region teamIds num_teams team_size num_winners"
  );
  return res.status(200).json({ error: null, tourneys: tourneys });
};

module.exports = {
  createBracketTournament,
  generateTournamentBracket,
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
};

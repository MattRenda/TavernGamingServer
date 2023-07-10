const { getNotificationsByName } = require("../controllers/notifications");
const { TeamData } = require("../models/Team");
const { UserTeamNotificationsModel } = require("../models/NewNotifications");
const { WagerData } = require("../models/Wager");
const { ProfitData } = require("../models/Profit");
const { EarningsData } = require("../models/Earnings");
const { ActiveWagerData } = require("../models/ActiveWagers");
const { WagerDataV2 } = require("../models/WagerDataV2");
const { NoteData } = require("../models/NoteData");
const { NewNotificationData } = require("../models/NewNotifications");
const { WagerObjectData } = require("../models/WagerObject");
const { UserData } = require("../models/User");
const {
  getUserByName,
  getWagerObject,
  readyUpHelper,
  team_leave_wager,
  submit,
  getUser,
  cancel,
  resetWagerBalance,
  getTeam,
  win,
  getTokenObject,
  gameMessage,
  bracketTournamentWin,
} = require("./helperMethods");
const hash = require("object-hash");
const { markWagerComplete } = require("../controllers/wagers");
const e = require("express");
const _ = require("passport-local-mongoose");

const socketEvents = {
  NEW_CHAT_EVENT: "newChatMessage",
  NEW_GAME_MESSAGE_EVENT: "gameMessage",
  NEW_NOTIFICATION_EVENT: "newNotification",
  NEW_READY_EVENT: "newReady",
  NEW_JOIN_EVENT: "newJoin",
  NEW_SUBMIT_EVENT: "newSubmit",
  NEW_CANCEL_EVENT: "newCancel",
  NEW_RESET_EVENT: "newReset",
  NEW_FORCE_EVENT: "newForce",
  NEW_TIMER_EXPIRED_READY_EVENT: "timerExpiredReadyEvent",
  NEW_TEMP_EPIC_EVENT: "newTempEpic",
  NEW_EPIC_VERIFIED_EVENT: "newEpic",
  NEW_AGREE_CANCEL_EVENT: "newAgree",
  NEW_DECLINE_CANCEL_EVENT: "newDecline",
  NEW_ACTIVE_TOKEN: "newActiveToken",
  REMOVE_ACTIVE_TOKEN: "removeActiveToken",
  NEW_REMOVE_VOTE_CANCEL_EVENT: "removeVote",
  NEW_UPDATE_BALANCE_EVENT: "updateBalance",
  NEW_CURRENT_TOKEN_EVENT: "newCurrentToken",
  NEW_REMOVE_CURRENT_TOKEN_EVENT: "newRemoveCurrentToken",
  NEW_USER_AVATAR_EVENT: "newAvatar",
  NEW_REMATCH_INVITE_EVENT: "newRematch",
  NEW_BRACKET_UPDATE_EVENT: "newBracket",
  NEW_TOURNAMENT_CREATED_EVENT: "newTournament",
  NEW_TOURNAMENT_REMOVED_EVENT: "removeTournament",
  NEW_BRACKET_WIN_EVENT: "newBracketWin",
};

const {
  NEW_CHAT_EVENT,
  NEW_GAME_MESSAGE_EVENT,
  NEW_NOTIFICATION_EVENT,
  NEW_READY_EVENT,
  NEW_JOIN_EVENT,
  NEW_SUBMIT_EVENT,
  NEW_CANCEL_EVENT,
  NEW_RESET_EVENT,
  NEW_FORCE_EVENT,
  NEW_TIMER_EXPIRED_READY_EVENT,
  NEW_TEMP_EPIC_EVENT,
  NEW_EPIC_VERIFIED_EVENT,
  NEW_AGREE_CANCEL_EVENT,
  NEW_DECLINE_CANCEL_EVENT,
  NEW_REMOVE_VOTE_CANCEL_EVENT,
  NEW_UPDATE_BALANCE_EVENT,
  NEW_CURRENT_TOKEN_EVENT,
  NEW_REMOVE_CURRENT_TOKEN_EVENT,
  NEW_USER_AVATAR_EVENT,
  NEW_REMATCH_INVITE_EVENT,
  NEW_BRACKET_UPDATE_EVENT,
  NEW_TOURNAMENT_CREATED_EVENT,
  NEW_TOURNAMENT_REMOVED_EVENT,
  NEW_BRACKET_WIN_EVENT,
} = socketEvents;

// send invite to user to join team
const sendTeamInvite = async (io, notification) => {
  const username = notification?.user;
  const userToInvite = notification?.userToInv;
  const teamId = notification?.teamId;
  const name = notification?.name;

  if (!username || !userToInvite || !teamId) {
    // console.log("returning");
    return res
      .status(409)
      .send({ error: true, message: "Team no longer exists." });
  }

  try {
    const data = await TeamData.findOne({ _id: teamId });

    if (!data?.usernames?.includes(username)) {
      // console.log("could not find user");
      return;
    } else if (data?.usernames?.length >= 4) {
      // console.log("too many team members");
      return;
    }

    if (data?.usernames?.includes(userToInvite)) {
      // console.log("user already on the team");
      return;
    }

    const userdata = await UserData.findOne({ username: userToInvite });
    const useravdata = await UserData.findOne({ username: username });
    if (!userdata) {
      // console.log("could not find user to invite");
      return;
    }

    let newNotification = {
      read: false,
      body: username + " sent you a team invite to " + name,
      attached: teamId,
      type: "invite",
      actionable: true,
      timestamp: Date.now(),
      avatar: useravdata.avatar[0],
    };
    // console.log(userdata.notifications.toString());

    if (!userdata.notifications.toString().includes(newNotification.attached)) {
      // console.log("noti doesnt exist");
      userdata.notifications.addToSet(newNotification);
      await userdata.save();
      io.in(userToInvite).emit(NEW_NOTIFICATION_EVENT, newNotification);
      io.in(userToInvite).emit(NEW_USER_AVATAR_EVENT, userdata.avatar);
      return;
    } else {
      console.log("noti already exists");
      return;
    }
  } catch (err) {
    console.log("Team invite catch");
    if (err) return;
  }
};

const cancelSocketHelper = async (wagerObj, callback) => {
  if (!wagerObj) {
    return;
  }
  if (wagerObj.state == 3) {
    const newToken = await getTokenObject(wagerObj.wagerid);
    callback(newToken);
    return;
  }
  try {
    wagerObj.state = wagerObj?.CANCEL_STATE;
    await wagerObj?.save();
    const allUsers = [];
    const data = await WagerData.findOne({ _id: wagerObj?.wagerid });
    const start = Date.now();
    for (let i = 0; i < data?.blueteam_users.length; i++) {
      allUsers.push(data?.blueteam_users[i].toString());
      if (data?.redteam_users.length !== 0) {
        allUsers.push(data?.redteam_users[i].toString());
      }
    }
    // console.log(allUsers);
    for (let i = 0; i < allUsers.length; i++) {
      const allUserData = await UserData.findOne({
        username: allUsers[i].toString(),
      });
      const last_match_history = allUserData.match_history.find(
        (match) =>
          match.wager_id == "https://www.taverngaming.com/token/" + data._id.toString()
      );
      if (last_match_history) {
        const index = allUserData.match_history.indexOf(last_match_history);
        allUserData.match_history[index].status = "CANCEL";
        await allUserData?.save();
      }
    }

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
    await data?.save();

    team_leave_wager(wagerObj?.blueteamid);
    if (wagerObj?.redteamid) {
      team_leave_wager(wagerObj?.redteamid);
    }

    const activewagerdata = await ActiveWagerData.findOne({
      wagerid: wagerObj.wagerid,
    });
    if (activewagerdata) {
      await activewagerdata.remove();
    }
    const newToken = await getTokenObject(wagerObj.wagerid);
    callback(newToken);
    return;
  } catch (err) {
    if (err) {
      console.log(err);
      return;
    }
  }
};

// mark wager complete
const markWagerCompleteSocketHelper = (wagerId, callback) => {
  // console.log("wager marked done in socket helper");
  getWagerObject(wagerId, (data) => {
    team_leave_wager(data?.blueteamid);
    if (data?.redteamid) {
      team_leave_wager(data?.redteamid);
    }

    WagerData.findOne({ _id: wagerId }, (err, wagerdata) => {
      if (err) {
        return;
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
      wagerdata?.save();

      // send back updated data
      callback(data);
    });
  });
};

// reset token helper
const resetTokenSocketHelper = async (wagerId, io, callback) => {
  console.log("resetting line 199");
  try {
    const newwagerdata = await WagerDataV2.findOne({ wagerid: wagerId });
    const wagerdata = await WagerObjectData.findOne({ wagerid: wagerId });
    if (!wagerdata) {
      return;
    }

    const wager = await WagerData.findOne({ _id: wagerId });

    if (wager?.red_users?.length < 1) {
      return;
    }
    let earnings = 0;
    let multiplier = 0;
    if (wager.game == "FIVEM") {
      earnings = wager.entry_fee * 0.9;
      multiplier = 0.95;
    } else {
      earnings = wager.entry_fee * 0.8;
      multiplier = 0.9;
    }

    wager.done = false;
    wager.cancelled = false;
    wagerdata.timer = 0;
    wagerdata.redsubmit = -1;
    wagerdata.bluesubmit = -1;

    if (wager?.paid_prizes) {
      if (wagerdata?.winner == 1) {
        // if blue is winner and blue put up
        if (
          newwagerdata &&
          newwagerdata?.userThatPutUpBlue !== "" &&
          newwagerdata?.userThatPutUpBlue != null
        ) {
          console.log("resetting blue put up");
          const blueputupdata = await UserData.findOne({
            username: newwagerdata?.userThatPutUpBlue,
          });
          blueputupdata.balance -=
            wager?.entry_fee * 2 * wager?.blueteam_users?.length * multiplier;
          console.log(blueputupdata.balance);
          await blueputupdata?.save();
          // console.log(wager.match_type);
          io.in(blueputupdata.username).emit(
            NEW_UPDATE_BALANCE_EVENT,
            blueputupdata.balance.toString()
          );

          EarningsData.findOne(
            { username: blueputupdata.username },
            (err, earningsData) => {
              if (!earningsData) {
                console.log("No earnings lol");
                return;
              }
              const match_type = wager.match_type;
              if (err) {
                return;
              } else {
                switch (match_type) {
                  case "ZW":
                    earningsData.ZW -= earnings;
                    break;

                  case "BOX":
                    earningsData.BF -= earnings;
                    break;

                  case "REAL":
                    earningsData.REAL -= earnings;
                    break;
                  case "PG":
                    earningsData.PG -= earnings;
                    break;
                  case "END":
                    earningsData.END -= earnings;
                    break;

                  default:
                    break;
                }
                switch (wager.game) {
                  case "FIVEM":
                    earningsData.FIVEM -= earnings;
                    break;
                  default:
                    break;
                }
                earningsData.total -= earnings;
                earningsData.save({}, (err, data) => {
                  if (err) {
                    console.log(
                      "Error with earnings for user: " + blueputupdata.username
                    );
                    return;
                  }
                });
              }
            }
          );
        } else {
          for (let i = 0; i < wager?.blueteam_users?.length; i++) {
            const name = wager?.blueteam_users[i];
            const userdata = await UserData.findOne({ username: name });
            userdata.balance -= wager?.entry_fee * 2 * multiplier;
            await userdata?.save();
            io.in(userdata.username).emit(
              NEW_UPDATE_BALANCE_EVENT,
              userdata.balance.toString()
            );

            EarningsData.findOne(
              { username: userdata.username },
              (err, earningsData) => {
                if (!earningsData) {
                  console.log("No earnings lol");
                  return;
                }
                const match_type = wager.match_type;
                if (err) {
                  return;
                } else {
                  switch (match_type) {
                    case "ZW":
                      earningsData.ZW -= earnings;
                      break;

                    case "BOX":
                      earningsData.BF -= earnings;
                      break;

                    case "REAL":
                      earningsData.REAL -= earnings;
                      break;
                    case "PG":
                      earningsData.PG -= earnings;
                      break;
                    case "END":
                      earningsData.END -= earnings;
                      break;

                    default:
                      break;
                  }
                  switch (wager.game) {
                    case "FIVEM":
                      earningsData.FIVEM -= earnings;
                      break;
                    default:
                      break;
                  }
                  earningsData.total -= earnings;
                  earningsData.save({}, (err, data) => {
                    if (err) {
                      console.log(
                        "Error with earnings for user: " + userdata.username
                      );
                      return;
                    }
                  });
                }
              }
            );
          }
        }
      } else if (wagerdata?.winner == 2) {
        // if red is winner and red put up
        if (
          newwagerdata &&
          newwagerdata?.userThatPutUpRed !== "" &&
          newwagerdata?.userThatPutUpRed != null
        ) {
          console.log("resetting red put up");
          const redputupdata = await UserData.findOne({
            username: newwagerdata?.userThatPutUpRed,
          });
          redputupdata.balance -=
            wager?.entry_fee * 2 * wager?.redteam_users?.length * multiplier;
          await redputupdata?.save();
          io.in(redputupdata.username).emit(
            NEW_UPDATE_BALANCE_EVENT,
            redputupdata.balance.toString()
          );

          EarningsData.findOne(
            { username: redputupdata.username },
            (err, earningsData) => {
              if (!earningsData) {
                return;
              }
              const match_type = wager.match_type;
              if (err) {
                return;
              } else {
                switch (match_type) {
                  case "ZW":
                    earningsData.ZW -= earnings;
                    break;

                  case "BOX":
                    earningsData.BF -= earnings;
                    break;

                  case "REAL":
                    earningsData.REAL -= earnings;
                    break;
                  case "PG":
                    earningsData.PG -= earnings;
                    break;
                  case "END":
                    earningsData.END -= earnings;
                    break;

                  default:
                    break;
                }
                switch (wager.game) {
                  case "FIVEM":
                    earningsData.FIVEM -= earnings;
                    break;
                  default:
                    break;
                }
                earningsData.total -= earnings;
                earningsData.save({}, (err, data) => {
                  if (err) {
                    console.log(
                      "Error with earnings for user: " + redputupdata.username
                    );
                    return;
                  }
                });
              }
            }
          );
        } else {
          for (let i = 0; i < wager?.redteam_users?.length; i++) {
            const name = wager?.redteam_users[i];
            const userdata = await UserData.findOne({ username: name });
            userdata.balance -= wager?.entry_fee * 2 * multiplier;
            await userdata?.save();

            io.in(userdata.username).emit(
              NEW_UPDATE_BALANCE_EVENT,
              userdata?.balance.toString()
            );

            EarningsData.findOne(
              { username: userdata.username },
              (err, earningsData) => {
                if (!earningsData) {
                  return;
                }
                const match_type = wager.match_type;
                if (err) {
                  return;
                } else {
                  switch (match_type) {
                    case "ZW":
                      earningsData.ZW -= earnings;
                      break;

                    case "BOX":
                      earningsData.BF -= earnings;
                      break;

                    case "REAL":
                      earningsData.REAL -= earnings;
                      break;
                    case "PG":
                      earningsData.PG -= earnings;
                      break;
                    case "END":
                      earningsData.END -= earnings;
                      break;

                    default:
                      break;
                  }
                  switch (wager.game) {
                    case "FIVEM":
                      earningsData.FIVEM -= earnings;
                      break;
                    default:
                      break;
                  }
                  earningsData.total -= earnings;
                  earningsData.save({}, (err, data) => {
                    if (err) {
                      console.log(
                        "Error with earnings for user: " + userdata.username
                      );
                      return;
                    }
                  });
                }
              }
            );
          }
        }
      }
    }

    // set blue team in wager
    getTeam(wagerdata?.blueteamid, (blueTeamData) => {
      blueTeamData.in_wager = true;
      blueTeamData.wager_id = wagerId;
      blueTeamData.save();
    });

    // set red team in wager
    getTeam(wagerdata?.redteamid, (redTeamData) => {
      redTeamData.in_wager = true;
      redTeamData.wager_id = wagerId;
      redTeamData.save();
    });

    wager.paid_prizes = false;

    wager?.save();
    wagerdata.bluesubmit = -1;
    wagerdata.redsubmit = -1;
    wagerdata.single_sub = -1;
    wagerdata.winner = -1;

    wagerdata.state = wagerdata?.PLAYING_STATE;

    await wagerdata?.save();
    const token = await getTokenObject(wager?._id);
    return callback(token);
    return;
  } catch (err) {
    console.log(err);
    if (err) return;
  }
};

const tokenEventHelper = async (io, eventData, eventType) => {
  if (!io || !eventData || !eventType) {
    // console.log("no io, eventdata or eventtype!");
    return;
  }
  const { wagerId, username } = eventData;
  if (!wagerId || !username) {
    // console.log("no wager id or username");
    return;
  }

  const wagerdata = await getTokenObject(wagerId);
  if (!wagerdata) {
    return;
  }
  io.in(wagerId).emit(eventType, wagerdata);
  return;
};

// send a ready event to the client
const sendReadyEvent = async (io, readyEventData) => {
  const { wagerId, username } = readyEventData;
  if (!wagerId || !username) {
    // console.log("no wager id or username for ready data");
    return;
  }

  const wagerdata = await WagerObjectData.findOne({ wagerid: wagerId });
  const readied = await readyUpHelper(wagerdata, username, io);

  // console.log(readied);
  if (!readied) return;

  const newtokendata = await getTokenObject(wagerId);
  io.in(wagerId).emit(NEW_READY_EVENT, newtokendata);
};

// send a join event to the client
const sendJoinEvent = (io, joinEventData) => {
  tokenEventHelper(io, joinEventData, NEW_JOIN_EVENT);
};

// send a submit event to client
const sendSubmitEvent = (io, submitEventData) => {
  // //   tokenEventHelper(io, submitEventData, NEW_SUBMIT_EVENT);
  // const { status, wagerId, username } = submitEventData;
  // // status wagerId username
  // if (!wagerId || !username) {
  //   // console.log("wagerId or username not found in submit event");
  //   return;
  // }
  // getWagerObject(wagerId, (wagerdata) => {
  //   // callback returns new wager data and status results
  //   submit(wagerdata, username, status, (newWagerData, results) => {
  //     if (results === 1) {
  //       team_leave_wager(wagerdata.redteamid);
  //       team_leave_wager(wagerdata.blueteamid);
  //       // send back wagerdata
  //       io.in(wagerId).emit(NEW_SUBMIT_EVENT, newWagerData);
  //       return;
  //     } else if (results === 2) {
  //       markWagerComplete(wagerId);
  //       io.in(wagerId).emit(NEW_SUBMIT_EVENT, newWagerData);
  //       return;
  //     } else {
  //       // if not 1 or 2 then there was an error and just return
  //       return;
  //     }
  //   });
  //   // // console.log(results);
  // });
};

// send a cancel event to the client
const sendCancelEvent = (io, cancelEventData) => {
  // console.log("calling cancel here");
  // const { username, wagerId } = cancelEventData;
  // console.log(username + "  has cancelled " + wagerId);
  // if (!username || !wagerId) {
  //   // console.log("no wagerid or username in cancel data");
  //   return;
  // }
  // ProfitData.findOne({ wagerId: wagerId }, (err, profitData) => {
  //   if (err) {
  //     return;
  //   } else if (profitData) {
  //     profitData.remove({ wagerId: wagerId });
  //     //profitData.save();
  //     return;
  //   } else {
  //     // console.log("Profit has not been paid out for this token.");
  //     return;
  //   }
  // });
  // getUser(username, (userdata) => {
  //   getWagerObject(wagerId, (wagerdata) => {
  //     if (userdata?.role <= 100) {
  //       if (
  //         !(
  //           wagerdata?.blue_users?.includes(username) ||
  //           wagerdata?.red_users?.includes(username)
  //         )
  //       ) {
  //         // user not in this wager
  //         return;
  //       }
  //       return;
  //     }
  //     if (wagerdata?.state === wagerdata?.JOIN_STATE || userdata?.role > 100) {
  //       // console.log("canceling wager");
  //       cancelSocketHelper(wagerdata, (newwager) => {
  //         // THE RIGHT ONE
  //         resetWagerBalance(wagerId);
  //         io.in(wagerId).emit(NEW_CANCEL_EVENT, newwager);
  //         return;
  //       });
  //       return;
  //     }
  //   });
  // });
};

const sendResetEvent = (io, resetEventData) => {
  const { wagerId, username } = resetEventData;

  if (!wagerId || !username) {
    // console.log("no wager id or username in reset data");
    return;
  }

  getUser(username, (userdata) => {
    if (userdata?.role < 200) {
      // user is not a mod or admin
      return;
    }

    resetTokenSocketHelper(wagerId, io, (wagerdata) => {
      const Note = new NoteData({
        username: userdata.username,
        note: username + " reset " + wagerId,
        author: username,
        timestamp: new Date(),
      });
      Note.save();
      io.in(wagerId).emit(NEW_RESET_EVENT, wagerdata);
      const allUsers = wagerdata?.red_users?.concat(wagerdata?.blue_users);
      allUsers.forEach((user) => {
        io.in(user).emit(NEW_CURRENT_TOKEN_EVENT, wagerId);
      });
      return;
    });
  });
};

// send a force win event to the client
const sendForceEvent = async (io, forceEventData) => {
  const { wagerId, username, teamNum } = forceEventData;

  if (!wagerId || !username || !teamNum) {
    // console.log("no wager id no username no teanum in force event");
    return;
  }

  try {
    const userdata = await UserData.findOne({ username });

    if (userdata?.role <= 100) {
      return;
    }

    const wagerdata = await WagerObjectData.findOne({ wagerid: wagerId });

    if (wagerdata.isTourneyMatch === true && wagerdata.isTourneyMatch != null) {
      const newWagerData = await bracketTournamentWin(
        wagerdata,
        parseInt(teamNum),
        io
      );
      // console.log("force event: ", newWagerData);
      const winner = newWagerData?.winner === 1 ? "Blue" : "Red";
      io.in(wagerId).emit(NEW_FORCE_EVENT, newWagerData);
      gameMessage(
        wagerId,
        `${winner} team has won due to force win by ${username}`,
        io
      );

      const Note = new NoteData({
        username: username,
        note: username + " forced win for " + wagerId + " - TOURNAMENT MATCH",
        author: userdata.username,
        timestamp: new Date(),
      });
      Note.save();
      return;
    } else if (!wagerdata.isTourneyMatch) {
      win(wagerdata, parseInt(teamNum), io, (newWagerData) => {
        // console.log("force event: ", newWagerData);
        const winner = newWagerData?.winner === 1 ? "Blue" : "Red";
        io.in(wagerId).emit(NEW_FORCE_EVENT, newWagerData);
        gameMessage(
          wagerId,
          `${winner} team has won due to force win by ${username}`,
          io
        );
        const allUsers = wagerdata?.red_users?.concat(wagerdata?.blue_users);
        allUsers?.forEach((user) =>
          io.in(user).emit(NEW_REMOVE_CURRENT_TOKEN_EVENT, wagerId)
        );

        markWagerComplete(wagerId);
        const Note = new NoteData({
          username: username,
          note: username + " forced win for " + wagerId,
          author: userdata.username,
          timestamp: new Date(),
        });
        Note.save();
        return;
      });
    }
  } catch (err) {
    console.log(err);
    if (err) return;
  }
};

// send a timer expired event to the client
const sendTimerExpiredReadyEvent = (io, sendTimerExpiredReadyEventData) => {
  const { wagerId, username } = sendTimerExpiredReadyEventData;
  sendCancelEvent(io, { wagerId, username });
};

const sendNewTempEpicEvent = (io, tempEpic, username) => {
  io.in(username).emit(NEW_TEMP_EPIC_EVENT, tempEpic);
};

const sendNewRemoveAgreeCancelEvent = async (io, agreeCancelData) => {
  // console.log("getting called");
  const { wagerId, username } = agreeCancelData;

  try {
    const wagerdata = await WagerDataV2.findOne({ wagerid: wagerId });

    var index = wagerdata?.agreedPlayers.indexOf(username);
    if (index !== -1) {
      const newAgreedPlayers = wagerdata.agreedPlayers.filter(
        (player) => player !== username
      );
      wagerdata.agreedPlayers = newAgreedPlayers;
      await wagerdata.save();
      // console.log("emitting");
      io.in(wagerId).emit(NEW_REMOVE_VOTE_CANCEL_EVENT, newAgreedPlayers);
    }
  } catch (err) {
    console.log(err);
    if (err) return;
  }
};

const sendNewRematchEvent = async (io, rematchData) => {
  // info needed to accept an invite for a rematch
  // og token id to pull all the info
  // player sending the invite
  const { tokenId, playerSendingInvite } = rematchData;

  // check if player sending the invite was in the og match
  try {
    const wagerdata = await WagerData.findOne({ _id: tokenId });
    const userdata = await UserData.findOne({ username: playerSendingInvite });

    if (!wagerdata || !userdata) {
      console.log("returning");
      return;
    }

    if (wagerdata?.rematchSent) {
      console.log("rematch already sent");
      return;
    }

    const newNotification = {
      read: false,
      body: playerSendingInvite + " wants a rematch!",
      attached: tokenId,
      type: "rematch",
      actionable: true,
      timestamp: Date.now(),
      avatar: userdata.avatar[0],
    };

    if (wagerdata?.blueteam_users?.includes(playerSendingInvite)) {
      for (let i = 0; i < wagerdata?.redteam_users?.length; i++) {
        const redUser = wagerdata?.redteam_users[i];
        // send invite
        const reduserdata = await UserData.findOne({ username: redUser });
        reduserdata.notifications.addToSet(newNotification);
        await reduserdata.save();
        io.in(redUser).emit(NEW_NOTIFICATION_EVENT, newNotification);
      }

      wagerdata.rematchSent = true;
      await wagerdata.save();
      const newtokendata = await getTokenObject(tokenId);
      io.in(tokenId).emit(NEW_REMATCH_INVITE_EVENT, newtokendata);
      return;
    } else if (wagerdata?.redteam_users?.includes(playerSendingInvite)) {
      for (let i = 0; i < wagerdata?.blueteam_users?.length; i++) {
        const blueUser = wagerdata?.blueteam_users[i];
        // send invite
        const blueuserdata = await UserData.findOne({ username: blueUser });
        blueuserdata.notifications.addToSet(newNotification);
        await blueuserdata.save();
        io.in(blueUser).emit(NEW_NOTIFICATION_EVENT, newNotification);
      }

      wagerdata.rematchSent = true;
      await wagerdata.save();
      const newtokendata = await getTokenObject(tokenId);
      io.in(tokenId).emit(NEW_REMATCH_INVITE_EVENT, newtokendata);
      return;
    } else {
      return;
    }
  } catch (err) {
    console.log(err);
    return;
  }
};

const sendNewBracketWinEvent = async (io, bracketWinData) => {
  const { token, teamNum } = bracketWinData;
  const newToken = await bracketTournamentWin(token, teamNum, io);
  io.in(newToken?.wagerid).emit(NEW_SUBMIT_EVENT, newToken);
};

const sendNewAgreeCancelEvent = async (io, agreeCancelData) => {
  const { wagerId, username, matchPlayers } = agreeCancelData;

  try {
    const wagerdata = await WagerDataV2.findOne({ wagerid: wagerId });

    if (!wagerdata) {
      let newAgreedPlayers = [];
      newAgreedPlayers.push(username);

      const newWagerData = new WagerDataV2({
        wagerid: wagerId,
        agreedPlayers: newAgreedPlayers,
        userThatPutUpBlue: "",
        userThatPutUpRed: "",
      });

      const savedData = await newWagerData.save();
      // console.log("savedData: ", savedData);
      io.in(wagerId).emit(NEW_AGREE_CANCEL_EVENT, savedData?.agreedPlayers);
      return;
    } else {
      if (!wagerdata?.agreedPlayers?.includes(username)) {
        wagerdata?.agreedPlayers?.addToSet(username);
        const saveddata = await wagerdata?.save();
        // console.log("saveddata: ", saveddata);
        if (saveddata?.agreedPlayers?.length === matchPlayers?.length) {
          // has everyone agreed?
          ProfitData.findOne({ wagerId: wagerId }, (err, profitData) => {
            if (err) {
              return;
            } else if (profitData) {
              profitData.remove({ wagerId: wagerId });
              //profitData.save();
              return;
            } else {
              saveddata?.agreedPlayers?.forEach((user) =>
                io.in(user).emit(NEW_REMOVE_CURRENT_TOKEN_EVENT, wagerId)
              );
              gameMessage(wagerId, "All players have voted to cancel.", io);
              // console.log("Profit has not been paid out for this token.");
              return;
            }
          });

          getWagerObject(wagerId, (oldwagerdata) => {
            if (
              oldwagerdata?.state === oldwagerdata?.PLAYING_STATE ||
              oldwagerdata?.state === oldwagerdata?.DISPUTE_STATE
            ) {
              cancelSocketHelper(oldwagerdata, (newwager) => {
                resetWagerBalance(wagerId, io);
                io.in(wagerId).emit(NEW_CANCEL_EVENT, newwager);
              });
            }
            return;
          });
          return;
        }
        io.in(wagerId).emit(NEW_AGREE_CANCEL_EVENT, saveddata?.agreedPlayers);
        return;
      }
    }
  } catch (err) {
    console.log(err);
    if (err) return;
  }
};

module.exports = {
  sendTeamInvite,
  sendReadyEvent,
  sendJoinEvent,
  sendSubmitEvent,
  sendCancelEvent,
  sendResetEvent,
  sendForceEvent,
  socketEvents,
  sendTimerExpiredReadyEvent,
  sendNewTempEpicEvent,
  sendNewAgreeCancelEvent,
  cancelSocketHelper,
  sendNewRemoveAgreeCancelEvent,
  sendNewRematchEvent,
  sendNewBracketWinEvent,
};

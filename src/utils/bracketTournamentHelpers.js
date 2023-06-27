const { TeamData } = require("../models/Team");
const { v4: uuidv4 } = require("uuid");
const hash = require("object-hash");
const { WagerData } = require("../models/Wager");
const {
  BracketTourneyData,
  MatchData,
} = require("../models/BracketTournament");
const { WagerObjectData } = require("../models/WagerObject");
const { EarningsData } = require("../models/Earnings");
const { UserData } = require("../models/User");
const { TourneyProfitData } = require("../models/TourneyProfit");
const { getUnlinkedTokenObject } = require("./unlinkedHelperMethods");
// const { TeamData } = require("../models/Team");
const NEW_UPDATE_BALANCE_EVENT = "updateBalance";
const NEW_BRACKET_UPDATE_EVENT = "newBracket";
const NEW_NOTIFICATION_EVENT = "newNotification";
const NEW_CURRENT_TOKEN_EVENT = "newCurrentToken";
const NEW_TOURNAMENT_CREATED_EVENT = "newTournament";
const NEW_TOURNAMENT_REMOVED_EVENT = "removedTournament";

const bracketTournamentWin = async (socketWager, teamnum, io) => {
  try {
    let prizeDistObj = {};
    // get tournament object
    const wager = await WagerObjectData.findOne({
      wagerid: socketWager?.wagerid,
    });
    const data = await WagerData.findOne({ _id: socketWager?.wagerid });
    const tourneyToJoin = await BracketTourneyData.findOne({
      _id: data.tourneyId,
    });
    const blueTeamData = await TeamData.findOne({ _id: data.blueteamid });
    const redTeamData = await TeamData.findOne({ _id: data.redteamid });
    const hostData = await UserData.findOne({
      username: tourneyToJoin?.host?.username,
    });
    blueTeamData.wager_id = "";
    redTeamData.wager_id = "";

    // check round
    const round = tourneyToJoin.bracket.round;
    const numRounds = tourneyToJoin.bracket.num_rounds;
    if (round === numRounds && tourneyToJoin.paid_prizes !== true) {
      // final round, finish tournament

      redTeamData.in_wager = false;
      blueTeamData.in_wager = false;

      // loop through rounds
      // pay 1st and 2nd
      // move on to previous round
      // each round loser gets paid the same / 50%
      // continue paying losers until you reach num_winners

      const moneyBack = tourneyToJoin.entry_fee;
      const multiplier = moneyBack * tourneyToJoin.team_size;
      const restOfPrize =
        tourneyToJoin?.num_winners < 2
          ? tourneyToJoin.prize - multiplier
          : tourneyToJoin.prize;
      let tax = restOfPrize * 0.3;
      const restOfPrizeAfterTax =
        tourneyToJoin.entry_fee > 0 && tourneyToJoin.entry_fee != null
          ? restOfPrize - tax
          : restOfPrize;
      const tourneyProfitData = await TourneyProfitData.findOne({
        tourneyId: tourneyToJoin._id,
      });

      if (tourneyToJoin.entry_fee > 0 && hostData.role === 69) {
        // do stuff to pay out creator as well

        //pay balance
        hostData.balance += tax / 2;
        //pay max withdrawal
        if (hostData.max_withdrawal < tax / 2) {
          hostData.max_withdrawal += tax / 2;
        }

        let newNotification = {
          read: false,
          body:
            "You have earned: " +
            tax / 2 +
            " from hosting: " +
            tourneyToJoin.title +
            " , which has been credited to your balance.",
          attached: {
            title: tourneyToJoin?.title,
            _id: tourneyToJoin?._id.toString(),
            prize: tax / 2,
          },
          type: "new_tournament_earn_creator",
          actionable: false,
          timestamp: new Date(),
        };
        hostData.notifications.addToSet(newNotification);
        await hostData.save();
        io.in(hostData.username).emit(NEW_NOTIFICATION_EVENT, newNotification);
        io.in(hostData.username).emit(
          NEW_UPDATE_BALANCE_EVENT,
          hostData.balance.toString()
        );
        if (!tourneyProfitData && tourneyToJoin.entry_fee > 0) {
          const newProfit = new TourneyProfitData({
            tourneyId: tourneyToJoin?._id + "#" + tourneyToJoin.host.username,
            profit: tax / 2,
          });
          await newProfit.save();
        }
      } else {
        if (!tourneyProfitData && tourneyToJoin.entry_fee > 0) {
          const newProfit = new TourneyProfitData({
            tourneyId: tourneyToJoin?._id,
            profit: tax,
          });
          await newProfit.save();
        }
      }
      // only one winner
      if (tourneyToJoin?.num_winners === 1) {
        if (teamnum === 1) {
          // give money back to red
          tourneyToJoin.bracket.matches[
            tourneyToJoin.bracket.matches.length - 1
          ][0].winner = 1;
          for (let i = 0; i < redTeamData.usernames.length; i++) {
            const redUser = await UserData.findOne({
              username: redTeamData.usernames[i],
            });
            redUser.balance += moneyBack;
            await redUser.save();
            io.in(redUser.username).emit(
              NEW_UPDATE_BALANCE_EVENT,
              redUser.balance.toString()
            );
          }
          const users = [];
          for (let i = 0; i < redTeamData.usernames.length; i++) {
            const userdata = await UserData.findOne({
              username: redTeamData.usernames[i],
            });
            users.push(userdata);
          }
          prizeDistObj[1] = users;

          // give rest of money to blue
          for (let i = 0; i < blueTeamData.usernames.length; i++) {
            const blueUser = await UserData.findOne({
              username: blueTeamData.usernames[i],
            });
            const blueEarnings = await EarningsData.findOne({
              username: blueUser.username,
            });
            blueUser.balance +=
              restOfPrizeAfterTax / blueTeamData.usernames.length;
            if (
              blueUser.max_withdrawal <=
              restOfPrizeAfterTax / blueTeamData.usernames.length
            ) {
              blueUser.max_withdrawal +=
                restOfPrizeAfterTax / blueTeamData.usernames.length;
            }

            io.in(blueUser.username).emit(
              NEW_UPDATE_BALANCE_EVENT,
              blueUser.balance.toString()
            );
            let newNotification = {
              read: false,
              body:
                "You have won: " +
                tourneyToJoin.title +
                ", $" +
                restOfPrizeAfterTax / blueTeamData.usernames.length +
                " has been added to your balance.",
              attached: {
                title: tourneyToJoin?.title,
                _id: tourneyToJoin?._id.toString(),
                prize: restOfPrizeAfterTax / blueTeamData.usernames.length,
              },
              type: "new_tournament_win",
              actionable: false,
              timestamp: new Date(),
            };
            blueUser.notifications.addToSet(newNotification);
            await blueUser.save();
            io.in(blueUser.username).emit(
              NEW_NOTIFICATION_EVENT,
              newNotification
            );
            if (tourneyToJoin.prize >= 100) {
              blueEarnings.eliteTrophies++;
            }
            if (tourneyToJoin.prize >= 50 && tourneyToJoin.prize < 100) {
              blueEarnings.goldTrophies++;
            }
            if (tourneyToJoin.prize >= 30 && tourneyToJoin.prize < 50) {
              blueEarnings.silverTrophies++;
            }
            if (tourneyToJoin.prize >= 10 && tourneyToJoin.prize < 30) {
              blueEarnings.bronzeTrophies++;
            }
            blueEarnings.total += restOfPrizeAfterTax / tourneyToJoin.team_size;
            await blueEarnings.save();
            const users = [];
            for (let i = 0; i < blueTeamData.usernames.length; i++) {
              const userdata = await UserData.findOne({
                username: blueTeamData.usernames[i],
              });
              users.push(userdata);
            }
            prizeDistObj[0] = users;
          }
        } else {
          tourneyToJoin.bracket.matches[
            tourneyToJoin.bracket.matches.length - 1
          ][0].winner = 2;
          // give money back to blue
          for (let i = 0; i < blueTeamData.usernames.length; i++) {
            const blueUser = await UserData.findOne({
              username: blueTeamData.usernames[i],
            });
            blueUser.balance += moneyBack;
            await blueUser.save();
            io.in(blueUser.username).emit(
              NEW_UPDATE_BALANCE_EVENT,
              blueUser.balance.toString()
            );
            const users = [];
            for (let i = 0; i < blueTeamData.usernames.length; i++) {
              const userdata = await UserData.findOne({
                username: blueTeamData.usernames[i],
              });
              users.push(userdata);
            }
            prizeDistObj[1] = users;
          }

          // give rest of money to red
          for (let i = 0; i < redTeamData.usernames.length; i++) {
            const redUser = await UserData.findOne({
              username: redTeamData.usernames[i],
            });

            redUser.balance +=
              restOfPrizeAfterTax / redTeamData.usernames.length;
            if (
              redUser.max_withdrawal <=
              restOfPrizeAfterTax / redTeamData.usernames.length
            ) {
              redUser.max_withdrawal +=
                restOfPrizeAfterTax / redTeamData.usernames.length;
            }
            io.in(redUser.username).emit(
              NEW_UPDATE_BALANCE_EVENT,
              redUser.balance.toString()
            );
            let newNotification = {
              read: false,
              body:
                "You have won: " +
                tourneyToJoin.title +
                ", $" +
                restOfPrizeAfterTax / blueTeamData.usernames.length +
                " has been added to your balance.",
              attached: {
                title: tourneyToJoin?.title,
                _id: tourneyToJoin?._id.toString(),
                prize: restOfPrizeAfterTax / blueTeamData.usernames.length,
              },
              type: "new_tournament_win",
              actionable: false,
              timestamp: new Date(),
            };
            redUser.notifications.addToSet(newNotification);
            await redUser.save();
            io.in(redUser.username).emit(
              NEW_NOTIFICATION_EVENT,
              newNotification
            );
            const redEarnings = await EarningsData.findOne({
              username: redUser.username,
            });
            if (tourneyToJoin.prize >= 100) {
              redEarnings.eliteTrophies++;
            }
            if (tourneyToJoin.prize >= 50 && tourneyToJoin.prize < 100) {
              redEarnings.goldTrophies++;
            }
            if (tourneyToJoin.prize >= 30 && tourneyToJoin.prize < 50) {
              redEarnings.silverTrophies++;
            }
            if (tourneyToJoin.prize >= 10 && tourneyToJoin.prize < 30) {
              redEarnings.bronzeTrophies++;
            }
            redEarnings.total += restOfPrizeAfterTax / tourneyToJoin.team_size;
            await redEarnings.save();
            const users = [];
            for (let i = 0; i < redTeamData.usernames.length; i++) {
              const userdata = await UserData.findOne({
                username: redTeamData.usernames[i],
              });
              users.push(userdata);
            }
            prizeDistObj[0] = users;
          }
        }
      } else {
        if (tourneyToJoin?.num_winners === 2) {
          const firstPlacePrize = restOfPrizeAfterTax * 0.7;
          const secondPlacePrize = restOfPrizeAfterTax * 0.3;
          if (teamnum === 1) {
            // pay blue team 70% pay red team 30%
            tourneyToJoin.bracket.matches[
              tourneyToJoin.bracket.matches.length - 1
            ][0].winner = 1;

            // pay blue 70%
            for (let i = 0; i < blueTeamData?.usernames?.length; i++) {
              const blueuserdata = await UserData.findOne({
                username: blueTeamData?.usernames[i],
              });
              blueuserdata.balance +=
                firstPlacePrize / tourneyToJoin?.team_size;
              if (
                blueuserdata.max_withdrawal <=
                firstPlacePrize / tourneyToJoin?.team_size
              ) {
                blueuserdata.max_withdrawal +=
                  firstPlacePrize / tourneyToJoin?.team_size;
              }
              io.in(blueuserdata.username).emit(
                NEW_UPDATE_BALANCE_EVENT,
                blueuserdata.balance.toString()
              );
              let newNotification = {
                read: false,
                body:
                  "You have won: " +
                  tourneyToJoin.title +
                  ", $" +
                  firstPlacePrize / tourneyToJoin?.team_size +
                  " has been added to your balance.",
                attached: {
                  title: tourneyToJoin?.title,
                  _id: tourneyToJoin?._id.toString(),
                  prize: firstPlacePrize / tourneyToJoin?.team_size,
                },
                type: "new_tournament_win",
                actionable: false,
                timestamp: new Date(),
              };
              blueuserdata.notifications.addToSet(newNotification);
              await blueuserdata.save();
              io.in(blueuserdata.username).emit(
                NEW_NOTIFICATION_EVENT,
                newNotification
              );
              const blueEarnings = await EarningsData.findOne({
                username: blueuserdata.username,
              });
              if (tourneyToJoin.prize >= 100) {
                blueEarnings.eliteTrophies++;
              }
              if (tourneyToJoin.prize >= 50 && tourneyToJoin.prize < 100) {
                blueEarnings.goldTrophies++;
              }
              if (tourneyToJoin.prize >= 30 && tourneyToJoin.prize < 50) {
                blueEarnings.silverTrophies++;
              }
              if (tourneyToJoin.prize >= 10 && tourneyToJoin.prize < 30) {
                blueEarnings.bronzeTrophies++;
              }
              blueEarnings.total +=
                restOfPrizeAfterTax / tourneyToJoin.team_size;
              await blueEarnings.save();
              const users = [];
              for (let i = 0; i < blueTeamData.usernames.length; i++) {
                const userdata = await UserData.findOne({
                  username: blueTeamData.usernames[i],
                });
                users.push(userdata);
              }
              prizeDistObj[0] = users;
            }

            // pay red 30%
            for (let i = 0; i < redTeamData?.usernames?.length; i++) {
              const reduserdata = await UserData.findOne({
                username: redTeamData?.usernames[i],
              });
              reduserdata.balance +=
                secondPlacePrize / tourneyToJoin?.team_size;
              if (
                reduserdata.max_withdrawal <=
                secondPlacePrize / tourneyToJoin?.team_size
              ) {
                reduserdata.max_withdrawal +=
                  secondPlacePrize / tourneyToJoin?.team_size;
              }
              io.in(reduserdata.username).emit(
                NEW_UPDATE_BALANCE_EVENT,
                reduserdata.balance.toString()
              );
              let newNotification = {
                read: false,
                body:
                  "You have won: " +
                  secondPlacePrize / tourneyToJoin?.team_size +
                  " from: " +
                  tourneyToJoin.title,
                attached: {
                  title: tourneyToJoin?.title,
                  _id: tourneyToJoin?._id.toString(),
                  prize: secondPlacePrize / tourneyToJoin?.team_size,
                },
                type: "new_tournament_earned",
                actionable: false,
                timestamp: new Date(),
              };
              reduserdata.notifications.addToSet(newNotification);
              await reduserdata.save();
              io.in(reduserdata.username).emit(
                NEW_NOTIFICATION_EVENT,
                newNotification
              );
              const redEarnings = await EarningsData.findOne({
                username: reduserdata.username,
              });
              if (tourneyToJoin.prize >= 100) {
                redEarnings.eliteTrophies++;
              }
              if (tourneyToJoin.prize >= 50 && tourneyToJoin.prize < 100) {
                redEarnings.goldTrophies++;
              }
              if (tourneyToJoin.prize >= 30 && tourneyToJoin.prize < 50) {
                redEarnings.silverTrophies++;
              }
              if (tourneyToJoin.prize >= 10 && tourneyToJoin.prize < 30) {
                redEarnings.bronzeTrophies++;
              }
              redEarnings.total +=
                restOfPrizeAfterTax / tourneyToJoin.team_size;
              await redEarnings.save();
              const users = [];
              for (let i = 0; i < redTeamData.usernames.length; i++) {
                const userdata = await UserData.findOne({
                  username: redTeamData.usernames[i],
                });
                users.push(userdata);
              }
              prizeDistObj[1] = users;
            }
          } else {
            // pay red team 70% pay blue team 30%
            tourneyToJoin.bracket.matches[
              tourneyToJoin.bracket.matches.length - 1
            ][0].winner = 2;

            // pay red 70%
            for (let i = 0; i < redTeamData?.usernames?.length; i++) {
              const reduserdata = await UserData.findOne({
                username: redTeamData?.usernames[i],
              });
              reduserdata.balance += firstPlacePrize / tourneyToJoin?.team_size;
              if (
                reduserdata.max_withdrawal <=
                firstPlacePrize / tourneyToJoin?.team_size
              ) {
                reduserdata.max_withdrawal +=
                  firstPlacePrize / tourneyToJoin?.team_size;
              }
              io.in(reduserdata.username).emit(
                NEW_UPDATE_BALANCE_EVENT,
                reduserdata.balance.toString()
              );
              let newNotification = {
                read: false,
                body:
                  "You have won: " +
                  tourneyToJoin.title +
                  ", $" +
                  firstPlacePrize / tourneyToJoin?.team_size +
                  " has been added to your balance.",
                attached: {
                  title: tourneyToJoin?.title,
                  _id: tourneyToJoin?._id.toString(),
                  prize: firstPlacePrize / tourneyToJoin?.team_size,
                },
                type: "new_tournament_win",
                actionable: false,
                timestamp: new Date(),
              };
              reduserdata.notifications.addToSet(newNotification);
              await reduserdata.save();
              io.in(reduserdata.username).emit(
                NEW_NOTIFICATION_EVENT,
                newNotification
              );
              const redEarnings = await EarningsData.findOne({
                username: reduserdata.username,
              });
              if (tourneyToJoin.prize >= 100) {
                redEarnings.eliteTrophies++;
              }
              if (tourneyToJoin.prize >= 50 && tourneyToJoin.prize < 100) {
                redEarnings.goldTrophies++;
              }
              if (tourneyToJoin.prize >= 30 && tourneyToJoin.prize < 50) {
                redEarnings.silverTrophies++;
              }
              if (tourneyToJoin.prize >= 10 && tourneyToJoin.prize < 30) {
                redEarnings.bronzeTrophies++;
              }
              redEarnings.total +=
                restOfPrizeAfterTax / tourneyToJoin.team_size;
              await redEarnings.save();
              const users = [];
              for (let i = 0; i < redTeamData.usernames.length; i++) {
                const userdata = await UserData.findOne({
                  username: redTeamData.usernames[i],
                });
                users.push(userdata);
              }
              prizeDistObj[0] = users;
            }

            // pay blue 30%
            for (let i = 0; i < blueTeamData?.usernames?.length; i++) {
              const blueuserdata = await UserData.findOne({
                username: blueTeamData?.usernames[i],
              });
              blueuserdata.balance +=
                secondPlacePrize / tourneyToJoin?.team_size;
              if (
                blueuserdata.max_withdrawal <=
                secondPlacePrize / tourneyToJoin?.team_size
              ) {
                blueuserdata.max_withdrawal +=
                  secondPlacePrize / tourneyToJoin?.team_size;
              }
              io.in(blueuserdata.username).emit(
                NEW_UPDATE_BALANCE_EVENT,
                reduserdata.balance.toString()
              );
              let newNotification = {
                read: false,
                body:
                  "You have won: " +
                  secondPlacePrize / tourneyToJoin?.team_size +
                  " from: " +
                  tourneyToJoin.title,
                attached: {
                  title: tourneyToJoin?.title,
                  _id: tourneyToJoin?._id.toString(),
                  prize: secondPlacePrize / tourneyToJoin?.team_size,
                },
                type: "new_tournament_earned",
                actionable: false,
                timestamp: new Date(),
              };
              blueuserdata.notifications.addToSet(newNotification);
              await blueuserdata.save();
              io.in(blueuserdata.username).emit(
                NEW_NOTIFICATION_EVENT,
                newNotification
              );
              const blueEarnings = await EarningsData.findOne({
                username: blueuserdata.username,
              });
              if (tourneyToJoin.prize >= 100) {
                blueEarnings.eliteTrophies++;
              }
              if (tourneyToJoin.prize >= 50 && tourneyToJoin.prize < 100) {
                blueEarnings.goldTrophies++;
              }
              if (tourneyToJoin.prize >= 30 && tourneyToJoin.prize < 50) {
                blueEarnings.silverTrophies++;
              }
              if (tourneyToJoin.prize >= 10 && tourneyToJoin.prize < 30) {
                blueEarnings.bronzeTrophies++;
              }
              blueEarnings.total +=
                restOfPrizeAfterTax / tourneyToJoin.team_size;
              await blueEarnings.save();
              const users = [];
              for (let i = 0; i < blueTeamData.usernames.length; i++) {
                const userdata = await UserData.findOne({
                  username: blueTeamData.usernames[i],
                });
                users.push(userdata);
              }
              prizeDistObj[1] = users;
            }
          }
          teamsPaid = 2;
        } else {
          let teamsPaid = 0;
          let remainingMoney = restOfPrizeAfterTax;
          let currentRound = round;
          const payPercentage = 0.5;

          while (teamsPaid < tourneyToJoin.num_winners) {
            if (currentRound === numRounds) {
              const blueteamdata = await TeamData.findOne({
                _id: tourneyToJoin.bracket.matches[
                  tourneyToJoin.bracket.matches.length - 1
                ][0]?.blueteamid,
              });
              const redteamdata = await TeamData.findOne({
                _id: tourneyToJoin.bracket.matches[
                  tourneyToJoin.bracket.matches.length - 1
                ][0]?.redteamid,
              });
              if (teamnum === 1) {
                // pay blue payPercentage of remaining
                tourneyToJoin.bracket.matches[
                  tourneyToJoin.bracket.matches.length - 1
                ][0].winner = 1;
                for (let i = 0; i < blueteamdata?.usernames.length; i++) {
                  const blueuserdata = await UserData.findOne({
                    username: blueteamdata?.usernames[i],
                  });
                  blueuserdata.balance +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  if (
                    blueuserdata.max_withdrawal <
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size
                  ) {
                    blueuserdata.max_withdrawal +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin.team_size;
                  }
                  let newNotification = {
                    read: false,
                    body:
                      "You have won: " +
                      tourneyToJoin.title +
                      ", $" +
                      (remainingMoney * payPercentage) /
                        blueTeamData.usernames.length +
                      " has been added to your balance.",
                    attached: {
                      title: tourneyToJoin?.title,
                      _id: tourneyToJoin?._id.toString(),
                      prize:
                        (remainingMoney * payPercentage) /
                        blueTeamData.usernames.length,
                    },
                    type: "new_tournament_win",
                    actionable: false,
                    timestamp: new Date(),
                  };
                  blueuserdata.notifications.addToSet(newNotification);
                  await blueuserdata.save();
                  io.in(blueuserdata.username).emit(
                    NEW_NOTIFICATION_EVENT,
                    newNotification
                  );
                  io.in(blueuserdata.username).emit(
                    NEW_UPDATE_BALANCE_EVENT,
                    blueuserdata.balance.toString()
                  );
                  const blueEarnings = await EarningsData.findOne({
                    username: blueuserdata.username,
                  });
                  if (remainingMoney * payPercentage >= 100) {
                    blueEarnings.eliteTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 50 &&
                    remainingMoney * payPercentage < 100
                  ) {
                    blueEarnings.goldTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 30 &&
                    remainingMoney * payPercentage < 50
                  ) {
                    blueEarnings.silverTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 10 &&
                    remainingMoney * payPercentage < 30
                  ) {
                    blueEarnings.bronzeTrophies++;
                  }
                  blueEarnings.total +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  await blueEarnings.save();

                  const users = [];
                  for (let i = 0; i < blueTeamData.usernames.length; i++) {
                    const userdata = await UserData.findOne({
                      username: blueTeamData.usernames[i],
                    });
                    users.push(userdata);
                  }
                  prizeDistObj[teamsPaid] = users;
                }
                remainingMoney -= remainingMoney * payPercentage;
                // pay red payPercentage of remaining
                for (let i = 0; i < redteamdata?.usernames.length; i++) {
                  const reduserdata = await UserData.findOne({
                    username: redteamdata?.usernames[i],
                  });
                  reduserdata.balance +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  if (
                    reduserdata.max_withdrawal <
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size
                  ) {
                    reduserdata.max_withdrawal +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin.team_size;
                  }
                  let newNotification = {
                    read: false,
                    body:
                      "You have won: $" +
                      (remainingMoney * payPercentage) /
                        tourneyToJoin.team_size +
                      " from: " +
                      tourneyToJoin.title,
                    attached: {
                      title: tourneyToJoin?.title,
                      _id: tourneyToJoin?._id.toString(),
                      prize:
                        (remainingMoney * payPercentage) /
                        tourneyToJoin.team_size,
                    },
                    type: "new_tournament_earned",
                    actionable: false,
                    timestamp: new Date(),
                  };
                  reduserdata.notifications.addToSet(newNotification);
                  await reduserdata.save();
                  io.in(reduserdata.username).emit(
                    NEW_NOTIFICATION_EVENT,
                    newNotification
                  );
                  io.in(reduserdata.username).emit(
                    NEW_UPDATE_BALANCE_EVENT,
                    reduserdata.balance.toString()
                  );
                  const redEarnings = await EarningsData.findOne({
                    username: reduserdata.username,
                  });
                  if (remainingMoney * payPercentage >= 100) {
                    redEarnings.eliteTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 50 &&
                    remainingMoney * payPercentage < 100
                  ) {
                    redEarnings.goldTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 30 &&
                    remainingMoney * payPercentage < 50
                  ) {
                    redEarnings.silverTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 10 &&
                    remainingMoney * payPercentage < 30
                  ) {
                    redEarnings.bronzeTrophies++;
                  }
                  redEarnings.total +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  await redEarnings.save();
                  const users = [];
                  for (let i = 0; i < redTeamData.usernames.length; i++) {
                    const userdata = await UserData.findOne({
                      username: redTeamData.usernames[i],
                    });
                    users.push(userdata);
                  }
                  prizeDistObj[teamsPaid + 1] = users;
                }

                // update teams paid

                teamsPaid += 2;
                // update round
                currentRound -= 1;
              } else {
                tourneyToJoin.bracket.matches[
                  tourneyToJoin.bracket.matches.length - 1
                ][0].winner = 2;
                // pay blue payPercentage of remaining
                for (let i = 0; i < redteamdata?.usernames.length; i++) {
                  const reduserdata = await UserData.findOne({
                    username: redteamdata?.usernames[i],
                  });
                  reduserdata.balance +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  if (
                    reduserdata.max_withdrawal <
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size
                  ) {
                    reduserdata.max_withdrawal +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin.team_size;
                  }
                  let newNotification = {
                    read: false,
                    body:
                      "You have won: $" +
                      (remainingMoney * payPercentage) /
                        tourneyToJoin.team_size +
                      " from: " +
                      tourneyToJoin.title,
                    attached: {
                      title: tourneyToJoin?.title,
                      _id: tourneyToJoin?._id.toString(),
                      prize:
                        (remainingMoney * payPercentage) /
                        tourneyToJoin.team_size,
                    },
                    type: "new_tournament_earned",
                    actionable: false,
                    timestamp: new Date(),
                  };
                  reduserdata.notifications.addToSet(newNotification);
                  await reduserdata.save();
                  io.in(reduserdata.username).emit(
                    NEW_NOTIFICATION_EVENT,
                    newNotification
                  );
                  io.in(reduserdata.username).emit(
                    NEW_UPDATE_BALANCE_EVENT,
                    reduserdata.balance.toString()
                  );
                  const redEarnings = await EarningsData.findOne({
                    username: reduserdata.username,
                  });
                  if (remainingMoney * payPercentage >= 100) {
                    redEarnings.eliteTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 50 &&
                    remainingMoney * payPercentage < 100
                  ) {
                    redEarnings.goldTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 30 &&
                    remainingMoney * payPercentage < 50
                  ) {
                    redEarnings.silverTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 10 &&
                    remainingMoney * payPercentage < 30
                  ) {
                    redEarnings.bronzeTrophies++;
                  }
                  redEarnings.total +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  await redEarnings.save();

                  const users = [];
                  for (let i = 0; i < redTeamData.usernames.length; i++) {
                    const userdata = await UserData.findOne({
                      username: redTeamData.usernames[i],
                    });
                    users.push(userdata);
                  }
                  prizeDistObj[teamsPaid] = users;
                }
                remainingMoney -= remainingMoney * payPercentage;
                // pay red payPercentage of remaining
                for (let i = 0; i < blueteamdata?.usernames.length; i++) {
                  const blueuserdata = await UserData.findOne({
                    username: blueteamdata?.usernames[i],
                  });
                  blueuserdata.balance +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  if (
                    blueuserdata.max_withdrawal <
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size
                  ) {
                    blueuserdata.max_withdrawal +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin.team_size;
                  }
                  let newNotification = {
                    read: false,
                    body:
                      "You have won: $" +
                      (remainingMoney * payPercentage) /
                        tourneyToJoin.team_size +
                      " from: " +
                      tourneyToJoin.title,
                    attached: {
                      title: tourneyToJoin?.title,
                      _id: tourneyToJoin?._id.toString(),
                      prize:
                        (remainingMoney * payPercentage) /
                        tourneyToJoin.team_size,
                    },
                    type: "new_tournament_earned",
                    actionable: false,
                    timestamp: new Date(),
                  };
                  blueuserdata.notifications.addToSet(newNotification);
                  await blueuserdata.save();
                  io.in(blueuserdata.username).emit(
                    NEW_NOTIFICATION_EVENT,
                    newNotification
                  );
                  io.in(blueuserdata.username).emit(
                    NEW_UPDATE_BALANCE_EVENT,
                    blueuserdata.balance.toString()
                  );
                  const blueEarnings = await EarningsData.findOne({
                    username: blueuserdata.username,
                  });
                  blueEarnings.total +=
                    (remainingMoney * payPercentage) / tourneyToJoin.team_size;
                  if (remainingMoney * payPercentage >= 100) {
                    blueEarnings.eliteTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 50 &&
                    remainingMoney * payPercentage < 100
                  ) {
                    blueEarnings.goldTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 30 &&
                    remainingMoney * payPercentage < 50
                  ) {
                    blueEarnings.silverTrophies++;
                  }
                  if (
                    remainingMoney * payPercentage >= 10 &&
                    remainingMoney * payPercentage < 30
                  ) {
                    blueEarnings.bronzeTrophies++;
                  }
                  await blueEarnings.save();
                  const users = [];
                  for (let i = 0; i < blueTeamData.usernames.length; i++) {
                    const userdata = await UserData.findOne({
                      username: blueteamdata.usernames[i],
                    });
                    users.push(userdata);
                  }
                  prizeDistObj[teamsPaid + 1] = users;
                }
                // update teams paid
                teamsPaid += 2;
                // update round
                currentRound -= 1;
              }
            } else {
              // is not finals, pay both losers the same
              for (
                let i = 0;
                i < tourneyToJoin?.bracket?.matches[currentRound - 1].length;
                i++
              ) {
                const currentMatch =
                  tourneyToJoin?.bracket?.matches[currentRound - 1][i];
                const winner = currentMatch.winner;
                if (winner === 1) {
                  // pay red
                  for (
                    let j = 0;
                    j < currentMatch?.redteam_users?.length;
                    j++
                  ) {
                    const loserdata = await UserData.findOne({
                      username: currentMatch?.redteam_users[j]?.username,
                    });

                    loserdata.balance +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin?.bracket?.matches[currentRound - 1].length /
                      tourneyToJoin.team_size;
                    if (
                      loserdata.max_withdrawal <
                      (remainingMoney * payPercentage) /
                        tourneyToJoin?.bracket?.matches[currentRound - 1]
                          .length /
                        tourneyToJoin.team_size
                    ) {
                      loserdata.max_withdrawal +=
                        (remainingMoney * payPercentage) /
                        tourneyToJoin?.bracket?.matches[currentRound - 1]
                          .length /
                        tourneyToJoin.team_size;
                    }
                    let newNotification = {
                      read: false,
                      body:
                        "You have won: $" +
                        (remainingMoney * payPercentage) /
                          tourneyToJoin.team_size +
                        " from: " +
                        tourneyToJoin.title,
                      attached: {
                        title: tourneyToJoin?.title,
                        _id: tourneyToJoin?._id.toString(),
                        prize:
                          (remainingMoney * payPercentage) /
                          tourneyToJoin.team_size,
                      },
                      type: "new_tournament_earned",
                      actionable: false,
                      timestamp: new Date(),
                    };
                    loserdata.notifications.addToSet(newNotification);
                    await loserdata.save();
                    io.in(loserdata.username).emit(
                      NEW_NOTIFICATION_EVENT,
                      newNotification
                    );
                    io.in(loserdata.username).emit(
                      NEW_UPDATE_BALANCE_EVENT,
                      loserdata.balance.toString()
                    );
                    const loserEarnings = await EarningsData.findOne({
                      username: loserdata.username,
                    });
                    loserEarnings.total +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin?.bracket?.matches[currentRound - 1].length /
                      tourneyToJoin.team_size;
                    const moneyEarned =
                      (remainingMoney * payPercentage) /
                      tourneyToJoin?.bracket?.matches[currentRound - 1].length /
                      tourneyToJoin.team_size;
                    if (moneyEarned >= 100) {
                      loserEarnings.eliteTrophies++;
                    }
                    if (moneyEarned >= 50 && moneyEarned < 100) {
                      loserEarnings.goldTrophies++;
                    }
                    if (moneyEarned >= 30 && moneyEarned < 50) {
                      loserEarnings.silverTrophies++;
                    }
                    if (moneyEarned >= 10 && moneyEarned < 30) {
                      loserEarnings.bronzeTrophies++;
                    }
                    await loserEarnings.save();
                    const users = [];
                    for (
                      let i = 0;
                      i < currentMatch.redteam_users.length;
                      i++
                    ) {
                      const userdata = await UserData.findOne({
                        username: currentMatch.redteam_users[i].username,
                      });
                      users.push(userdata);
                    }
                    prizeDistObj[teamsPaid] = users;
                  }
                } else {
                  // pay blue
                  for (
                    let j = 0;
                    j < currentMatch?.blueteam_users?.length;
                    j++
                  ) {
                    const loserdata = await UserData.findOne({
                      username: currentMatch?.blueteam_users[j]?.username,
                    });
                    loserdata.balance +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin?.bracket?.matches[currentRound - 1].length /
                      tourneyToJoin.team_size;
                    if (
                      loserdata.max_withdrawal <
                      (remainingMoney * payPercentage) /
                        tourneyToJoin?.bracket?.matches[currentRound - 1]
                          .length /
                        tourneyToJoin.team_size
                    ) {
                      loserdata.max_withdrawal +=
                        (remainingMoney * payPercentage) /
                        tourneyToJoin?.bracket?.matches[currentRound - 1]
                          .length /
                        tourneyToJoin.team_size;
                    }
                    let newNotification = {
                      read: false,
                      body:
                        "You have won: $" +
                        (remainingMoney * payPercentage) /
                          tourneyToJoin.team_size +
                        " from: " +
                        tourneyToJoin.title,
                      attached: {
                        title: tourneyToJoin?.title,
                        _id: tourneyToJoin?._id.toString(),
                        prize:
                          (remainingMoney * payPercentage) /
                          tourneyToJoin.team_size,
                      },
                      type: "new_tournament_earned",
                      actionable: false,
                      timestamp: new Date(),
                    };
                    loserdata.notifications.addToSet(newNotification);
                    await loserdata.save();
                    io.in(loserdata.username).emit(
                      NEW_NOTIFICATION_EVENT,
                      newNotification
                    );
                    io.in(loserdata.username).emit(
                      NEW_UPDATE_BALANCE_EVENT,
                      loserdata.balance.toString()
                    );
                    const loserEarnings = await EarningsData.findOne({
                      username: loserdata.username,
                    });
                    loserEarnings.total +=
                      (remainingMoney * payPercentage) /
                      tourneyToJoin?.bracket?.matches[currentRound - 1].length /
                      tourneyToJoin.team_size;
                    const moneyEarned =
                      (remainingMoney * payPercentage) /
                      tourneyToJoin?.bracket?.matches[currentRound - 1].length /
                      tourneyToJoin.team_size;
                    if (moneyEarned >= 100) {
                      loserEarnings.eliteTrophies++;
                    }
                    if (moneyEarned >= 50 && moneyEarned < 100) {
                      loserEarnings.goldTrophies++;
                    }
                    if (moneyEarned >= 30 && moneyEarned < 50) {
                      loserEarnings.silverTrophies++;
                    }
                    if (moneyEarned >= 10 && moneyEarned < 30) {
                      loserEarnings.bronzeTrophies++;
                    }
                    await loserEarnings.save();
                    const users = [];
                    for (
                      let i = 0;
                      i < currentMatch.blueteam_users.length;
                      i++
                    ) {
                      const userdata = await UserData.findOne({
                        username: currentMatch.blueteam_users[i].username,
                      });
                      users.push(userdata);
                    }
                    prizeDistObj[teamsPaid] = users;
                  }
                }
                teamsPaid += 1;
              }
              // update round
              currentRound -= 1;
              // update remaining money
              remainingMoney -= remainingMoney * payPercentage;
              // update teams paid
            }
          }
        }
      }

      // change tournament state, winner, paid_prizes
      tourneyToJoin.paid_prizes = true;
      tourneyToJoin.state = 2;
      tourneyToJoin.winners = blueTeamData.usernames;
      redTeamData.in_wager = false;
      blueTeamData.in_wager = false;
      await redTeamData.save();
      await blueTeamData.save();
    } else {
      // not final round, continue tournament
      if (teamnum === 1) {
        // take red team out of tournament
        redTeamData.in_wager = false;
      } else {
        // take blue team out of tournament
        blueTeamData.in_wager = false;
      }
      // update both teams
      await redTeamData.save();
      await blueTeamData.save();

      const roundMatches = tourneyToJoin.bracket.matches[round - 1];
      let matchesCompleted = 0;
      for (let i = 0; i < roundMatches.length; i++) {
        if (roundMatches[i].blueteamid === data.blueteamid) {
          roundMatches[i].winner = teamnum;
        }
        if (roundMatches[i].winner !== -1) {
          matchesCompleted++;
        }
      }

      // check if all matches for the round are completed
      if (matchesCompleted === roundMatches.length) {
        // change round and start next one
        tourneyToJoin.bracket.round++;

        let i = 0;
        let nextRound = [];
        while (i < roundMatches.length) {
          const firstMatchWinner =
            roundMatches[i].winner === 1
              ? roundMatches[i].blueteamid
              : roundMatches[i].redteamid;
          if (i === roundMatches.length - 1) {
            break;
          }
          const secondMatchWinner =
            roundMatches[i + 1].winner === 1
              ? roundMatches[i + 1].blueteamid
              : roundMatches[i + 1].redteamid;

          const nextMatch = new MatchData({
            redteamid: secondMatchWinner,
            blueteamid: firstMatchWinner,
            winner: -1,
          });
          nextRound.push(nextMatch);
          i += 2;
        }
        // generate next round matches

        for (let i = 0; i < nextRound.length; i++) {
          const blueTeamData = await TeamData.findOne({
            _id: nextRound[i].blueteamid,
          });
          const redTeamData = await TeamData.findOne({
            _id: nextRound[i].redteamid,
          });
          await generateTournamentMatch(
            blueTeamData._id,
            redTeamData._id,
            blueTeamData.usernames,
            redTeamData.usernames,
            tourneyToJoin,
            nextRound[i],
            io
          );
        }

        tourneyToJoin.bracket.matches[round] = nextRound;
      }
    }
    tourneyToJoin.prize_dist = prizeDistObj;
    await tourneyToJoin.save();

    io.in(tourneyToJoin._id.toString()).emit(
      NEW_BRACKET_UPDATE_EVENT,
      tourneyToJoin
    );

    wager.state = wager?.DONE_STATE;
    wager.winner = teamnum;
    await wager.save();
    const token = await getUnlinkedTokenObject(wager?.wagerid);
    io.in(token.wagerid).emit("newSubmit", token);

    return token;
  } catch (err) {
    console.log(err);
    return;
  }
};
const generateTournamentMatch = async (
  blueteamid,
  redteamid,
  blueteam_users,
  redteam_users,
  tourney,
  match,
  io
) => {
  try {
    const uuid = uuidv4();

    const unique_value = hash({
      blueteamid,
      redteamid,
      uuid,
    });
    // wager object without states on it being created
    let newWagerObj = {
      unique_value: unique_value,
      blueteamid: blueteamid,
      redteamid: redteamid,
      blueteam_users: blueteam_users,
      redteam_users: redteam_users,
      entry_fee: 0,
      region: tourney.region,
      match_type: tourney.match_type,
      team_size: tourney.team_size,
      first_to: tourney.first_to,
      done: false,
      chat: [],
      cancelled: false,
      paid_entry: false,
      paid_prizes: false,
      console_only: false,
      password: "",
      game: tourney.game,
      rematchSent: false,
      rematchAccepted: false,
      isTourneyMatch: true,
      tourneyId: tourney._id,
      showme: null,
    };
    const newWager = new WagerData(newWagerObj);
    await newWager.save();
    const allUsers = blueteam_users.concat(redteam_users);

    // create wager obj with states
    const newWagerObjData = new WagerObjectData({
      wagerid: newWager._id,
      blueteamid: newWager?.blueteamid,
      redteamid: newWager?.redteamid,
      blue_users: newWager?.blueteam_users,
      red_users: newWager?.redteam_users,
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
      timer: 500,
      isTourneyMatch: true,
    });
    await newWagerObjData.save();
    for (let i = 0; i < blueteam_users.length; i++) {
      const blueuserdata = await UserData.findOne({
        username: blueteam_users[i],
      });
      const reduserdata = await UserData.findOne({
        username: redteam_users[i],
      });

      let newNotification = {
        read: false,
        body: "You are now in a new tournament match.",
        attached: newWager._id,
        type: "new_match",
        actionable: false,
        timestamp: new Date(),
      };
      blueuserdata.notifications.addToSet(newNotification);
      reduserdata.notifications.addToSet(newNotification);
      await blueuserdata.save();
      await reduserdata.save();
      io.in(blueuserdata.username).emit(
        NEW_NOTIFICATION_EVENT,
        newNotification
      );
      io.in(reduserdata.username).emit(NEW_NOTIFICATION_EVENT, newNotification);
    }
    setTimeout(() => {
      WagerObjectData.findOne(
        { wagerid: newWagerObjData.wagerid },
        (err, updatedwagerdata) => {
          if (err) {
            console.log(err);
            return;
          }

          if (updatedwagerdata.state === 1) {
            // give auto win
            let teamNum = 0;
            let blue_readied_users = [];
            let red_readied_users = [];
            for (let i = 0; i < updatedwagerdata?.readied_users?.length; i++) {
              if (updatedwagerdata?.is_readied[i] === true) {
                if (
                  updatedwagerdata?.blue_users.includes(
                    updatedwagerdata?.readied_users[i]
                  )
                ) {
                  blue_readied_users.push(updatedwagerdata?.readied_users[i]);
                }
                if (
                  updatedwagerdata?.red_users.includes(
                    updatedwagerdata?.readied_users[i]
                  )
                ) {
                  red_readied_users.push(updatedwagerdata?.readied_users[i]);
                }
              }
            }
            //if more red readied users than blue
            if (red_readied_users.length > blue_readied_users.length) {
              //red winner
              teamNum = 2;
            } else {
              //blue winner
              teamNum = 1;
            }
            bracketTournamentWin(updatedwagerdata, teamNum, io);
          }
        }
      );
    }, 300 * 1000);

    const blueteamdata = await TeamData.findOne({
      _id: newWager?.blueteamid,
    });
    const redteamdata = await TeamData.findOne({
      _id: newWager?.redteamid,
    });

    if (!blueteamdata || !redteamdata) {
      return;
    }

    blueteamdata.wager_id = newWager._id;
    await blueteamdata?.save();

    redteamdata.wager_id = newWager._id;
    await redteamdata?.save();

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
      match.redteam_users.push(redUserObj);
      match.blueteam_users.push(blueUserObj);
    }

    match._id = newWager._id;
    await tourney.save();
    allUsers.forEach((user) => {
      io.in(user).emit(NEW_CURRENT_TOKEN_EVENT, newWager._id);
    });
    return match._id;
  } catch (err) {
    console.log(err);
    return;
  }
};

module.exports = {
  generateTournamentMatch,
  bracketTournamentWin,
};

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
const {
  getCurrentTokenGame,
  getCurrentTokenPrize,
  getCurrentTokenTitle,
} = require("./tokenHelpers");
const getUnlinkedTokenObject = async (tokenId) => {
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

module.exports = {
  getUnlinkedTokenObject,
};

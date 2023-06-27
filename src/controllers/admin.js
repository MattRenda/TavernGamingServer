const { UserData } = require("../models/User");
const { WithdrawData } = require("../models/Withdraw");
const {
  getUserToken,
  getUsernameFromToken,
} = require("../utils/helperMethods");

const getAllPendingWithdraws = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  const requestinguserdata = await UserData.findOne({ username });
  if (requestinguserdata?.role < 501) {
    return res.status(401).send();
  }

  let withdrawdata = await WithdrawData.find({ processed: false });

  let withdrawSet = {};
  let processedSet = [];
  for (let i = 0; i < withdrawdata.length; i++) {
    const userToCheck = withdrawdata[i]?.username;
    const userdata = await UserData.findOne({ username: userToCheck });
    if (
      !(
        userdata?.is_banned &&
        new Date(userdata?.unban_timestamp).getFullYear() === 2050
      )
    ) {
      withdrawSet[userToCheck] = userdata?.is_banned == true;
      processedSet.push(withdrawdata[i]);
    }

    // console.log(
    //   (userdata?.is_banned == true &&
    //     new Date(userdata?.unban_timestamp).getFullYear() === 2050) +
    //     " for " +
    //     userdata?.username
    // );
    // console.log(processedSet.length);
    // console.log(
    //   (userdata?.is_banned == true &&
    //     new Date(userdata?.unban_timestamp).getFullYear() !== "2050") +
    //     " for" +
    //     userdata?.username
    // );
  }
  return res.status(200).send({
    error: null,
    withdraws: processedSet,
    bannedSet: withdrawSet,
  });
};

module.exports = {
  getAllPendingWithdraws,
};

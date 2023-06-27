const { EarningsData } = require("../models/Earnings");
const { UserData } = require("../models/User");

const getTotalEarningsLeaderboard = async (req, res) => {
  const areEqual = (obj1, obj2) => {
    if (obj1 == null || obj2 == null) {
      return [false];
    }
    const avatar1Keys = Object.keys(obj1);
    return avatar1Keys.map((key) => obj1[key] === obj2[key]);
  };

  try {
    const allEarnings = await EarningsData.find({})
      .sort({ total: -1 })
      .limit(100);

    for (let i = 0; i < allEarnings.length; i++) {
      const userdata = await UserData.findOne({
        username: allEarnings[i].username,
      });
      if (
        userdata?.is_banned &&
        new Date(userdata?.unban_timestamp).getFullYear() === 2050
      ) {
        console.log(
          "Removing " +
            userdata?.username +
            " from leaderboard because they are permanently banned."
        );
        await allEarnings[i].remove();
      }
      // console.log(allEarnings[i].avatar[0], allEarnings[i].username);
      if (
        areEqual(allEarnings[i].avatar[0], userdata.avatar[0]).includes(
          false
        ) &&
        userdata?.avatar?.length > 0
      ) {
        allEarnings[i].avatar[0] = userdata.avatar[0];
        console.log("Updating avatar for " + allEarnings[i].username);
        await allEarnings[i].save();
      }
    }
    return res.status(200).send({ error: null, leaderboard: allEarnings });
  } catch (err) {
    console.log(err);
    return;
  }
};

module.exports = {
  getTotalEarningsLeaderboard,
};

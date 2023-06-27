const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
  },
  signups: Number,
  users: [String],
  username: String,
});
const ReferralData = mongoose.model("Referrals", referralSchema, "Referrals");


module.exports = {
  ReferralData,
};

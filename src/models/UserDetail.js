const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const UserDetail = new mongoose.Schema({ email: String, ips: [String], name: String, dob: String });
UserDetail.plugin(passportLocalMongoose);

const UserDetails = mongoose.model("Users", UserDetail, "Users");

module.exports = {
  UserDetail,
  UserDetails,
};

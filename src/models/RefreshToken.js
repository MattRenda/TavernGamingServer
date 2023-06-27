const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema({
  token: String,
  user: String,
});

const RefreshTokenData = mongoose.model("RefreshToken", RefreshTokenSchema);
module.exports = { RefreshTokenSchema, RefreshTokenData };

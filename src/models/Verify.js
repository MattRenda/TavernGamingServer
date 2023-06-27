const mongoose = require("mongoose");

const verifySchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
  },
  verified: Boolean,
  code: String,
});
const VerifyData = mongoose.model(
  "Verifications",
  verifySchema,
  "Verifications"
);

module.exports = {
  VerifyData,
};

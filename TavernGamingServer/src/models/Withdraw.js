const mongoose = require("mongoose");

const WithdrawSchema = new mongoose.Schema({
  username: String,
  paypal: String,
  amount: Number,
  time: Date,
  unique_value: {
    type: String,
    unique: true,
    sparse: true,
  },
  processed: Boolean,
  fullName: String,
  currency: String,

});
const WithdrawData = mongoose.model("Withdraws", WithdrawSchema, "Withdraws");
// WithdrawData.createIndexes();

module.exports = {
  WithdrawData,
};

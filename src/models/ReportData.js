const mongoose = require("mongoose");

const ReportDataSchema = new mongoose.Schema({
  username: String,
  note: String,
  author: String,
  timestamp: String,
  tokenId: String,
});
const ReportData = mongoose.model("ReportData", ReportDataSchema, "ReportData");

module.exports = { ReportData };

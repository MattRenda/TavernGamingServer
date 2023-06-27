const mongoose = require("mongoose");

const TourneyProfitSchema = new mongoose.Schema({
  tourneyId: {
    type: String,
    unique: true,
  },
  profit: {
    type: Number,
  },
});

const TourneyProfitData = mongoose.model(
  "TourneyProfitData",
  TourneyProfitSchema,
  "TourneyProfitData"
);

module.exports = {
  TourneyProfitData,
};

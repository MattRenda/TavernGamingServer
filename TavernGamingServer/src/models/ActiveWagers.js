const mongoose = require("mongoose");


const ActiveWagersSchema = new mongoose.Schema({
  wagerid: {
    unique: true,
    type: String
  },
});

const ActiveWagerData = mongoose.model('ActiveWagerData', ActiveWagersSchema, 'ActiveWagerData');

module.exports = {
  ActiveWagerData,
};

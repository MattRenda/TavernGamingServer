const mongoose = require("mongoose");


const ProfitSchema = new mongoose.Schema({
  wagerId: {
    type: String,
    unique: true,
  },
  profit: {
    type: Number,
  },
});

const ProfitData = mongoose.model('ProfitData', ProfitSchema, 'ProfitData');


module.exports = {
   ProfitData ,
};

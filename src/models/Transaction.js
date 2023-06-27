const mongoose = require("mongoose");


const DepositSchema = new mongoose.Schema({
    transactionId:String,
    amount: String,
    currency: String,
    date: String,
    email: String,
    items: String,
    name: String,
    note: String,
    payment_method: String,
    quantities: String,
    status: String,
    transaction: String
  });
 
const DepositData = mongoose.model('DepositData', DepositSchema, 'DepositData');

module.exports = {
    DepositData,
  };
  
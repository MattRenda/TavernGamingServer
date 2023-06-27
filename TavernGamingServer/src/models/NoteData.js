const mongoose = require("mongoose");

const NoteDataSchema = new mongoose.Schema({
  username: String,
  note: String,
  author: String,
  timestamp: String,
});
const NoteData = mongoose.model("NoteData", NoteDataSchema, "NoteData");


module.exports = { NoteData, NoteDataSchema };

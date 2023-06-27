const mongoose = require("mongoose");

const AvatarSchema = new mongoose.Schema({
  username: {
    type: String,
    index: true,
  },
  options: {
    topType: String,
    accessoriesType: String,
    hatColor: String,
    hairColor: String,
    facialHairType: String,
    facialHairColor: String,
    clotheType: String,
    clotheColor: String,
    graphicType: String,
    eyeType: String,
    eyebrowType: String,
    mouthType: String,
    skinColor: String,
  },
});

const AvatarData = mongoose.model("AvatarData", AvatarSchema, "AvatarData");
// AvatarData.createIndexes();

module.exports = { AvatarData };

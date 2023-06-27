const { io } = require("../../index");

const sendNewEpicEvent = (epic, username) => {
  io.in(username).emit("newEpic", epic);
};

module.exports = {
  sendNewEpicEvent,
};

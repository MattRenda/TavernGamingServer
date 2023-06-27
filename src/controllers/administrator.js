const { UserData } = require("../models/User");
const { ReferralData } = require("../models/Referral");
const { VerifyData } = require("../models/Verify");
const { constants } = require("../utils/constants");
const _ = require("passport-local-mongoose");
const {
  getUserByName,
  getUserIdFromToken,
  getUserToken,
  getUsernameFromToken,
} = require("../utils/helperMethods");
const { VerifyEpicData } = require("../models/Epic");
const { UserDetails } = require("../models/UserDetail");
const { WagerObjectData } = require("../models/WagerObject");
const { NoteData } = require("../models/NoteData");
const { DepositData } = require("../models/Transaction");
const { WagerData } = require("../models/Wager");
const { ReportData } = require("../models/ReportData");

const reactAppRoute = constants.clientURL;

// CONTROLLER FOR ADMIN PANEL AND ADMIN AUTH

const getAdminStats = async (req, res) => {
  var currentUser = req.params.username;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);
  const userDetails = await UserDetails.findOne({ username: currentUser });

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    }
    getUserByName(currentUser, (returneduserdata) => {
      if (!returneduserdata) {
        return res.status(409).send("No user found with that username.");
      } else {
        //// console.log(returneduserdata.match_history);
        const email = userDetails?.email;
        let userData = { ...returneduserdata?._doc, email };
        res.status(200).send(userData);
      }
    });
  });
};

const getAdminStatsByEpic = async (req, res) => {
  var currentUser = req.params.epic;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    }
    UserData.findOne({ epic: currentUser }, (err, returneduserdata) => {
      if (err) {
        return;
      } else {
        UserDetails.findOne(
          { username: returneduserdata?.username },
          (err, userdetail) => {
            if (err) {
              return;
            }
            if (userdetail) {
              const email = userdetail.email;
              const newuserdata = { ...returneduserdata?._doc, email };
              return res.status(200).send(newuserdata);
            } else {
              return;
            }
          }
        );
      }
    });
  });
};

const getAdminStatsByEmail = async (req, res) => {
  var currentUser = req.params.email;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      UserDetails.findOne({ email: currentUser }, (err, userdetaildata) => {
        if (err) {
          return;
        } else if (userdetaildata) {
          UserData.findOne(
            { username: userdetaildata.username },
            (err, returneduserdata) => {
              UserDetails.findOne(
                { username: returneduserdata?.username },
                (err, userdetail) => {
                  if (err) {
                    return;
                  }
                  const email = userdetail.email;
                  const newuserdata = { ...returneduserdata?._doc, email };
                  return res.status(200).send(newuserdata);
                }
              );
            }
          );
        } else {
          return res
            .status(409)
            .send({ error: true, message: "No user with this email." });
        }
      });
    }
  });
};

const getDisputes = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }

    if (userdata.role < 100) {
      return res.status(409).send();
    }

    WagerObjectData.find({ state: 4 }, (err, data) => {
      var ids = [];

      for (var i = 0; i < data.length; i++) {
        ids.push(data[i].wagerid);
      }

      res.send(JSON.stringify(ids));
    });
  });
};

const addNote = async (req, res) => {
  var currentUser = req.body.username;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      const Note = new NoteData({
        username: currentUser,
        note: req.body.note,
        author: userdata.username,
        timestamp: new Date(),
      });
      Note.save();
      res.status(200).send();
    }
  });
};

const addUserReportNote = async (req, res) => {
  const userToReport = req.body.username;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);
  const tokenId = req.body.tokenId;

  try {
    const userdata = await UserData.findOne({ username });
    if (!userdata) {
      return res
        .status(409)
        .send({ error: true, message: "Could not find user." });
    }
    const reportToCheck = await ReportData.findOne({
      username: userToReport,
      tokenId: tokenId,
      author: username,
    });
    if (reportToCheck) {
      return res
        .status(409)
        .send({ error: true, message: "Already reported this user once." });
    }
    const Report = new ReportData({
      username: userToReport,
      note: req.body.note,
      author: username,
      timestamp: new Date(),
      tokenId: tokenId,
    });

    await Report.save();
    return res.status(200).send({ error: null });
  } catch (err) {
    console.log(err);
    return res
      .status(409)
      .send({ error: true, message: "Could not report user." });
  }
};

const verifyUserPanel = async (req, res) => {
  var currentUser = req.body.username;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      UserData.findOne({ username: currentUser }, (err, userVerifyData) => {
        // console.log(currentUser);
        userVerifyData.role = 2;
        userVerifyData.save();
      });

      VerifyData.findOne({ username: currentUser }, (err, userVerifyData) => {
        if (userVerifyData) {
          userVerifyData.verified = true;
          userVerifyData.save();
        } else {
          res.status(409).send();
        }
      });
    }
  });
};

const addCode = async (req, res) => {
  var currentCode = req.body.code;
  var usernameOfCode = req.body.username;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 500) {
      return res.status(409).send();
    } else {
      const Referral = new ReferralData({
        code: currentCode,
        signups: 0,
        users: [],
        username: usernameOfCode,
      });
      Referral.save({}, (err, data) => {
        if (err) {
          return res.status(409).send();
        }
        return res.status(200).send(Referral);
      });
    }
  });
};

const getNotes = async (req, res) => {
  var currentUser = req.params.username;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      NoteData.find({ username: currentUser }, (err, data) => {
        // console.log(data.map(item => item.note));
        res.send(data.map((item) => item.note + " On: " + item.timestamp));
      });
    }
  });
};

const getReports = async (req, res) => {
  const user = req.params.username;

  try {
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);

    const userdata = await UserData.findOne({ username });
    if (!userdata || userdata?.role < 300) {
      return res.status(409).send({
        error: true,
        message: "You do not have the perms to view reports!",
      });
    }

    const reportdata = await ReportData.find({ username: user });
    if (!reportdata || reportdata?.length < 1) {
      return res.status(200).send([]);
    }
    return res
      .status(200)
      .send(
        reportdata?.map((report) => report?.note + " on: " + report?.timestamp)
      );
  } catch (err) {
    console.log(err);
    return;
  }
};

const unbanPlayer = async (req, res) => {
  var currentUser = req.body.username;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      UserData.findOne({ username: currentUser }, (err, data) => {
        // console.log(data.map(item => item.note));
        data.is_banned = false;
        if (data.pun_points >= 5000) {
          data.pun_points -= 5000;
        }
        data.save({}, (err, errordata) => {
          if (err) {
            return;
          } else {
            const Note = new NoteData({
              username: currentUser,
              note: userdata.username + " unbanned this user.",
              author: userdata.username,
              timestamp: new Date(),
            });
            Note.save({}, (err, returneduserdata) => {
              if (err) {
                return;
              }
              const AnotherNote = new NoteData({
                username: userdata.username,
                note: userdata.username + " unbanned " + currentUser,
                author: userdata.username,
                timestamp: new Date(),
              });
              AnotherNote.save({}, (err, data) => {
                if (err) {
                  return;
                }
              });
            });
            res.status(200).send();
          }
        });
      });
    }
  });
};

const banPlayerChargeback = async (req, res) => {
  var currentUser = req.body.username;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      UserData.findOne({ username: currentUser }, (err, data) => {
        // console.log(data.map(item => item.note));
        data.is_banned = true;
        data.pun_points += 5000;
        var date = new Date();
        date.setFullYear(2050);
        data.unban_timestamp = date;
        data.save({}, (err, errordata) => {
          if (err) {
            return;
          } else {
            const Note = new NoteData({
              username: currentUser,
              note: userdata.username + " banned this user for charging back.",
              author: userdata.username,
              timestamp: new Date(),
            });
            Note.save({}, (err, returneduserdata) => {
              if (err) {
                return;
              }
              const AnotherNote = new NoteData({
                username: userdata.username,
                note:
                  userdata.username +
                  " banned " +
                  currentUser +
                  " for charging back.",
                author: userdata.username,
                timestamp: new Date(),
              });
              AnotherNote.save();
            });
            res.status(200).send();
          }
        });
      });
    }
  });
};

const banPlayer = async (req, res) => {
  var currentUser = req.body.username;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      UserData.findOne({ username: currentUser }, (err, data) => {
        // console.log(data.map(item => item.note));
        data.is_banned = true;
        data.pun_points += 5000;
        var date = new Date();
        date.setFullYear(2050);
        data.unban_timestamp = date;
        data.save({}, (err, errordata) => {
          if (err) {
            return;
          } else {
            const Note = new NoteData({
              username: currentUser,
              note: userdata.username + " banned this user.",
              author: userdata.username,
              timestamp: new Date(),
            });
            Note.save({}, (err, returneduserdata) => {
              if (err) {
                return;
              }
              const AnotherNote = new NoteData({
                username: userdata.username,
                note: userdata.username + " banned " + currentUser,
                author: userdata.username,
                timestamp: new Date(),
              });
              AnotherNote.save();
            });
            res.status(200).send();
          }
        });
      });
    }
  });
};

const resetEpic = async (req, res) => {
  var currentUser = req.body.username;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, adminuserdata) => {
    if (!adminuserdata.role) {
      return res.status(409).send();
    }
    if (adminuserdata.role < 200) {
      return res.status(409).send();
    } else {
      VerifyEpicData.findOne({ username: currentUser }, (err, data) => {
        UserData.findOne({ username: currentUser }, (err, userdata) => {
          if (data) {
            data.remove();
          }
          if (userdata) {
            userdata.epic = "";
          } else {
            return;
          }
          userdata.save({}, (err, errordata) => {
            if (err) {
              return;
            } else {
              const Note = new NoteData({
                username: currentUser,
                note: adminuserdata.username + " reset this user's epic.",
                author: userdata.username,
                timestamp: new Date(),
              });
              Note.save();
              res.status(200).send();
            }
          });
        });
      });
    }
  });
};

const makeStaffArray = (staffdata) => {
  const staffArray = staffdata?.map((staff) => {
    return staff?.username;
  });
  return staffArray;
};

const makeLogsArray = async (staffArray) => {
  let logsArray = [];
  for (let i = 0; i < staffArray.length; i++) {
    const data = await NoteData.find({ username: staffArray[i] });
    logsArray.push(data);
  }
  return logsArray?.flat();
};

const getLogs = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  const userdata = await UserData.findOne({ username: username });

  if (!userdata.role) {
    return res.status(409).send();
  }
  if (userdata.role < 300) {
    return res.status(409).send();
  } else {
    const staffdata = await UserData.find({ role: { $gt: 100 } });

    const staffArray = await makeStaffArray(staffdata);
    const logsArray = await makeLogsArray(staffArray);
    return res.send(logsArray);
  }
};

const checkForAlts = async (req, res) => {
  var currentUser = req.params.username;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username }, (err, userdata) => {
    if (err) {
      console.log("error 0");
      return res.status(409).send();
    }
    if (!userdata.role) {
      console.log("error 1");
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      console.log("error 2");
      return res.status(409).send();
    } else {
      UserDetails.findOne({ username: currentUser }, (err, useripdata) => {
        if (err) {
          return res.status(409).send();
        }
        if (useripdata && useripdata.ips.length > 0) {
          for (let i = 0; i < useripdata.ips.length; i++) {
            UserDetails.find(
              { ips: useripdata.ips[i] },
              (err, usermatchingipdata) => {
                if (err) {
                  console.log("error 1");
                  return;
                }
                if (usermatchingipdata) {
                  if (err) {
                    console.log("error 2");
                    return;
                  }
                  if (res.headersSent) {
                    console.log("error 3");
                    return;
                  } else {
                    // console.log("success");
                    res.status(200).send(usermatchingipdata);
                  }
                } else {
                  console.log("no alts but yes userdataip");
                  return res.status(200).send([{ username: "No Alts" }]);
                }
              }
            );
          }
        } else {
          console.log("no alts and no userdataip");
          return res.status(200).send([{ username: "No Alts" }]);
        }
      });
    }
  });
};

const promoteUser = async (req, res) => {
  var currentUser = req.body.username;
  var role = req.body.role;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 500) {
      return res.status(409).send();
    } else {
      UserData.findOne({ username: currentUser }, (err, promouserdata) => {
        if (err) {
          return;
        }
        if (promouserdata) {
          promouserdata.role = role;
          promouserdata.save({}, (err, promousersavedata) => {
            const Note = new NoteData({
              username: currentUser,
              note: username + " changed this user's role to: " + role,
              author: username,
              timestamp: new Date(),
            });
            Note.save({}, (err, notetwo) => {
              if (err) {
                return;
              }
              const AnotherNote = new NoteData({
                username: username,
                note:
                  username +
                  " changed + " +
                  currentUser +
                  "'s role to: " +
                  role,
                author: username,
                timestamp: new Date(),
              });
              AnotherNote.save({}, (err, data) => {
                if (err) {
                  return;
                }
              });
            });
            res.status(200).send();
          });
        }
      });
    }
  });
};

const getReferrals = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  const referraldata = await ReferralData.find({});
  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 500) {
      return res.status(409).send();
    } else {
      res.status(200).send(referraldata);
    }
  });
};
const getDepositByID = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);
  const transactionId = req.params.transactionId;

  const depositInfo = await DepositData.findOne({
    transactionId: transactionId,
  });
  UserData.findOne({ username: username }, (err, userdata) => {
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 300) {
      return res.status(409).send();
    } else {
      if (depositInfo) {
        UserData.findOne({ username: depositInfo.name }, (err, data) => {
          return res.status(200).send(data);
        });
      } else {
        return res.status(409).send({
          error: true,
          message: "No deposit associated with this ID.",
        });
      }
    }
  });
};

const getValMatches = async (req, res) => {
  const valWagers = await WagerData.find({
    cancelled: false,
    game: "VAL",
    redteam_users: { $gt: 0 },
  });
  if (valWagers) {
    res.status(200).send({ error: null, valWagers: valWagers });
  }
  res.status(200).send({ error: true, message: "No Val wagers." });
};

module.exports = {
  getAdminStats,
  getDisputes,
  addNote,
  addCode,
  getNotes,
  verifyUserPanel,
  unbanPlayer,
  banPlayer,
  getAdminStatsByEpic,
  resetEpic,
  getAdminStatsByEmail,
  getLogs,
  promoteUser,
  getReferrals,
  checkForAlts,
  getDepositByID,
  addUserReportNote,
  getValMatches,
  getReports,
  banPlayerChargeback,
};

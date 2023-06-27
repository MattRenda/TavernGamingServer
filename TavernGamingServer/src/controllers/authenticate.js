const passport = require("passport");
const { UserData } = require("../models/User");
const log = require("log-to-file");
const jwt = require("jsonwebtoken");
const { UserDetails } = require("../models/UserDetail");
const { TeamData } = require("../models/Team");
const { RefreshTokenData } = require("../models/RefreshToken");
const {
  generateVerifyCode,
  getUserToken,
  getUsernameFromToken,
} = require("../utils/helperMethods");
const { ReferralData } = require("../models/Referral");
const { VerifyData } = require("../models/Verify");
const { DepositData } = require("../models/Transaction");
const { WithdrawData } = require("../models/Withdraw");
const { constants } = require("../utils/constants");
const { machineId, machineIdSync } = require("node-machine-id");
var ageCalculator = require("age-calculator");
let { AgeFromDateString, AgeFromDate } = require("age-calculator");
const {
  generateRandomAvatarOptions,
} = require("../utils/generateRandomAvatarOptions");
const { VerifyEpicData } = require("../models/Epic");
const { EarningsData } = require("../models/Earnings");

const reactAppRoute = constants.clientURL;

// CONTROLLER FOR USER AUTHENTICATION

function getUserByName(username, callback) {
  UserData.findOne({ username: username }, (err, userdata) => {
    if (err) {
      log(err);
    }

    callback(userdata);
  });
}

function getCallerIP(request) {
  var ip =
    request.headers["x-forwarded-for"] ||
    request.connection.remoteAddress ||
    request.socket.remoteAddress ||
    request.connection.socket.remoteAddress;
  ip = ip.split(",")[0];
  ip = ip.split(":").slice(-1); //in case the ip returned in a format: "::ffff:146.xxx.xxx.xxx"
  return ip.toString();
}

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.REFRESH_SECRET);
};

// log the user in
const login = async (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", reactAppRoute);
  let id = await machineId();
  let id2 = await machineIdSync({ original: true });
  const randomAvatar = generateRandomAvatarOptions();
  const userTeams = await TeamData.find({ usernames: req.body.username });
  const depositData = await DepositData.find({ name: req.body.username });
  const withdrawData = await WithdrawData.find({ username: req.body.username });
  const verifyEpicData = await VerifyEpicData.find({
    username: req.body.username,
  });

  passport.authenticate("local", (err, user) => {
    // console.log("user: ", user);
    if (err) {
      // console.log("next", err);
      return next(err);
    }

    if (!user) {
      return res.send({
        error: true,
        message: "Username or password is incorrect.",
      });
    }

    getUserByName(user.username, (userdata) => {
      if (userdata == null) {
        return res.send({
          error: true,
          message: "Only Premium and Beta users can log in.",
        });
      }
      if (!userdata["role"] || userdata.role == 3) {
        return res.send({
          error: true,
          message:
            "You can no longer login with Alpha accounts. Feel free to register a new one!",
        });
      }
      if (!userdata) {
        return;
      } else if (userdata && userdata.avatar.length == 0) {
        userdata.avatar = randomAvatar;
        userdata.save({}, (err, data) => {
          if (err) {
            console.log(err);
            return;
          }
        });
      }

      if (userdata?.is_banned) {
        var date = new Date();
        date.setDate(date.getDate());
        // console.log(date);
        var bandate = new Date();
        bandate.setDate(userdata.unban_timestamp.getDate());
        // console.log(bandate);
        // console.log(bandate > date);

        if (userdata.unban_timestamp < date) {
          userdata.is_banned = false;
          userdata.save({}, (err, savedata) => {
            if (err) {
              return;
            }
          });
        } else {
          return res.send({
            error: true,
            message:
              "You are currently banned until " + userdata.unban_timestamp,
          });
        }
      }

      VerifyData.findOne({ username: user.username }, (err, verifyData) => {
        if (err) {
          log(err);
          // console.log("no verify: ", err);
        }
        if (verifyData && verifyData.verified == false) {
          return res.send({
            error: true,
            message: "Please verify your email!",
          });
        } else {
          req.logIn(user, function (err) {
            if (err) {
              return next(err);
            }

            // console.log(user.username.toString() + " logged in");

            // Generate Tokens
            const accessToken = generateAccessToken(userdata._id);
            const refreshToken = generateRefreshToken(userdata._id);

            RefreshTokenData.findOne(
              {
                user: userdata.username,
              },
              (err, tokenData) => {
                if (err) {
                  return res.status(500).json({ error: true, message: err });
                }
                if (!tokenData) {
                  const refreshTokenModel = new RefreshTokenData({
                    token: refreshToken,
                    user: userdata.username,
                  });
                  refreshTokenModel.save();
                } else {
                  tokenData.token = refreshToken;
                  tokenData?.save();
                }
              }
            );

            UserDetails.findOne(
              { username: userdata.username },
              (err, data) => {
                const iptosave = getCallerIP(req);

                // console.log(id);
                // console.log(id2);
                if (err) {
                  return;
                }
                if (iptosave.length >= 3 || id) {
                  if (data) {
                    if (!data.ips.includes(iptosave)) {
                      data.ips.addToSet(iptosave);
                    }
                    if (!data.ips.includes(id) || !data.ips.includes(id2)) {
                      data.ips.addToSet(id);
                      data.ips.addToSet(id2);
                    }

                    data.save({}, (err, data) => {
                      if (err) {
                        return;
                      }
                    });
                  } else {
                    return;
                  }
                }
              }
            );

            let newMatchHistory = userdata?._doc.match_history;
            const reversedMatchHistory = newMatchHistory?.reverse();
            userdata._doc.match_history = [...reversedMatchHistory];

            EarningsData.findOne(
              { username: userdata.username },
              (err, earningsData) => {
                if (!earningsData) {
                  const earnedData = new EarningsData({
                    username: userdata.username,
                    BF: 0,
                    ZW: 0,
                    REAL: 0,
                    PG: 0,
                    END: 0,
                    FIVEM: 0,
                    total: 0,
                    wins: 0,
                    losses: 0,
                    eliteTrophies: 0,
                    goldTrophies: 0,
                    silverTrophies: 0,
                    bronzeTrophies: 0,
                    avatar: [],
                  });
                  earnedData.save();
                }
              }
            );

            return res.status(200).send({
              error: null,
              user: {
                ...userdata?._doc,
                userTeams: userTeams || null,
                depositData: depositData || null,
                withdrawData: withdrawData || null,
                verifyEpicData: verifyEpicData,
              },
              accessToken,
              refreshToken,
            });
          });
        }
      });
    });
  })(req, res, next);
};

// register the user
const register = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", reactAppRoute);
  const username = req.body.username.toString().toLowerCase();
  const password = req.body.password.toString();
  const email = req.body.email.toString().toLowerCase();
  const promoCode = req.body.promo;
  const name = req.body.name;
  const dob = req.body.dob;

  let ageFromString = new AgeFromDateString(dob).age;
  if (ageFromString < 13) {
    return res.send({
      error: true,
      message: "You must be over 13 years of age to register.",
    });
  }

  if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,5})+$/.test(email)) {
    return res.send({
      error: true,
      message: "Invalid Email Format",
    });
  }

  if (!/^[a-zA-Z0-9_]*$/.test(username)) {
    return res.send({
      error: true,
      message: "Username may only contain letter, number, and underscores.",
    });
  }

  if (!username || !password || !email) {
    return res.send({
      error: true,
      message: "Please fill out all fields.",
    });
  }
  UserDetails.countDocuments({ email: email }, (err, count) => {
    if (count != 0) {
      return res.send({
        error: true,
        message: "Email is already registered.",
      });
    }

    UserDetails.register(
      { username: username, active: false, name: name, dob: dob },
      password,
      function (err, user) {
        if (err) {
          if (err.toString().includes("UserExistsError")) {
            return res.send({
              error: true,
              message: "Username already exists.",
            });
          }
          return next(err);
        }

        if (!user) {
          return res.send({
            error: true,
            message: "No user specified.",
          });
        }

        user.email = email;
        user.save();

        var newUser = new UserData({
          username: username,
          balance: 0,
          role: 1,
          max_withdrawal: 0,
          pun_points: 0,
          is_banned: false,
          unban_timestamp: new Date(),
          prior_bans: 0,
          notifications: [],
          match_history: [],
          avatar: [],
        });
        newUser.save();

        generateVerifyCode(username, email);

        usernames = [];
        usernames.push(username);

        // create new team doc
        var newTeam = new TeamData({
          usernames: usernames,
          name: "Solo Team",
          in_wager: false,
          wager_id: "",
          wins: 0,
          losses: 0,
          win: 0,
          loss: 0,
        });
        newTeam.save();
        // const accessToken = generateAccessToken(newUser._id);
        // const refreshToken = generateRefreshToken(newUser._id);
        // const refreshTokenModel = new RefreshTokenData({
        //   token: refreshToken,
        //   user: newUser.username,
        // });
        // refreshTokenModel.save();

        if (!promoCode) {
          return res.send({ error: null, user: newUser });
        }
        ReferralData.findOne({ code: promoCode }, (err, data) => {
          if (!data) {
            return res.send({
              error: true,
              message: "Referral code does not exist!",
            });
          }
          data.signups += 1;
          data.users.push(username);
          data.save();
          log("Registered " + username);
          res.send({ error: null, user: newUser });
        });
      }
    );
  });
};

// logout user
const logout = async (req, res) => {
  try {
    const token = req.body.refreshToken;
    const username = await getUsernameFromToken(token);

    // const refreshTokenRequest = req.body.refreshToken;

    if (!token) {
      return res.status(403).json({ error: true, message: "Invalid Token" });
    }
    const decode = jwt.verify(token, process.env.REFRESH_SECRET);
    if (!decode) {
      // console.log("invalid token");
      return res.status(403).json({ error: true, message: "Invalid Token" });
    }

    RefreshTokenData.findOne({ user: username }, (err, tokendata) => {
      if (!tokendata) {
        // console.log("no token data");
        return res.status(400).json({
          error: true,
          message: "Could not find refresh token to delete",
        });
      }
      tokendata.remove();
      return res.status(200).send("success");
    });
  } catch (err) {
    console.log("CANNOT LOG OUT");
    return;
  }
};

// verify user with email
const verifyUserEmail = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", reactAppRoute);
  // res.setHeader("Access-Control-Allow-Credentials", "true");
  const verifyCode = req.body.verify_code;
  // console.log("server: " + verifyCode);
  if (!verifyCode) {
    return res.json({ error: true, message: "No Verification Code!" });
  }

  VerifyData.findOne({ code: verifyCode }, (err, data) => {
    if (data) {
      data.verified = true;
      data.save();
      return res.json({ error: null, message: "Verified", data });
    } else {
      return res.json({
        error: true,
        message: "Error verifying account. Please contact an admin!",
      });
    }
  });
};

// renew Token
const renewToken = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", reactAppRoute);
  const refreshTokenRequest = req.body.refreshToken;
  const decode = jwt.verify(refreshTokenRequest, process.env.REFRESH_SECRET);
  if (!decode) {
    // console.log("refreshToken denied: ", refreshToken);
    return res.status(403).json({ error: true, message: "Invalid Token" });
  }

  // Generate Tokens
  const accessToken = generateAccessToken(decode.userId);
  const refreshToken = generateRefreshToken(decode.userId);

  RefreshTokenData.findOne({ token: refreshTokenRequest }, (err, tokenData) => {
    if (err) {
      return res.json({ error: true, message: err });
    }
    if (!tokenData) {
      return res
        .status(403)
        .send({ error: true, message: "Token does not match existing one." });
    }
    tokenData.token = refreshToken;
    tokenData?.save({}, (err, data) => {
      // console.log("Saving a new token.");
      if (err) {
        console.log("Erroring while saving refresh token");
        return;
      }
    });
    return res.status(200).json({ error: null, accessToken, refreshToken });
  });
};

// FORGOT PASSWORD - NOT IMPLEMENTED FULLY ON SERVER OR CLIENT

// const forgot = (req, res) => {

//   var queriedEmail = req.body.email;
//   // console.log(queriedEmail);

//   // var userEmail = req.body.userEmail;
//   // // console.log(userEmail);

//   UserDetails.findOne({email: queriedEmail}, (err, data) => {
//   // console.log(data);
//   if (data) {
//   VerifyData.findOne({username: data.username}, (err, verifydata) => {

//     if (verifydata) {
//         sendForgotPwEmail(queriedEmail, verifydata.code)
//         res.redirect('/login');
//       } else {
//         res.redirect('/register?info=' + "Account with this email not found.");
//       }
//         })
//       }
//       else {
//         res.redirect('/register?info=' + "Account with this email not found.");
//       }
//   });
// };

// // ENDPOINT THAT DEALS WITH ACTUALLY CHANGING THE PASSWORD (USER ENTERS PASSWORD + CONFIRM PASSWORD, PRESSES SUBMIT, PW CHANGES)
// const forgotPass = (req, res) => {

//   // var currentCode = req.body.code;
//   // // console.log(currentCode);

//   const {firstPassword, confirmPassword, code } = req.body;

//   if (firstPassword != confirmPassword) {
//     return res.status(409).send();
//   }
//   VerifyData.findOne({code: code}, (err, verifydata) => {

//     if (verifydata) {
//       const unique_value = hash({
//         username: verifydata.username, time: new Date()
//       });
//       //// console.log("verify data found: " + data);
//       UserDetails.findOne({username: verifydata.username}, (err, userdata) => {
//         //// console.log("user data found" + userdata);
//        if (userdata) {
//          userdata.setPassword(confirmPassword,function(err, data){
//            if (err) {
//              // console.log("error setting pw : " + err)
//              return res.redirect('/register?info=' + "Error setting password. Please contact an admin or try again.");
//            }
//            else {
//              userdata.save();
//              verifydata.code = unique_value;
//              verifydata.save();
//              return res.redirect('/login');
//            }
//          });

//        }

//       })
//     } else {
//       return res.redirect('/register?info=' + "This verification code has expired. Please request a new one.");
//     }
//       })

// };

module.exports = { login, register, renewToken, logout, verifyUserEmail };
//, forgot, forgotPass

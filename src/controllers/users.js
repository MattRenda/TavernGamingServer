const { TeamData } = require("../models/Team");
const { UserData } = require("../models/User");
const { DepositData } = require("../models/Transaction");
const { WithdrawData } = require("../models/Withdraw");
const { VerifyEpicData } = require("../models/Epic");
const { AvatarData } = require("../models/Avatar");
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const SHOPIFY_SIGNATURE_SECRET = process.env.SHOPIFY_SECRET;

const {
  generateRandomAvatarOptions,
} = require("../utils/generateRandomAvatarOptions");
const {
  getUser,
  getUserIdFromToken,
  getUserToken,
  getUsernameFromToken,
} = require("../utils/helperMethods");
const {
  getUserByName,
  doesUsernameMatchToken,
} = require("../utils/helperMethods");
var hash = require("hash");
const fetch = require("node-fetch");

var async = require("async");
const { EarningsData } = require("../models/Earnings");
const NEW_USER_AVATAR_EVENT = "newAvatar";
const NEW_UPDATE_BALANCE_EVENT = "updateBalance";

const num_formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const squareIsGangStyll = async (req, res, io) => {
  const source_id = req.body.token;
  const amount = req.body.amount;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  const uuid = uuidv4();

  var myHeaders = new fetch.Headers();
  myHeaders.append("Authorization", "Bearer " + process.env.SQUARE_GANG_STYLL);
  myHeaders.append("Content-Type", "application/json");

  var raw = JSON.stringify({
    idempotency_key: uuid,
    autocomplete: true,
    amount_money: {
      amount: amount,
      currency: "USD",
    },
    source_id: source_id,
    // source_id: "cnon:card-nonce-ok",
    note: username,
    buyer_email_address: req.body.email,
  });

  var requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };
  try {
    fetch("https://connect.squareup.com/v2/payments", requestOptions)
      .then((response) => response?.json())
      .then((result) => {
        if (result.payment["status"] === "COMPLETED") {
          DepositData.findOne(
            { transactionId: result.payment["id"] },
            (err, deposit) => {
              if (err) {
                console.log(err);
                return;
              }
              if (!deposit) {
                var depositData = new DepositData({
                  transactionId: result.payment["id"],
                  amount: amount / 100,
                  currency: "USD",
                  date: result.payment["created_at"],
                  email: result.payment["buyer_email_address"],
                  items: "tokens",
                  name: username,
                  note: result.payment["receipt_url"],
                  payment_method: result.payment["source_type"],
                  quantities: 1,
                  status: result.payment["status"],
                  transaction: result.payment["id"],
                });
                depositData.save({}, (err, data) => {
                  if (err) {
                    console.log(err);
                    return;
                  }
                });
                UserData.findOne(
                  { username: result.payment["note"] },
                  (err, userdata) => {
                    if (err) {
                      console.log(err);
                    }
                    if (!userdata) {
                      return;
                    }
                    console.log(
                      "Processing $" +
                        amount / 100 +
                        " for " +
                        result.payment["note"] +
                        "'s deposit."
                    );
                    var depositValue = parseFloat(amount / 100);
                    userdata.balance += depositValue;
                    userdata.save({}, (err, data) => {
                      if (err) {
                        console.log(err);
                        return;
                      }
                      io.in(userdata.username).emit(
                        NEW_UPDATE_BALANCE_EVENT,
                        userdata.balance.toString()
                      );
                    });
                  }
                );
              }
            }
          );
        } else {
          console.log(
            "Payment failed for: " +
              username +
              " for " +
              result?.errors[0]?.detail
          );
          return res
            .status(409)
            .send({ error: true, message: result?.errors[0]?.detail });
        }
        return res.status(200).send({
          error: false,
          redirect: result.payment["receipt_url"] || null,
        });
      })

      .catch((error) => console.log("error", error));
  } catch (err) {
    console.log(err);
    return;
  }
};

const confirmPoofDeposit = (req, res) => {
  let headers = {
    "Content-Type": "application/json",
    Authorization: "mvSYJ37WUMfpkwedqAEaEg",
  };

  fetch("https://www.poof.io/api/v1/fetch_transactions", {
    method: "post",
    body: { name: "arya" },
    headers: headers,
  })
    .then((response) => response.json())
    .then((data) => {
      //// console.log(data.length);

      async.forEachOf(data, (value, key, callback) => {
        // for (const [key, value] of Object.entries(data))  {

        DepositData.find(
          { transaction: value.transaction },
          (err, depositdata) => {
            //// console.log(depositdata);
            if (depositdata.length > 0) {
              //// console.log("failed");
              return res.status(409).send();
            } else if (value.status == "yes" && value.name != null) {
              var depositData = new DepositData({
                transactionId: value.transaction,
                amount: value.amount,
                currency: value.currency,
                date: value.date,
                email: value.email,
                items: value.items,
                name: value.name.toLowerCase(),
                note: value.note,
                payment_method: value.payment_method,
                quantities: value.quantities,
                status: value.status,
                transaction: value.transaction,
              });
              depositData.save();
              UserData.findOne({ username: value.name }, (err, userdata) => {
                if (!userdata) {
                  return;
                } else {
                  console.log(
                    "Processing $" +
                      value.amount +
                      " for " +
                      userdata.username +
                      " deposit."
                  );
                  var depositValue = parseFloat(value.amount);
                  userdata.balance += depositValue;
                  userdata.save({}, (err, data) => {
                    if (err) {
                      console.log(
                        "Could not save balance for: " + userdata.username
                      );
                      return;
                    }
                  });

                  // log(
                  //   "Deposit for" +
                  //     userdata.username +
                  //     " for $" +
                  //     value.amount +
                  //     " has been processed."
                  // );
                }
              });
            }
          }
        );
      });
    });
};

const getUserById = async (req, res) => {
  const userId = req.params.userId;
  const userToken = req.headers["authorization"]?.split(" ")[1];

  const userdata = await UserData.findOne({ _id: userId });
  if (userdata) {
    const doesMatchUserToken = doesUsernameMatchToken(
      userdata.username,
      userToken
    );

    if (!doesMatchUserToken) {
      console.log("user does not match");
      return res.send({
        error: true,
        message: "You are trying to take an action for a user that is not you!",
      });
    }

    const depositData = await DepositData.find({
      name: userdata.username,
    });
    const withdrawData = await WithdrawData.find({
      username: userdata.username,
    });
    withdrawData.sort((a, b) => new Date(b.time) - new Date(a.time));
    depositData.sort((a, b) => new Date(b.date) - new Date(a.date));
    const verifyEpicData = await VerifyEpicData.find({
      username: userdata.username,
    });
    const userTeams = await TeamData.find({ usernames: userdata.username });

    let newMatchHistory = userdata?.match_history;
    const reversedMatchHistory = newMatchHistory?.reverse();
    userdata.match_history = [...reversedMatchHistory];

    let newUserObj = {
      ...userdata?._doc,
      userTeams: userTeams || null,
      depositData: depositData || null,
      withdrawData: withdrawData || null,
      verifyEpicData: verifyEpicData || null,
    };

    const earningsData = await EarningsData.findOne({
      username: userdata.username,
    });
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
      await earnedData.save();
    }
    return res.status(200).send({
      error: null,
      user: newUserObj,
    });
  }
};

const getUserTeams = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);
  TeamData.find({ usernames: username }, (err, data) => {
    if (!err) {
      res.json({
        error: null,
        teams: data,
      });
      return;
    }
    res.status(400).json({ error: true, message: err });
  });
};

const getUserByUsername = async (req, res) => {
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  if (!username) {
    return res.send({ error: true, message: "Must provide a username!" });
  }

  // getUser(username, (userdata) => {
  //   if (!userdata) {
  //     return res.send({ error: true, message: "Could not find user!" });
  //   }

  //   return res.send({ error: null, user: userdata });
  // });
  UserData.findOne({ username }, (err, userdata) => {
    if (!userdata) {
      return res.send({ error: true, message: "Could not find user!" });
    }
    return res.send({ error: null, user: userdata });
  });
};

const getUserTransactions = (req, res) => {
  const username = req.params.username;

  const userToken = req.headers["authorization"]?.split(" ")[1];

  const doesMatchUserToken = doesUsernameMatchToken(username, userToken);

  if (!doesMatchUserToken) {
    console.log("user does not match");
    return res.send({
      error: true,
      message: "You are trying to take an action for a user that is not you!",
    });
  }

  DepositData.find({ name: username }, (err, transactionData) => {
    if (err) {
      res.send({ error: true, message: err });
      return;
    }
    res.status(200).json({ error: null, transactions: transactionData });
  });
};

const getUserWithdrawals = async (req, res) => {
  const userToken = req.headers["authorization"]?.split(" ")[1];
  const userId = getUserIdFromToken(userToken);
  const userdata = await UserData.findOne({ _id: userId });
  const usernameToWithdraw =
    userdata?.role < 300 ? userdata?.username : req.params.username;

  WithdrawData.find({ username: usernameToWithdraw }, (err, withdrawalData) => {
    if (err) {
      res.send({ error: true, message: err });
      return;
    }
    res.status(200).json({ error: null, withdrawals: withdrawalData });
  });
};
const markWithdrawal = async (req, res) => {
  try {
    const unique_value = req.body.unique_value;
    const userToken = req.headers["authorization"]?.split(" ")[1];
    const userId = getUserIdFromToken(userToken);
    const userdata = await UserData.findOne({ _id: userId });
    //const unique_value = req.body.unique_value;
    if (!userdata.role) {
      return res.status(409).send();
    }
    if (userdata.role < 500) {
      return res.status(409).send();
    } else {
      const withdrawalData = await WithdrawData.findOne({ _id: unique_value });
      if (withdrawalData) {
        withdrawalData.processed = true;
        console.log("processed: " + withdrawalData.username);
        await withdrawalData.save();
        return res
          .status(200)
          .send({ error: false, message: "Successfully marked withdrawal." });
      } else {
        return res
          .status(409)
          .send({ error: true, message: "This withdrawal does not exist." });
      }
    }
  } catch (err) {
    if (!res.headersSent) {
      return res
        .status(409)
        .send({ error: true, message: "Error saving withdrawal." });
    }
  }
};

const getUserDeposits = async (req, res) => {
  const userToken = req.headers["authorization"]?.split(" ")[1];
  const userId = getUserIdFromToken(userToken);
  const userdata = await UserData.findOne({ _id: userId });
  const usernameToDeposit =
    userdata?.role < 300 ? userdata?.username : req.params.username;

  DepositData.find({ name: usernameToDeposit }, (err, depositdata) => {
    if (err) {
      res.send({ error: true, message: err });
      return;
    }
    res.status(200).json({ error: null, deposits: depositdata });
  });
};

const setTempEpic = async (req, res) => {
  const epic = req.body.epic.toLowerCase();
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  VerifyEpicData.findOne({ epic: epic }, (err, epicData) => {
    if (epicData) {
      // console.log("This epic is already waiting for a verification.");
      return res
        .status(409)
        .send("This epic is already waiting for a verification.");
    } else {
      if (!epic || !username) {
        // console.log("missing epic or username");
        return res.status(409).send("Epic or username missing.");
      } else {
        VerifyEpicData.findOne({ username: username }, (err, epicData) => {
          if (epicData) {
            if (epicData.epic) {
              // console.log("already have an epic");
              return res
                .status(409)
                .send("You already have a pending Epic Verification.");
            } else if (!epicData.epic) {
              epicData.epic = epic;
              epicData.save();
              return res.status(200).send("Successfully updated epic.");
            }
          } else {
            var tempEpic = new VerifyEpicData({
              epic: epic,
              username: username,
              id: "",
            });
            tempEpic.save();
            return res.status(200).send("Created temporary Epic verification.");
          }
        });
      }
    }
  });
};

// const setEpicData = (req, res) => {
//   const epicUsername = req.body.epic;

//   VerifyEpicData.findOne({ epic: epicUsername }, (err, epicData) => {
//     if (err) {
//       // console.log(err);
//       return;
//     }

//     if (epicData) {
//       if (epicData.epic == epicUsername) {
//         getUser(epicData.username, (user) => {
//           user.epic = epicUsername;
//           user.save();
//           return res.status(200).send({ username: epicData.username });
//         });
//       }
//     } else {
//       // console.log("epic not found");
//       return res.status(409).send("Epic not found");
//     }
//   });
// };

const resetTempEpic = (req, res) => {
  var username = req.body.username;

  VerifyEpicData.findOne({ username: username }, (err, epicData) => {
    if (err) {
      // console.log(err);
      return res.status(409).send("Cannot find your username.");
    } else if (epicData) {
      epicData.remove({ username: username });
      return res
        .status(200)
        .send("Successfully reset your temporary Epic verification process.");
    } else {
      // console.log("no epic data found");
      return res
        .status(409)
        .send("Cannot find your temporary epic verification data.");
    }
  });
};

const getTempEpic = (req, res) => {
  var username = req.params.username;
  // console.log(username);
  VerifyEpicData.findOne({ username: username }, (err, epicData) => {
    if (err) {
      // console.log(err);
    }
    if (epicData) {
      return res
        .status(200)
        .send({ error: null, tempEpic: epicData.epic, id: epicData.id });
    } else {
      return res.status(409).send("No temporary epic data for this user.");
    }
  });
};

const makeWithdrawal = async (req, res, io) => {
  const email = req.body.email;
  const isPaypal = req.body.paypal;
  const amount_input = req.body.amount;
  const fullName = req.body.fullName;
  const currency = req.body.currency;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  if ((email.includes("@") || email.includes(".")) && isPaypal === false) {
    return res.status(409).send({
      error: true,
      message:
        "Your Cash Tag cannot be an email. We do not support Paypal withdrawals.",
    });
  }
  // console.log(amount_input);
  if (isNaN(amount_input)) {
    return res
      .status(409)
      .send({ error: true, message: "Amount must be a number." });
  }
  const wager = await TeamData.findOne({ usernames: username, in_wager: true });

  if (wager) {
    return res.status(409).send({
      error: true,
      message: "You cannot withdraw while you are in a Token",
    });
  } else {
    var amount = Math.floor(parseFloat(amount_input) * 100) / 100;
    // console.log(amount);

    const data = await UserData.findOne({ username });

    if (!data) {
      return res
        .status(409)
        .send({ error: true, message: "You are not logged in." });
    }
    if (data.is_banned == true) {
      return res.status(409).send({
        error: true,
        message: "You cannot withdraw while banned.",
      });
    }
    var max = data.max_withdrawal;
    if (amount > max) {
      return res.status(409).send({
        error: true,
        message:
          "You have only won " +
          num_formatter.format(max) +
          ", that is the maximum amount you can withdraw.",
      });
    }
    if (amount > data.balance) {
      return res.status(409).send({
        error: true,
        message: "You do not have a high enough balance for this.",
      });
    }

    if (amount < 10) {
      return res.status(409).send({
        error: true,
        message: "You may only withdraw amounts greater than $10.",
      });
    }
    let newAmount = 0;
    // console.log(isPaypal);
    if (isPaypal === true) {
      // console.log(isPaypal);
      let deposit = amount_input;
      let y = 0;
      y = deposit * 0.05 + 1;
      deposit = deposit - y;
      newAmount = deposit;
    } else if (isPaypal === false) {
      let deposit = amount_input;
      let y = 0;
      y = deposit * 0.05;
      deposit = deposit - y;
      newAmount = deposit;
    }
    // console.log(newAmount);
    var today = new Date();
    var time =
      today.getDate() + ":" + today.getHours() + ":" + today.getMinutes();

    const unique_value = hash({
      username: data.username,
      amount: data.amount,
      paypal: data.email,
      time,
    });

    var newWithdrawal = new WithdrawData({
      username: data.username,
      amount: newAmount,
      paypal: email,
      time: new Date(),
      unique_value,
      processed: false,
      currency: currency || null,
      fullName: fullName || null,
    });
    await newWithdrawal.save();
    data.balance -= amount;
    data.max_withdrawal -= amount;
    await data.save();
    io.in(data.username).emit(
      NEW_UPDATE_BALANCE_EVENT,
      data.balance.toString()
    );
    return res.status(200).send({
      error: null,
      message:
        "Successfully withdrew $" +
        newAmount +
        " to " +
        email +
        ", please expect payment within 1-7 business days.",
    });
  }
};

const getUserAvatar = (req, res) => {
  const username = req.params.username;

  const randomAvatar = generateRandomAvatarOptions();
  UserData.findOne({ username: username }, (err, userdata) => {
    if (err) {
      return;
    }
    if (!userdata) {
      return;
    }
    if (userdata.avatar.length > 0) {
      res.send(userdata.avatar);
    } else if (userdata) {
      userdata.avatar = randomAvatar;
      userdata.save({}, (err, data) => {
        if (err) {
          console.log(err);
          return;
        }
      });
    }
  });
  // const newAvatar = new AvatarData({ username, options: randomAvatar });
  // newAvatar.save({}, (err, data) => {
  //   if (err) {
  //     console.log("Error creating new avatar.");
  //     return;
  //   }
  // });
  // return res.send(randomAvatar);
};

const changeUserAvatar = async (req, res, io) => {
  var options = req.body.options;
  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  const avatardata = await UserData.findOne({ username });

  if (avatardata) {
    avatardata.avatar = options;
    await avatardata.save();
    io.in(avatardata.username).emit(NEW_USER_AVATAR_EVENT, avatardata);
    return res.status(200).send("Successfully updated avatar!");
  } else {
    return;
  }
};

const setFivemUser = async (req, res) => {
  const fivemID = req.body.fivemID;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  const fivemObj = {
    fivemID: fivemID,
  };

  const wager = await TeamData.findOne({
    usernames: username,
    in_wager: true,
  });
  if (wager) {
    return res
      .status(409)
      .send({ error: true, message: "Cannot set IDs while in a token." });
  }
  const data = await UserData.findOne({ username: username });
  if (data) {
    data.connections[2] = fivemObj;
    await data.save();
    return res.status(200).send({ error: null, fivemID: fivemID });
  } else {
    return res
      .status(409)
      .send({ error: true, message: "User does not exist." });
  }
};

const setValUser = async (req, res) => {
  const valId = req.body.valId;

  const userToken = getUserToken(req);
  const username = await getUsernameFromToken(userToken);

  const valObj = {
    valId: valId,
  };

  const wager = await TeamData.findOne({
    usernames: username,
    in_wager: true,
  });
  if (wager) {
    return res
      .status(409)
      .send({ error: true, message: "Cannot set IDs while in a token." });
  }
  const data = await UserData.findOne({ username: username });
  if (data) {
    data.connections[0] = valObj;
    await data.save();
    return res.status(200).send({ error: null, valId: valId });
  } else {
    return res
      .status(409)
      .send({ error: true, message: "User does not exist." });
  }
};

const setClashUser = async (req, res) => {
  try {
    let clashId = req.body.clashId;
    // const username = req.body.username;
    // console.log(clashId);
    const userToken = getUserToken(req);
    const username = await getUsernameFromToken(userToken);
    const data = await UserData.findOne({ username: username });

    const wager = await TeamData.findOne({
      usernames: username,
      in_wager: true,
    });
    if (wager) {
      return res
        .status(409)
        .send({ error: true, message: "Cannot set IDs while in a token." });
    }

    if (clashId.charAt(0) == "#") {
      // console.log("# true")
      clashId = clashId.replace("#", "%23");
    } else {
      if (clashId.charAt(0) !== "#") {
        // console.log("# untrue")
        const operator = "%23";
        clashId = operator + clashId;
      }
    }
    const clashObj = {
      clashId: clashId || null,
    };

    let apiKey =
      "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjJjMTY2OWIwLTRkNDItNDNkNC05MTNiLTdkMTAwNjc3ZmU5ZCIsImlhdCI6MTY0ODM0ODA3MCwic3ViIjoiZGV2ZWxvcGVyLzgzMTc1YzI5LTkwMjctZDYwMi1hMWRhLTAzN2RjMjE5YWIzZiIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyI0NS43OS4yMTguNzkiXSwidHlwZSI6ImNsaWVudCJ9XX0.W0llafkc3O2DJFxHTHh2xOKqorkyrfIiS3zbGcmsmpXYUL8mqsQgMxa-WZxGYQ6GtPVVsxYCKsL0IGadxM0ROg";
    let headers = {
      "Content-Type": "application/json",
      Authorization: apiKey,
    };
    fetch("https://proxy.royaleapi.dev/v1/players/" + clashId, {
      method: "get",
      headers: headers,
    })
      .then((response) => response.json())
      .then((clashApiData) => {
        if (!clashApiData?.name) {
          return res.status(409).send({
            error: true,
            message: "Unable to retrieve Clash Username.",
          });
        }

        if (data && clashApiData) {
          clashObj.clashId = clashApiData?.name + clashApiData?.tag;
          data.connections[1] = clashObj;
          data.save({}, (err, saveData) => {
            if (err) {
              return;
            } else {
              //clashApiData?.name + clashApiData?.tag
              return res.status(200).send({ error: null, clashId: clashObj });
            }
          });
        }
      });
  } catch (err) {
    console.log("CLASH ERROR CATCH");
    return;
  }
};
// });

const getEarnings = (req, res) => {
  EarningsData.findOne({ username: req.username }, (err, data) => {
    if (err) {
      return;
    } else {
      return res.send(data);
    }
  });
};

const VerifyStripePayment = async (req,res,io)=>{
  const sig = req.headers['stripe-signature'];
  const transactionId = req?.body?.data?.object?.id;
  const username = req?.body?.data?.custom_fields[0]?.text?.value;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_SECRET);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;
      console.log('PAID - SUCCESS')

      try {
        const depositData = await DepositData.findOne({ transactionId });
    
        if (!depositData) {
          var newDepositData = new DepositData({
            transactionId,
            amount: req?.body?.data?.object?.amount_total / 100,
            currency: req?.body?.data?.currency,
            date: req?.body?.data?.created,
            email: req?.body?.data?.customer_details?.email,
            items: "token",
            name: username.toLowerCase(),
            note: null,
            payment_method: req?.body?.data?.processing_method,
            quantities: 1,
            status: req?.body?.data?.status,
            transaction: null,
          });
          await newDepositData.save();
    
          const userdata = await UserData.findOne({ username });
          let depositValue = parseFloat(amount);
          userdata.balance += depositValue;
          await userdata.save();
          io.in(username).emit(NEW_UPDATE_BALANCE_EVENT, userdata.balance);
          return;
        } else {
          return;
        }
      } catch (err) {
        console.log("deposit err: ", err);
        if (err) return;
      }
      // Then define and call a function to handle the event payment_intent.succeeded
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).send(`PAID - SUCCESS`);
}

function verifyWebhook(payload, hmac) {
  const message = payload.toString();
  const genHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_SECRET)
    .update(message)
    .digest("base64");
  // console.log(genHash);
  return genHash === hmac;
}

const shopifyDeposit = async (req, res, io) => {
  console.log("Webhook heard!");
  // Verify
  const hmac = req.header("X-Shopify-Hmac-Sha256");
  const topic = req.header("X-Shopify-Topic");
  const shop = req.header("X-Shopify-Shop-Domain");

  const verified = verifyWebhook(req.body, hmac);

  if (!verified) {
    console.log("Failed to verify the incoming request.");
    res.status(409).send({ error: true, message: "Could not verify request." });
    return;
  }

  const data = req.body.toString();
  const payload = JSON.parse(data);
  console.log(
    `Verified webhook request. Shop: ${shop} Topic: ${topic} \n Payload: \n ${data}`
  );

  const username = req.body.note_attributes[0]?.value;
  const amount = req.body.note_attributes[1]?.value;
  const transactionId = req.body.id;

  console.log(username, amount);
  try {
    const depositData = await DepositData.findOne({ transactionId });

    if (!depositData) {
      var newDepositData = new DepositData({
        transactionId,
        amount,
        currency: req?.body?.currency,
        date: req?.body?.created_at,
        email: req?.body?.contact_email,
        items: "token",
        name: username.toLowerCase(),
        note: null,
        payment_method: req?.body?.processing_method,
        quantities: amount,
        status: "yes",
        transaction: null,
      });
      await newDepositData.save();

      const userdata = await UserData.findOne({ username });
      let depositValue = parseFloat(amount);
      userdata.balance += depositValue;
      await userdata.save();
      io.in(username).emit(NEW_UPDATE_BALANCE_EVENT, userdata.balance);
      return;
    } else {
      return;
    }
  } catch (err) {
    console.log("deposit err: ", err);
    if (err) return;
  }
};

module.exports = {
  confirmPoofDeposit,
  VerifyStripePayment,
  getUserById,
  getUserTeams,
  getUserByUsername,
  getUserTransactions,
  getUserWithdrawals,
  // setEpicData,
  setTempEpic,
  makeWithdrawal,
  resetTempEpic,
  getTempEpic,
  changeUserAvatar,
  getUserAvatar,
  getEarnings,
  getUserDeposits,
  markWithdrawal,
  setValUser,
  setClashUser,
  setFivemUser,
  shopifyDeposit,
  squareIsGangStyll,
};

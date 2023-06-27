const { ActiveWagerData } = require("./src/models/ActiveWagers");

module.exports = class Wager {
  constructor(wagerid, teamid, team_users) {
    this.wagerid = wagerid;
    this.blueteamid = teamid;
    this.blue_users = team_users;
    this.redteamid = "";
    this.red_users = [];

    this.bluesubmit = -1;
    this.redsubmit = -1;
    this.single_sub = -1;
    this.winner = -1;

    this.CANCEL_STATE = -1;
    this.JOIN_STATE = 0;
    this.READY_STATE = 1;
    this.PLAYING_STATE = 2;
    this.DONE_STATE = 3;
    this.DISPUTE_STATE = 4;
    this.state = this.JOIN_STATE;
    this.timer = 0;
  }

  join(teamid, team_users) {
    this.redteamid = teamid;
    this.red_users = team_users;

    this.state = this.READY_STATE;
    this.timer = 60; // 60 seconds to ready up

    // set up the ready-up variables
    this.readied_users = {};
    for (var i = 0; i < this.blue_users.length; i++) {
      this.readied_users[this.blue_users[i]] = false;
    }

    for (var i = 0; i < this.red_users.length; i++) {
      this.readied_users[this.red_users[i]] = false;
    }
  }

  team_leave_wager(teamdata, teamid) {
    teamdata.findOne({ _id: teamid }, (err, data) => {
      if (err) {
        return // console.log(err);
      }

      if (!data) {
        return // console.log("Error finding team");
      }
      data.in_wager = false;
      data.wager_id = "";
      data.save();
    });
  }

  cancel(wagerdata, teamdata) {
    this.state = this.CANCEL_STATE;
    // console.log("Cancelled wager " + this.wagerid);

    // clear wager from database, we're going to keep it in memory though
    wagerdata.deleteOne(
      { blueteamid: this.blueteamid, redteamid: this.redteamid, done: false },
      (ok, deletedcount, num) => {}
    );
    this.team_leave_wager(teamdata, this.blueteamid);
    if (this.redteamid) {
      this.team_leave_wager(teamdata, this.redteamid);
    }
  }

  tick(wagerdata, teamdata, mark) {
    if (this.timer <= 0) {
      return;
    }

    this.timer -= 1;
    if (this.state == this.READY_STATE && this.timer == 0) {
      this.cancel(wagerdata, teamdata);
    } else if (this.state == this.PLAYING_STATE && this.timer == 0) {
      // give the auto-win
      if (this.bluesubmit >= 0) {
        this.win(1); // blue win
      } else {
        this.win(2); // red win
      }

      // mark wager as complete
      mark(this.wagerid);
    }
  }

  ready_up(username) {
    // check if we're in the correct state
    if (this.state != this.READY_STATE) {
      return false;
    }

    // check if user is even in this wager
    if (Object.prototype.hasOwnProperty.call(this.readied_users, username)) {
      this.readied_users[username] = true;

      // check if everyone is readied up, if so start game, otherwise return true to say we readied this user up
      for (var i = 0; i < this.blue_users.length; i++) {
        if (!this.readied_users[this.blue_users[i]]) {
          return true;
        }
      }

      for (var i = 0; i < this.red_users.length; i++) {
        if (!this.readied_users[this.red_users[i]]) {
          return true;
        }
      }

      // everyone is readied up, so start match
      this.start();
      return true;
    }

    return false;
  }

  win(teamnum) {
    // TEAMNUM: 1 for blue, 2 for red
    this.state = this.DONE_STATE;
    this.winner = teamnum;

    // console.log(
      "Win for wager " +
        this.wagerid.toString() +
        " finalized: " +
        this.winner.toString()
    );

    return true;
  }

  dispute() {
    this.state = this.DISPUTE_STATE;
    // console.log("Dispute for wager " + this.wagerid.toString() + " submitted.");
  }

  resolve(blue, red) {
    this.timer = 0;

    if (blue == 1 && red == 0) {
      // blue wins
      return this.win(1);
    }

    if (blue == 0 && red == 1) {
      // red wins
      return this.win(2);
    }

    if (blue == 0 && red == 0) {
      // both submitted losses LMAO just give it to blue
      return this.win(1);
    }

    if (blue == 1 && red == 1) {
      // both submitted wins, put it in dispute
      this.dispute();
      return false;
    }
  }

  // todo: subtract from balance when join, give back when cancel, give winnings when win, choose host for wager, play sound when team joins or submits results, email for signup/in, forgot password
  submit(username, status) {
    // make sure we're in the playing phase
    if (this.state != this.PLAYING_STATE) {
      return -1; // not playing yet
    }

    // check if results are already in
    if (this.winner >= 0) {
      return -1;
    }

    // check if user is even in this wager
    if (Object.prototype.hasOwnProperty.call(this.readied_users, username)) {
      if (this.blue_users.includes(username)) {
        // check if its already submitted
        if (this.bluesubmit >= 0) {
          return -1;
        }

        this.bluesubmit = status;
        this.single_sub = 1;

        if (status == 0) {
          // user submitted a loss, give it to the other team
          this.win(2);
          return 2;
        }
      } else if (this.red_users.includes(username)) {
        // check if its already submitted
        if (this.redsubmit >= 0) {
          return -1;
        }

        this.redsubmit = status;
        this.single_sub = 2;

        if (status == 0) {
          // user submitted a loss, give it to the other team
          this.win(1);
          return 2;
        }
      } else {
        return -1; // user not in this wager
      }

      // check if both teams have submitted
      if (this.bluesubmit >= 0 && this.redsubmit >= 0) {
        var resolved = this.resolve(this.bluesubmit, this.redsubmit);
        if (resolved) {
          return 2; // clear the object if resolved
        } else {
          return 1;
        }
      } else {
        // start 15 minute timer for auto-winning
        this.timer = 100 * 60;
      }

      return 1;
    }

    return -1; // not playing because user is not in this wager
  }

  which_team(username) {
    // returns 1 for blue team, 2 for red team
    if (this.blue_users.includes(username)) {
      return 1;
    } else if (this.red_users.includes(username)) {
      return 2;
    }
    return -1;
  }

  start() {
    this.state = this.PLAYING_STATE;
    this.timer = 0;
  }
};

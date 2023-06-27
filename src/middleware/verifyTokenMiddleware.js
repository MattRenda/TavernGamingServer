const jwt = require("jsonwebtoken");

// auth token middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(403).send({
      error: true,
      message: "A token is required for authentication.",
    });
  }
  const accessToken = authHeader.split(" ")[1];

  jwt.verify(accessToken, process.env.JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
      next();
    } else {
      return res.status(401).json({ error: true, message: "Invalid Token." });
    }
  });
};

module.exports = {
  verifyToken,
};

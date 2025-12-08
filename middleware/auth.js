const { admin } = require("../config/firebase");
const { getUserRoleUtil } = require("./utils");

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  const accessToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(accessToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid Token" });
  }
};

// call them after verifyFirebaseToken
const verifyAdmin = async (req, res, next) => {
  try {
    const role = await getUserRoleUtil(req);
    if (role === "admin") {
      return next();
    }
    return res.status(403).json({ error: "Forbidden: Admins only" });
  } catch (error) {
    console.error("Token role verification failed:", error);
    return res.status(401).json({ error: "Invalid Token" });
  }
};

const verifyRider = async (req, res, next) => {
  try {
    const role = await getUserRoleUtil(req);
    if (role === "rider") {
      return next();
    }
    return res.status(403).json({ error: "Forbidden: Riders only" });
  } catch (error) {
    console.error("Token role verification failed:", error);
    return res.status(401).json({ error: "Invalid Token" });
  }
};

const verifyUser = async (req, res, next) => {
  try {
    const role = await getUserRoleUtil(req);
    if (role === "user") {
      return next();
    }
    return res.status(403).json({ error: "Forbidden: Users only" });
  } catch (error) {
    console.error("Token role verification failed:", error);
    return res.status(401).json({ error: "Invalid Token" });
  }
};

module.exports = { verifyFirebaseToken, verifyAdmin, verifyRider, verifyUser };

const { admin } = require("../config/firebase");
const { client } = require("../config/db");

const usersColl = client.db("ProFastDB").collection("users");

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  const accessToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(accessToken);
    const { email } = decodedToken;
    const authUser = await usersColl.findOne({ email }, { projection: { role: 1 } });

    if (!authUser) return res.status(401).json({ error: "User not found." });

    req.user = decodedToken;
    req.user.role = authUser.role;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: "Invalid Token" });
  }
};

module.exports = { verifyFirebaseToken };

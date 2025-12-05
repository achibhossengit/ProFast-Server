const { client } = require("../config/db");
const usersColl = client.db("ProFastDB").collection("users");

const getUserEmailUtil = (req, res) => {
  const email = req.user?.email;
  if (!email) {
    res.status(403).json({ error: "User email not found!" });
    throw new Error("Email missing");
  }
  return email;
};

const getUserUidUtil = (req, res) => {
  const uid = req.user?.uid;
  if (!uid) {
    res.status(403).json({ error: "User ID not found!" });
    throw new Error("ID missing");
  }
  return uid;
};

const getUserRoleUtil = async (req) => {
  const email = req.user?.email;
  if (!email) throw new Error("User email not found!");

  const authUser = await usersColl.findOne(
    { email },
    { projection: { role: 1 } }
  );

  if (!authUser) throw new Error("Role not assigned yet!");

  return authUser.role;
};

module.exports = { getUserEmailUtil, getUserUidUtil, getUserRoleUtil };

const { client } = require("../config/db");
const usersColl = client.db("ProFastDB").collection("users");

const createUser = async (req, res) => {
  try {
    const { email, role = "user" } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const alreadyExists = await usersColl.findOne({ email });
    if (alreadyExists) {
      await usersColl.updateOne({ email }, { $set: { lastLoggedIn: new Date().toISOString() } });
      return res.status(200).json({ message: "User already exists" });
    }

    const newUser = { email, role, createdAt: new Date().toISOString(), lastLoggedIn: new Date().toISOString() };
    const result = await usersColl.insertOne(newUser);
    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to create user" });
  }
};

const getUserRole = async (req, res) => {
  try {
    return res.status(200).json(req.user.role);
  } catch (error) {
    console.error("Error fetching user role:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { createUser, getUserRole };

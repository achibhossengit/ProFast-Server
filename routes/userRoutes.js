const express = require("express");
const router = express.Router();
const { verifyFirebaseToken, verifyAdmin, demoBlocker } = require("../middleware/auth");
const {
  createUser,
  getUserProfile,
  updateUserProfile,
  updateUserEmail,
  getAllUsers,
  deleteUser,
  getUserRole,
  getUserByEmail,
} = require("../controllers/userController");

// authenticaiton required
router.post("/", verifyFirebaseToken, createUser);
router.get("/role", verifyFirebaseToken, getUserRole);
router.get("/profile", verifyFirebaseToken, getUserProfile);
router.put("/profile", verifyFirebaseToken, updateUserProfile);
router.patch("/email", verifyFirebaseToken, demoBlocker, updateUserEmail);

// admin only
router.get("/", verifyFirebaseToken, verifyAdmin, getAllUsers);
router.get("/:email", verifyFirebaseToken, verifyAdmin, getUserByEmail);
router.delete("/:email", verifyFirebaseToken, verifyAdmin, demoBlocker, deleteUser);

module.exports = router;

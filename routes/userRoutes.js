const express = require("express");
const router = express.Router();
const { createUser, getUserRole } = require("../controllers/userController");
const { verifyFirebaseToken } = require("../middleware/auth");

router.post("/", createUser);
router.get("/role", verifyFirebaseToken, getUserRole);

module.exports = router;

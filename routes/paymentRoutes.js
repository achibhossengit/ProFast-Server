const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../middleware/auth");
const {
  createPaymentIntent,
  savePayment,
  getPayments,
} = require("../controllers/paymentController");

router.post("/create-intent", verifyFirebaseToken, createPaymentIntent);
router.post("/", verifyFirebaseToken, savePayment);
router.get("/", verifyFirebaseToken, getPayments);

module.exports = router;

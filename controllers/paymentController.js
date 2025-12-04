const { client } = require("../config/db");
const { ObjectId } = require("mongodb");
const { getUserEmail } = require("../middleware/utils");
const { createStripePaymentIntent } = require("../services/stripeService");

const paymentsColl = client.db("ProFastDB").collection("payments");
const parcelsColl = client.db("ProFastDB").collection("parcels");

const createPaymentIntent = async (req, res) => {
  try {
    const amount = req.body.amountInCents;
    if (!amount) return res.status(400).json({ error: "Amount is required" });

    const clientSecret = await createStripePaymentIntent(amount);
    res.status(200).json({ clientSecret });
  } catch (error) {
    res.status(500).json({ error: "Failed to create payment intent" });
  }
};

const savePayment = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const { parcelId, transactionId, amount, currency, status, paymentMethod } = req.body;
    if (!parcelId || !transactionId || !amount) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    const newPayment = {
      userEmail: email,
      parcelId,
      transactionId,
      amount,
      currency,
      status,
      paymentMethod,
      createdAt: new Date(),
    };

    await parcelsColl.updateOne(
      { _id: new ObjectId(parcelId) },
      { $set: { payment_status: "paid" } }
    );

    const result = await paymentsColl.insertOne(newPayment);
    res.status(201).json({
      message: "Payment history saved successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to save payment history" });
  }
};

const getPayments = async (req, res) => {
  try {
    const email = getUserEmail(req, res);
    const payments = await paymentsColl.find({ userEmail: email }).sort({ createdAt: -1 }).toArray();
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
};

module.exports = { createPaymentIntent, savePayment, getPayments };

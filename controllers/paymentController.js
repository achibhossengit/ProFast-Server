const { client } = require("../config/db");
const { ObjectId } = require("mongodb");
const { getUserEmailUtil, getUserRoleUtil } = require("../middleware/utils");
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
    const email = getUserEmailUtil(req, res);
    const { parcelId, transactionId, amount, currency, status, paymentMethod } =
      req.body;
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

// make it generalized for admin and user;
const getPayments = async (req, res) => {
  try {
    const email = getUserEmailUtil(req, res);
    const role = await getUserRoleUtil(req); // "admin" or "user"
    const { page = 1, limit = 10 } = req.query;

    // Convert to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = {};
    if (role !== "admin") {
      query.userEmail = email;
    }

    // Fetch paginated results
    const payments = await paymentsColl
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    // Count total for pagination
    const totalCount = await paymentsColl.countDocuments(query);

    res.status(200).json({
      data: payments,
      pagination: {
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        currentPage: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
};

module.exports = { createPaymentIntent, savePayment, getPayments };

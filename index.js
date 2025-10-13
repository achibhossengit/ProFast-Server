require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  const accessToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(accessToken);
    // console.log(decodedToken);
    req.user = decodedToken;
  } catch (error) {
    console.error("Token verification Failed: ", error);
    return res.status(403).json({ error: "Invalid Token" });
  }

  next();
};

// Utility Function
const getUserEmail = (req, res) => {
  const email = req.user?.email;
  if (!email) {
    res.status(403).json({ error: "User email not found!" });
    throw new Error("Email missing");
  }
  return email;
};

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.2dlckac.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("ProFastDB");
    const usersColl = db.collection("users");
    const parcelsColl = db.collection("parcels");
    const paymentsColl = db.collection("payments");
    const ridersColl = db.collection("riders");

    // test route
    app.get("/", (req, res) => {
      res.send("ProFast server is running ");
    });

    // users
    app.post("/users", async (req, res) => {
      try {
        const { email, role = "user" } = req.body;
        const alreadyExists = await usersColl.findOne({ email });
        if (alreadyExists) {
          await usersColl.updateOne(
            { email },
            {
              $set: { lastLoggedIn: new Date().toISOString() },
            }
          );
          return res.status(200).send({ message: "User already exists" });
        }

        const newUser = {
          email,
          role,
          createdAt: new Date().toISOString(),
          lastLoggedIn: new Date().toISOString(),
        };

        const result = await usersColl.insertOne(newUser);
        return res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // rider applications
    app.post("/riders", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);

        // Check if rider already applied
        const existing = await ridersColl.findOne({ email });
        if (existing) {
          return res.status(409).json({ message: "You have already applied." });
        }

        const newRider = req.body;
        newRider.appliedAt = new Date().toISOString();

        const result = await ridersColl.insertOne(newRider);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error submitting rider application:", error);
        res.status(500).json({ message: "Failed to submit application" });
      }
    });

    app.get("/riders", verifyFirebaseToken, async (req, res) => {
      try {
        const status = req.query.status;

        let query = {};

        if (status) {
          query = { status };
        } else {
          query = { status: { $ne: "pending" } }; // exclude pending
        }

        const riders = await ridersColl.find(query).toArray();
        res.status(200).send(riders);
      } catch (error) {
        console.error("Error fetching riders:", error);
        res.status(500).send({ error: "Failed to fetch riders" });
      }
    });

    app.patch("/riders/:id", verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      const { status } = req.query;

      if (!["active", "deactive"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      try {
        const query = { _id: new ObjectId(id) };
        const riderUser = await ridersColl.findOne(query);

        if (!riderUser) {
          return res.status(404).json({ error: "Rider not found" });
        }

        const { email } = riderUser;
        const role = status === "active" ? "rider" : "user";

        const updates = [
          ridersColl.updateOne(query, { $set: { status } }),
          email
            ? usersColl.updateOne({ email }, { $set: { role } })
            : Promise.resolve(),
        ];

        const [riderUpdateResult] = await Promise.all(updates);

        res.json({ success: true, updated: riderUpdateResult.modifiedCount });
      } catch (error) {
        console.error("Error updating rider:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.delete("/riders/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await ridersColl.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to delete rider" });
      }
    });

    // stripe payment apis
    app.post("/create-payment-intent", async (req, res) => {
      const amount = req.body.amountInCents;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const {
          parcelId,
          transactionId,
          amount,
          currency,
          status,
          paymentMethod,
        } = req.body;

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

        const updateResult = await parcelsColl.updateOne(
          {
            _id: new ObjectId(parcelId),
          },
          {
            $set: { payment_status: "paid" },
          }
        );

        const result = await paymentsColl.insertOne(newPayment);
        res.status(201).send({
          message: "Payment history saved successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error saving payment:", error);
        res.status(500).send({ error: "Failed to save payment history" });
      }
    });

    // GET: Fetch all payments for logged-in user
    app.get("/payments", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const query = { userEmail: email };
        const payments = await paymentsColl
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.status(200).send(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send({ error: "Failed to fetch payments" });
      }
    });

    // parcel related api
    app.get("/parcels", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const query = { created_by: email };
        const parcels = await parcelsColl.find(query).toArray();
        return res.status(200).send(parcels);
      } catch (err) {
        return res.status(500).send({ error: "Failed to fetch parcels" });
      }
    });

    app.get("/parcels/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const id = req.params.id;
        const query = { _id: new ObjectId(id), created_by: email };
        const result = await parcelsColl.findOne(query);
        return res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.post("/parcels", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const parcelData = {
          ...req.body,
          created_by: email,
        };

        const result = await parcelsColl.insertOne(parcelData);
        res.status(201).send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to create parcel" });
      }
    });

    app.put("/parcels/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const id = req.params.id;
        const updatedData = req.body;
        delete updatedData._id;
        const query = { _id: new ObjectId(id), created_by: email };
        const result = await parcelsColl.updateOne(query, {
          $set: updatedData,
        });
        return res.send(result);
      } catch (error) {
        console.log(error);
        return res.status(500).send({ error: "Failed to update parcel!" });
      }
    });

    app.delete("/parcels/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const id = req.params.id;
        const query = { _id: new ObjectId(id), created_by: email };
        const result = await parcelsColl.deleteOne(query);
        return res.send(result);
      } catch (error) {
        return res
          .status(500)
          .send({ error: "Something went wrong to delete parcel!" });
      }
    });

    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`ProFast server running on port ${port}`);
});

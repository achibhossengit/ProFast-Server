require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    // await client.connect();
    const db = client.db("ProFastDB");
    const usersColl = db.collection("users");
    const parcelsColl = db.collection("parcels");
    const paymentsColl = db.collection("payments");
    const ridersColl = db.collection("riders");

    // custom middleware
    const verifyFirebaseToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or malformed token" });
      }

      const accessToken = authHeader.split(" ")[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(accessToken);
        const { email } = decodedToken;
        const authUser = await usersColl.findOne(
          { email },
          { projection: { role: 1 } }
        );

        if (!authUser) {
          return res.status(401).json({ error: "User not found." });
        }
        req.user = decodedToken;
        req.user.role = authUser.role;
      } catch (error) {
        console.error("Token verification Failed: ", error);
        return res.status(401).json({ error: "Invalid Token" });
      }

      next();
    };

    const verifyAdmin = async (req, res, next) => {
      try {
        const role = req.user.role;
        if (!role || role !== "admin")
          return res.status(403).json({ message: "Forbidden access" });

        next();
      } catch (error) {
        return res.status(500).json({ message: "Internal Server Error" });
      }
    };

    const verifyRider = async (req, res, next) => {
      try {
        const role = req.user.role;
        if (!role || role !== "rider")
          return res.status(403).json({ message: "Forbidden access" });

        next();
      } catch (error) {
        return res.status(500).json({ message: "Internal Server Error" });
      }
    };

    // test route
    app.get("/", (req, res) => {
      res.status(200).send("ProFast server is running");
    });

    // users
    app.post("/users", async (req, res) => {
      try {
        const { email, role = "user" } = req.body;
        if (!email) {
          return res.status(400).json({ error: "Email is required" });
        }

        const alreadyExists = await usersColl.findOne({ email });
        if (alreadyExists) {
          await usersColl.updateOne(
            { email },
            { $set: { lastLoggedIn: new Date().toISOString() } }
          );
          return res.status(200).json({ message: "User already exists" });
        }

        const newUser = {
          email,
          role,
          createdAt: new Date().toISOString(),
          lastLoggedIn: new Date().toISOString(),
        };

        const result = await usersColl.insertOne(newUser);
        return res.status(201).json(result);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to create user" });
      }
    });

    app.get("/user-role", verifyFirebaseToken, async (req, res) => {
      try {
        const userRole = req.user.role;
        return res.status(200).json(userRole);
      } catch (error) {
        console.error("Error fetching user role:", error);
        return res.status(500).json({ error: "Internal server error." });
      }
    });

    // rider applications
    app.post("/riders", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);

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

    app.get("/riders", verifyFirebaseToken, verifyAdmin, async (req, res) => {
      try {
        const { status } = req.query;
        let query = {};

        if (status) query.status = status;
        else if (status) query = { status: { $ne: "pending" } };

        const riders = await ridersColl.find(query).toArray();
        res.status(200).json(riders);
      } catch (error) {
        console.error("Error fetching riders:", error);
        res.status(500).json({ error: "Failed to fetch riders" });
      }
    });

    app.get(
      "/riders/available",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { status, warehouse_district } = req.query;
          let query = {};

          if (status) query.status = status;
          if (warehouse_district) query.warehouse_district = warehouse_district;

          const riders = await ridersColl.find(query).toArray();
          res.status(200).json(riders);
        } catch (error) {
          console.error("Error fetching riders:", error);
          res.status(500).json({ error: "Failed to fetch riders" });
        }
      }
    );

    app.patch(
      "/riders/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
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
          res.status(200).json({
            success: true,
            updated: riderUpdateResult.modifiedCount,
          });
        } catch (error) {
          console.error("Error updating rider:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      }
    );

    app.delete("/riders/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await ridersColl.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Rider not found" });
        }
        res.status(200).json({ message: "Rider deleted successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete rider" });
      }
    });

    // rider only
    app.get(
      "/rider/parcels",
      verifyFirebaseToken,
      verifyRider,
      async (req, res) => {
        try {
          const email = req.user.email;

          const query = {
            "assigned_rider.email": email,
            delivery_status: { $in: ["way-to-collect", "in-transit"] },
          };

          const riderParcels = await parcelsColl
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

          res.status(200).send(riderParcels);
        } catch (error) {
          console.log(error);
          res.status(500).json({ message: "Internal Server Error" });
        }
      }
    );

    app.patch(
      "/rider/parcels/:id",
      verifyFirebaseToken,
      verifyRider,
      async (req, res) => {
        try {
          const parcelId = req.params.id;
          const email = req.user.email;
          const { delivery_status } = req.body;

          console.log(delivery_status);

          // Validation
          const allowedStatuses = ["in-transit", "delivered"];
          if (!allowedStatuses.includes(delivery_status)) {
            return res
              .status(400)
              .json({ message: "Invalid delivery status." });
          }

          // Validation: Check the parcel rider
          const parcel = await parcelsColl.findOne({
            _id: new ObjectId(parcelId),
            "assigned_rider.email": email,
          });

          if (!parcel) {
            return res
              .status(404)
              .json({ message: "Parcel not found or unauthorized." });
          }

          // update delivery status
          const updateResult = await parcelsColl.updateOne(
            { _id: new ObjectId(parcelId) },
            { $set: { delivery_status } }
          );

          if (updateResult.modifiedCount === 0) {
            return res.status(400).json({ message: "No changes applied." });
          }

          res
            .status(200)
            .json({ message: "Delivery status updated successfully." });
        } catch (error) {
          console.error("Error updating parcel status:", error);
          res
            .status(500)
            .json({ message: "Server error", error: error.message });
        }
      }
    );

    app.get(
      "/rider/parcels/delivered",
      verifyFirebaseToken,
      verifyRider,
      async (req, res) => {
        try {
          const email = req.user.email;

          const query = {
            "assigned_rider.email": email,
            delivery_status: "delivered",
          };

          const deliveredParcels = await parcelsColl
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

          res.status(200).send(deliveredParcels);
        } catch (error) {
          console.error(error);
          res.status(500).json({ message: "Internal Server Error" });
        }
      }
    );

    app.patch(
      "/rider/parcels/:id/cashout",
      verifyFirebaseToken,
      verifyRider,
      async (req, res) => {
        try {
          const parcelId = req.params.id;
          const email = req.user.email;

          const filter = {
            _id: new ObjectId(parcelId),
            "assigned_rider.email": email,
          };

          const update = {
            $set: { cashout_status: "cashed_out" },
          };

          const result = await parcelsColl.updateOne(filter, update);

          if (result.modifiedCount === 0)
            return res
              .status(404)
              .json({ message: "Parcel not found or already cashed out" });

          res.status(200).json({ message: "Cashout successful" });
        } catch (error) {
          console.error(error);
          res.status(500).json({ message: "Internal Server Error" });
        }
      }
    );

    // stripe payment apis
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const amount = req.body.amountInCents;
        if (!amount) {
          return res.status(400).json({ error: "Amount is required" });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },
        });

        res.status(200).json({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ error: "Failed to create payment intent" });
      }
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
        console.error("Error saving payment:", error);
        res.status(500).json({ error: "Failed to save payment history" });
      }
    });

    app.get("/payments", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const query = { userEmail: email };
        const payments = await paymentsColl
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.status(200).json(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ error: "Failed to fetch payments" });
      }
    });

    // parcel related api

    app.get("/parcels/status-count", async (req, res) => {
      try {
        // Group by delivery_status
        const pipeline = [
          {
            $group: {
              _id: "$delivery_status",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              status: "$_id",
              count: 1,
            },
          },
          {
            $sort: { status: 1 },
          },
        ];
        const result = await parcelsColl.aggregate(pipeline).toArray();

        res.status(200).json(result);
      } catch (error) {
        console.error("Error getting parcel status counts:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.get(
      "/my-parcels",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const email = getUserEmail(req, res);
          const query = { created_by: email };
          const parcels = await parcelsColl.find(query).toArray();
          res.status(200).json(parcels);
        } catch (err) {
          res.status(500).json({ error: "Failed to fetch parcels" });
        }
      }
    );

    app.get("/parcels", verifyFirebaseToken, async (req, res) => {
      try {
        const { email, delivery_status, payment_status } = req.query;

        let query = {};
        if (email) query.created_by = email;
        if (delivery_status) query.delivery_status = delivery_status;
        if (payment_status) query.payment_status = payment_status;

        const parcels = await parcelsColl.find(query).toArray();
        res.status(200).json(parcels);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch parcels" });
      }
    });

    app.get("/parcels/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const id = req.params.id;
        const query = { _id: new ObjectId(id), created_by: email };
        const result = await parcelsColl.findOne(query);
        if (!result) {
          return res.status(404).json({ error: "Parcel not found" });
        }
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
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
        res.status(201).json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to create parcel" });
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
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Parcel not found" });
        }
        res.status(200).json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update parcel!" });
      }
    });

    app.put(
      "/parcels/:id/assign",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const parcelId = req.params.id;
          const riderInfo = req.body;

          // make sure rider info is provided
          if (!riderInfo || !riderInfo.email) {
            return res
              .status(400)
              .json({ error: "Rider information is missing!" });
          }

          const query = { _id: new ObjectId(parcelId) };
          const updateDoc = {
            $set: {
              delivery_status: "way-to-collect",
              assigned_rider: riderInfo,
              assigned_at: new Date(),
            },
          };

          const result = await parcelsColl.updateOne(query, updateDoc);

          if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Parcel not found!" });
          }

          res.status(200).json({
            success: true,
            message: "Rider assigned successfully!",
          });
        } catch (error) {
          console.error("Error assigning rider:", error);
          res.status(500).json({ error: "Failed to assign rider!" });
        }
      }
    );

    app.delete("/parcels/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res);
        const id = req.params.id;
        const query = { _id: new ObjectId(id), created_by: email };
        const result = await parcelsColl.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Parcel not found" });
        }
        res.status(200).json({ message: "Parcel deleted successfully" });
      } catch (error) {
        res.status(500).json({
          error: "Something went wrong while deleting parcel!",
        });
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

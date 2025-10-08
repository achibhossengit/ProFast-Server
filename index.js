require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

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
    const parcelsColl = db.collection("parcels");

    // test route
    app.get("/", (req, res) => {
      res.send("ProFast server is running ");
    });

    // parcel related api
    app.get("/parcels", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res)
        const query = { created_by: email };
        const parcels = await parcelsColl.find(query).toArray();
        return res.status(200).send(parcels);
      } catch (err) {
        return res.status(500).send({ error: "Failed to fetch parcels" });
      }
    });

    app.get("/parcels/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const email = getUserEmail(req, res)
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
        const email = getUserEmail(req, res)
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
        const email = getUserEmail(req, res)
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
        const email = getUserEmail(req, res)
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

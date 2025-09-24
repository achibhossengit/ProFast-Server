require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    app.get("/parcels", async (req, res) => {
      try {
        const parcels = await parcelsColl.find().toArray();
        res.status(200).send(parcels);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch parcels" });
      }
    });

    app.post("/parcels", async (req, res) => {
      try {
        const parcelData = req.body;

        const result = await parcelsColl.insertOne(parcelData);
        res.status(201).send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to create parcel" });
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

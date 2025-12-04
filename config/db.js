const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.2dlckac.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function connectDB() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}

module.exports = { connectDB, client };

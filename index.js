require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const { initializeFirebase } = require("./config/firebase");

const userRoutes = require("./routes/userRoutes");
const riderRoutes = require("./routes/riderRoutes");
const parcelRoutes = require("./routes/parcelRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const warehouseRoutes = require("./routes/wareHousesRoute");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase init
initializeFirebase();

// Routes
app.use("/users", userRoutes);
app.use("/riders", riderRoutes);
app.use("/parcels", parcelRoutes);
app.use("/payments", paymentRoutes);
app.use("/warehouseColl", warehouseRoutes);

// Test route
app.get("/", (req, res) => res.send("ProFast server is running"));

// DB connect + server start
connectDB().then(() => {
  app.listen(port, () => console.log(`Server running on port ${port}`));
});

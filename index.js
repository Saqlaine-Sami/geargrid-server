require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const equipmentRoutes = require("./routes/equipmentRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check route (no DB required)
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "GearGrid Equipment Rental API is running" });
});

// Ensure MongoDB connection on every API request (Vercel serverless safe)
app.use("/api", async (req, res, next) => {
  try {
    req.db = await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ message: "API route not found" });
});

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`GearGrid Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const passwordRoutes = require("./routes/passwordRoutes");
const adminRoutes = require("./routes/adminRoutes");
const twofaRoutes = require("./routes/2faRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
connectDB();

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/passwords", passwordRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/2fa", twofaRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

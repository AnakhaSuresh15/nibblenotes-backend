require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const commonRoutes = require("./routes/common");
const createLogRoutes = require("./routes/createLog");
const dashboardRoutes = require("./routes/dashboard");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
app.use(
  cors({
    origin:
      "https://nibblenotes-frontend.vercel.app" || "http://localhost:5173 ",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// CORS - allow your frontend origin
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true, // allow cookies
  })
);

app.use("/api/auth", authRoutes);
app.use("/api", authMiddleware);
app.use("/api/create-log", createLogRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", commonRoutes);

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI || "mongodb://localhost:27017/nibblenotes";

mongoose
  .connect(MONGO)
  .then(() => {
    console.log("Mongo connected");
    app.listen(PORT, () => console.log("Server listening on", PORT));
  })
  .catch((e) => {
    console.error("Mongo connect failed", e);
  });

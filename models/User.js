// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true, default: "" },
  lastName: { type: String, trim: true, default: "" },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  preferences: {
    defaultMoodBefore: { type: String, default: "content" },
    defaultMoodAfter: { type: String, default: "content" },
    defaultServingSize: { type: Number, default: 1 },
    themePreference: { type: String, default: "system" },
  },
});

module.exports = mongoose.model("User", userSchema);

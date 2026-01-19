// models/User.js
const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  dishName: { type: String, required: true, trim: true },
  createdAt: { type: Date, required: true },
  createdBy: { type: String, required: true, trim: true },
  image: { type: String, required: false },
  ingredients: { type: Array, required: true },
  preparationMethod: { type: String, required: false, trim: true },
  servings: { type: Number, required: true },
  calories: { type: Number, required: true },
  physicalFeedback: { type: Array, required: true },
  tags: { type: Array, required: true },
  moodBeforeSelection: { type: String, required: false },
  moodAfterSelection: { type: String, required: false },
  reflection: { type: String, required: false, trim: true },
  date: { type: Date, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

module.exports = mongoose.model("Log", logSchema);

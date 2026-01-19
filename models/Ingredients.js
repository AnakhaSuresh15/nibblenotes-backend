// models/User.js
const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
});

module.exports = mongoose.model("Ingredients", ingredientSchema);

const express = require("express");
const router = express.Router();
const Ingredient = require("../models/Ingredients");
const Log = require("../models/Log");

router.post("/", async (req, res) => {
  try {
    const log = new Log(req.body);
    userId = req.user.id;
    log.userId = userId;
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    console.error("Error creating log:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    } else {
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/ingredients", async (req, res) => {
  const query = req.query.query?.trim();

  if (!query || query.length < 2) {
    return res.json([]);
  }

  const ingredients = await Ingredient.db
    .collection("ingredients")
    .find({
      name: { $regex: `^${query}`, $options: "i" },
    })
    .limit(10)
    .toArray();

  res.json(ingredients);
});

module.exports = router;

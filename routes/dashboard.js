const express = require("express");
const router = express.Router();
const Log = require("../models/Log");
const mongoose = require("mongoose");

router.get("/summary", async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // ----- TODAY RANGE (UTC-safe) -----
    const today = new Date();
    const startOfDay = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const endOfDay = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    const mealsToday = await Log.countDocuments({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    const totalMeals = await Log.countDocuments({ userId });

    // ----- STREAK CALCULATION -----
    let streak = 0;
    let cursorDate = new Date(startOfDay);

    while (true) {
      const dayStart = new Date(cursorDate);
      const dayEnd = new Date(cursorDate);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const exists = await Log.exists({
        userId,
        date: { $gte: dayStart, $lte: dayEnd },
      });

      if (!exists) break;

      streak++;
      cursorDate.setUTCDate(cursorDate.getUTCDate() - 1);
      cursorDate.setUTCHours(0, 0, 0, 0);
    }

    // ----- RECENT MEALS -----
    const recentMeals = await Log.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // ----- MEALS PER DAY -----
    const days = 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const mealsPerDay = await Log.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%b %d", date: "$date" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).then((res) => res.map((r) => ({ date: r._id, count: r.count })));

    const total = mealsPerDay.reduce((sum, d) => sum + d.count, 0);
    const avgMealsPerDay = total / days;

    res.status(200).json({
      mealsToday,
      totalMeals,
      streak,
      recentMeals,
      mealsPerDay,
      avgMealsPerDay: Number(avgMealsPerDay.toFixed(1)),
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

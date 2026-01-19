const express = require("express");
const User = require("../models/User");
const Log = require("../models/Log");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/logs", async (req, res) => {
  const date = req.query.date;
  const logId = req.query.logId;
  if (logId) {
    // Fetch log by ID
    try {
      const log = await Log.findById(logId);
      if (!log) return res.status(404).json({ message: "Log not found" });
      return res.json(log);
    } catch (error) {
      return res.status(500).json({ message: "Error fetching log", error });
    }
  } else if (!date) {
    return res
      .status(400)
      .json({ message: "Date query parameter is required" });
  } else {
    try {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const logs = await Log.find({
        createdAt: { $gte: start, $lte: end },
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching logs for date", error });
    }
  }
});

router.patch("/edit-log/:logId", async (req, res) => {
  const { logId } = req.params;
  if (logId) {
    try {
      const { logId } = req.params;
      const userId = req.user.id;

      if (!logId) {
        return res.status(400).json({ message: "logId is required" });
      }

      const updates = req.body;

      // Guard: nothing to update
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      // Never allow these fields to be patched
      const forbiddenFields = ["_id", "userId", "createdBy", "createdAt"];
      forbiddenFields.forEach((field) => delete updates[field]);

      const updatedLog = await Log.findOneAndUpdate(
        { _id: logId, userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!updatedLog) {
        return res.status(404).json({ message: "Log not found" });
      }

      res.status(200).json({
        message: "Log updated successfully",
        log: updatedLog,
      });
    } catch (error) {
      console.error("Error editing log:", error);
      res.status(500).json({ message: "Error editing the log" });
    }
  }
});

router.delete("/delete-log/:logId", async (req, res) => {
  const { logId } = req.params;

  if (!logId) {
    return res.status(400).json({ message: "logId is required" });
  }
  try {
    const deletedLog = await Log.findByIdAndDelete(logId);
    if (!deletedLog) {
      return res.status(404).json({ message: "Log not found" });
    }
    res.status(200).json({ message: "Log deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting log", error });
  }
});

router.delete("/delete-logs", async (req, res) => {
  const { logs } = req.query;
  let logsArray = [];
  if (Array.isArray(logs)) {
    logsArray = logs;
  } else if (typeof logs === "string" && logs.trim() !== "") {
    logsArray = logs
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== "");
  }

  if (logsArray.length === 0) {
    return res.status(400).json({ message: "logs parameter is required" });
  }
  try {
    const result = await Log.deleteMany({ _id: { $in: logsArray } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "No logs found to delete" });
    }
    return res.status(200).json({
      message: "Logs deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting logs", error });
  }
});

router.get("/insights-data", async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Number(req.query.timeFilter) || 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const prevEndDate = startDate;
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Meals per day
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

    //Previous consistency
    const previousMealsPerDay = await Log.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: prevStartDate, $lt: prevEndDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
        },
      },
    ]);

    const currentConsistency = mealsPerDay.length;
    const previousConsistency = previousMealsPerDay.length;

    //Consistency percentage change
    let consistencyChangePercent = 0;

    if (previousConsistency === 0 && currentConsistency > 0) {
      consistencyChangePercent = 100;
    } else if (previousConsistency > 0) {
      consistencyChangePercent =
        ((currentConsistency - previousConsistency) / previousConsistency) *
        100;
    }

    consistencyChangePercent = Number(consistencyChangePercent.toFixed(1));

    // Average meals per calendar day
    const totalMeals = mealsPerDay.reduce((sum, d) => sum + d.count, 0);
    const avgMealsPerDay = totalMeals / days;

    // Streaks
    const loggedDates = mealsPerDay.map((d) => d.date);
    let longestStreak = 0;

    // Sort dates in ascending order
    const sortedDates = loggedDates
      .map((d) => new Date(d).setHours(0, 0, 0, 0))
      .sort((a, b) => a - b);

    let tempStreak = 1;
    longestStreak = sortedDates.length > 0 ? 1 : 0;

    for (let i = 1; i < sortedDates.length; i++) {
      if (sortedDates[i] - sortedDates[i - 1] === 86400000) {
        tempStreak++;
      } else if (sortedDates[i] !== sortedDates[i - 1]) {
        tempStreak = 1;
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    }

    // Calculate current streak (ending at the most recent date)
    let currentStreak = 0;
    if (sortedDates.length > 0) {
      currentStreak = 1;
      for (let i = sortedDates.length - 1; i > 0; i--) {
        if (sortedDates[i] - sortedDates[i - 1] === 86400000) {
          currentStreak++;
        } else if (sortedDates[i] !== sortedDates[i - 1]) {
          break;
        }
      }
    }

    // Most common time (based on date)
    const timeBuckets = await Log.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate },
        },
      },
      {
        $project: {
          hour: { $hour: "$date" },
        },
      },
      {
        $project: {
          timeOfDay: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $gte: ["$hour", 5] }, { $lt: ["$hour", 10] }],
                  },
                  then: "Breakfast,5-10 AM",
                },
                {
                  case: {
                    $and: [{ $gte: ["$hour", 10] }, { $lt: ["$hour", 14] }],
                  },
                  then: "Lunch,10 AM-2 PM",
                },
                {
                  case: {
                    $and: [{ $gte: ["$hour", 14] }, { $lt: ["$hour", 17] }],
                  },
                  then: "Snack,2-5 PM",
                },
                {
                  case: {
                    $and: [{ $gte: ["$hour", 17] }, { $lt: ["$hour", 21] }],
                  },
                  then: "Dinner,5-9 PM",
                },
              ],
              default: "Late,9 PM-5 AM",
            },
          },
        },
      },
      {
        $group: {
          _id: "$timeOfDay",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const mostCommonTime = timeBuckets[0]?._id ?? null;

    // Top meals
    const topMeals = await Log.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$dishName",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).then((res) => res.map((r) => ({ meal: r._id, count: r.count })));

    // Meal distribution (tags)
    const mealDistributionRaw = await Log.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate },
        },
      },
      { $unwind: "$tags" },
      { $match: { tags: { $in: ["breakfast", "lunch", "dinner"] } } },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
    ]);

    const mealDistribution = mealDistributionRaw.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    // Top tags
    const topTags = await Log.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate },
        },
      },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).then((res) => res.map((r) => ({ tag: r._id, count: r.count })));

    // Top physical feedback
    const topPhysicalFeedback = await Log.aggregate([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate },
        },
      },
      { $unwind: "$physicalFeedback" },
      {
        $group: {
          _id: "$physicalFeedback",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).then((res) => res.map((r) => ({ feedback: r._id, count: r.count })));

    res.status(200).json({
      avgMealsPerDay: Number(avgMealsPerDay.toFixed(1)),
      longestStreak,
      currentStreak,
      mostCommonTime,
      mealsPerDay,
      mealDistribution,
      topTags,
      topMeals,
      topPhysicalFeedback,
      noOfDaysLogged: currentConsistency,
      consistencyChangePercent,
    });
  } catch (error) {
    console.error("Error fetching insights data:", error);
    res.status(500).json({ message: "Error fetching insights data" });
  }
});

router.get("/settings", async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const name = user.firstName + " " + user.lastName;
    const email = user.email;

    res.status(200).json({ name, email });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ message: "Error fetching user settings" });
  }
});

router.post("/update-settings", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;
    const [firstName, ...lastNameParts] = name.split(" ");
    const lastName = lastNameParts.join(" ");
    await User.findByIdAndUpdate(userId, {
      firstName,
      lastName,
      email,
    });
    res.status(200).json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ message: "Error updating user settings" });
  }
});

module.exports = router;

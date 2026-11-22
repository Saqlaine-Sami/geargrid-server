const express = require("express");
const {
  verifyToken,
  verifyOwner,
  verifyAdmin,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Challenge 3: Admin Dashboard Analytics
router.get("/admin", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalEquipment,
      totalBookings,
      pendingApprovals,
      completedRentals,
      revenueAgg,
      monthlyBookings,
    ] = await Promise.all([
      req.db.collection("users").countDocuments(),
      req.db.collection("equipment").countDocuments(),
      req.db.collection("bookings").countDocuments(),
      req.db.collection("equipment").countDocuments({ status: "Pending" }),
      req.db.collection("bookings").countDocuments({ bookingStatus: "completed" }),
      req.db
        .collection("payments")
        .aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
        ])
        .toArray(),
      req.db
        .collection("bookings")
        .aggregate([
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$bookingDate" } },
              bookings: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, month: "$_id", bookings: 1, revenue: 1 } },
        ])
        .toArray(),
    ]);

    res.json({
      totalUsers,
      totalEquipment,
      totalBookings,
      pendingApprovals,
      completedRentals,
      totalRevenue: revenueAgg[0]?.totalRevenue || 0,
      monthlyBookings,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load admin analytics" });
  }
});

// Challenge 3: Owner Dashboard Analytics
router.get("/owner", verifyToken, verifyOwner, async (req, res) => {
  try {
    const ownerEmail = req.decoded.email;
    const [totalListedEquipment, completedRentals, earningsAgg, monthlyEarnings] =
      await Promise.all([
        req.db.collection("equipment").countDocuments({ ownerEmail }),
        req.db
          .collection("bookings")
          .countDocuments({ ownerEmail, bookingStatus: "completed" }),
        req.db
          .collection("payments")
          .aggregate([
            { $match: { ownerEmail, paymentStatus: "paid" } },
            { $group: { _id: null, totalEarnings: { $sum: "$amount" } } },
          ])
          .toArray(),
        req.db
          .collection("payments")
          .aggregate([
            { $match: { ownerEmail, paymentStatus: "paid" } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
                earnings: { $sum: "$amount" },
                rentals: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, month: "$_id", earnings: 1, rentals: 1 } },
          ])
          .toArray(),
      ]);

    res.json({
      totalListedEquipment,
      completedRentals,
      totalEarnings: earningsAgg[0]?.totalEarnings || 0,
      monthlyEarnings,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load owner analytics" });
  }
});

module.exports = router;

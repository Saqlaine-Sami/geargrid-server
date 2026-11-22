const express = require("express");

const router = express.Router();

// Home Page Featured Equipment: 6 approved items using MongoDB limit
router.get("/featured", async (req, res) => {
  try {
    const items = await req.db
      .collection("equipment")
      .find({ status: "Approved" })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to load featured equipment" });
  }
});

// Challenge 1: Server-side search, filtering, and sorting on approved equipment
router.get("/", async (req, res) => {
  try {
    const { search, category, rentalType, minPrice, maxPrice, availability, sort } =
      req.query;
    const query = { status: "Approved" };

    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: "i" };
      query.$or = [{ name: regex }, { location: regex }, { category: regex }];
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (rentalType && rentalType !== "All") {
      query.rentalType = rentalType;
    }

    if (minPrice || maxPrice) {
      query.rentalPrice = {};
      if (minPrice !== undefined && minPrice !== "") {
        query.rentalPrice.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && maxPrice !== "") {
        query.rentalPrice.$lte = Number(maxPrice);
      }
    }

    if (availability === "available") {
      query.availableQuantity = { $gt: 0 };
    } else if (availability === "unavailable") {
      query.availableQuantity = { $lte: 0 };
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { rentalPrice: 1 };
    else if (sort === "price_desc") sortOption = { rentalPrice: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };

    const items = await req.db
      .collection("equipment")
      .find(query)
      .sort(sortOption)
      .toArray();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch equipment" });
  }
});

module.exports = router;

const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyToken, verifyRenter } = require("../middlewares/authMiddleware");

const router = express.Router();

// Get currently logged-in customer's favorites
router.get("/", verifyToken, verifyRenter, async (req, res) => {
  try {
    const favorites = await req.db
      .collection("favorites")
      .find({ customerEmail: req.decoded.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
});

// Save favorite equipment in the database
router.post("/", verifyToken, verifyRenter, async (req, res) => {
  try {
    const { equipmentId } = req.body;
    if (!ObjectId.isValid(equipmentId)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }

    const existingFav = await req.db.collection("favorites").findOne({
      customerEmail: req.decoded.email,
      equipmentId,
    });
    if (existingFav) {
      return res.status(409).json({ message: "Already in your favorites list" });
    }

    const equipment = await req.db
      .collection("equipment")
      .findOne({ _id: new ObjectId(equipmentId) });
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const favDoc = {
      customerEmail: req.decoded.email,
      equipmentId,
      equipmentName: equipment.name,
      category: equipment.category,
      rentalPrice: equipment.rentalPrice,
      rentalType: equipment.rentalType,
      location: equipment.location,
      image: equipment.image,
      createdAt: new Date(),
    };

    const result = await req.db.collection("favorites").insertOne(favDoc);
    res.status(201).json({
      message: "Added to favorites",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add favorite" });
  }
});

// Remove equipment from customer's favorites
router.delete("/:equipmentId", verifyToken, verifyRenter, async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const filter = {
      customerEmail: req.decoded.email,
      $or: [{ equipmentId }],
    };
    if (ObjectId.isValid(equipmentId)) {
      filter.$or.push({ _id: new ObjectId(equipmentId) });
    }
    await req.db.collection("favorites").deleteOne(filter);
    res.json({ message: "Removed from favorites" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove favorite" });
  }
});

module.exports = router;

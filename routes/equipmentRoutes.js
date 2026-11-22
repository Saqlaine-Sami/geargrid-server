const express = require("express");
const { ObjectId } = require("mongodb");
const {
  verifyToken,
  verifyOwner,
  verifyAdmin,
} = require("../middlewares/authMiddleware");

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

// Owner: list currently logged-in owner's equipment
router.get("/owner/me", verifyToken, verifyOwner, async (req, res) => {
  try {
    const items = await req.db
      .collection("equipment")
      .find({ ownerEmail: req.decoded.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch owner equipment" });
  }
});

// Admin: list all equipment regardless of status
router.get("/admin/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const items = await req.db
      .collection("equipment")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch all equipment" });
  }
});

// Private Route: single equipment details
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }
    const item = await req.db
      .collection("equipment")
      .findOne({ _id: new ObjectId(id) });
    if (!item) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to load equipment details" });
  }
});

// Owner: add new equipment (defaults to Pending status)
router.post("/", verifyToken, verifyOwner, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      location,
      rentalPrice,
      rentalType,
      availableQuantity,
      condition,
      brand,
      model,
      image,
      terms,
    } = req.body;

    if (!name || !category || !location || !rentalPrice || !rentalType || !image) {
      return res.status(400).json({ message: "Please fill all required fields" });
    }

    const newEquipment = {
      name: name.trim(),
      description: description?.trim() || "",
      category,
      location: location.trim(),
      rentalPrice: Number(rentalPrice),
      rentalType,
      availableQuantity: Number(availableQuantity) || 1,
      condition: condition || "Good",
      brand: brand?.trim() || "",
      model: model?.trim() || "",
      image,
      terms: terms?.trim() || "",
      status: "Pending",
      ownerName: req.currentUser.name,
      ownerEmail: req.currentUser.email,
      ownerPhone: req.currentUser.phone || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await req.db.collection("equipment").insertOne(newEquipment);
    res.status(201).json({
      message: "Equipment added successfully (Pending admin approval)",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add equipment" });
  }
});

// Owner (own item) or Admin: update equipment
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }

    const user = await req.db
      .collection("users")
      .findOne({ email: req.decoded.email });
    const existing = await req.db
      .collection("equipment")
      .findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const isAdmin = user?.role === "Admin";
    const isOwnerOfItem =
      user?.role === "Owner" && existing.ownerEmail === user.email;

    if (!isAdmin && !isOwnerOfItem) {
      return res.status(403).json({ message: "Forbidden: Not allowed to update this item" });
    }

    const {
      name,
      description,
      category,
      location,
      rentalPrice,
      rentalType,
      availableQuantity,
      condition,
      brand,
      model,
      image,
      terms,
    } = req.body;

    const updateFields = {
      name: name ?? existing.name,
      description: description ?? existing.description,
      category: category ?? existing.category,
      location: location ?? existing.location,
      rentalPrice: rentalPrice !== undefined ? Number(rentalPrice) : existing.rentalPrice,
      rentalType: rentalType ?? existing.rentalType,
      availableQuantity:
        availableQuantity !== undefined
          ? Number(availableQuantity)
          : existing.availableQuantity,
      condition: condition ?? existing.condition,
      brand: brand ?? existing.brand,
      model: model ?? existing.model,
      image: image ?? existing.image,
      terms: terms ?? existing.terms,
      updatedAt: new Date(),
    };

    await req.db
      .collection("equipment")
      .updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    res.json({ message: "Equipment updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update equipment" });
  }
});

// Admin: approve or reject equipment
router.patch("/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }
    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    await req.db
      .collection("equipment")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date() } });
    res.json({ message: `Equipment status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: "Failed to update equipment status" });
  }
});

// Owner (own item) or Admin: delete equipment
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }
    const user = await req.db
      .collection("users")
      .findOne({ email: req.decoded.email });
    const existing = await req.db
      .collection("equipment")
      .findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const isAdmin = user?.role === "Admin";
    const isOwnerOfItem =
      user?.role === "Owner" && existing.ownerEmail === user.email;

    if (!isAdmin && !isOwnerOfItem) {
      return res.status(403).json({ message: "Forbidden: Not allowed to delete this item" });
    }

    await req.db.collection("equipment").deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Equipment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete equipment" });
  }
});

module.exports = router;

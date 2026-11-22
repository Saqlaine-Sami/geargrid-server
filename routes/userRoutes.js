const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyToken, verifyAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

// Get current logged-in user's profile
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await req.db
      .collection("users")
      .findOne({ email: req.decoded.email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image || "",
      phone: user.phone || "",
      address: user.address || "",
      role: user.role || "Customer",
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load profile" });
  }
});

// Update current logged-in user's profile
router.patch("/me", verifyToken, async (req, res) => {
  try {
    const { name, image, phone, address } = req.body;
    const updateDoc = {
      $set: {
        name: name?.trim() || "",
        image: image || "",
        phone: phone || "",
        address: address || "",
        updatedAt: new Date(),
      },
    };

    await req.db.collection("users").updateOne({ email: req.decoded.email }, updateDoc);
    const updatedUser = await req.db
      .collection("users")
      .findOne({ email: req.decoded.email });

    res.json({
      message: "Profile updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        image: updatedUser.image || "",
        phone: updatedUser.phone || "",
        address: updatedUser.address || "",
        role: updatedUser.role || "Customer",
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Admin: get all registered users
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await req.db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(
      users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        image: u.image || "",
        role: u.role || "Customer",
        createdAt: u.createdAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Admin: change user role (Customer, Owner, Admin)
router.patch("/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!["Customer", "Owner", "Admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    await req.db
      .collection("users")
      .updateOne({ _id: new ObjectId(id) }, { $set: { role, updatedAt: new Date() } });

    res.json({ message: `User role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user role" });
  }
});

// Admin: delete user
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const targetUser = await req.db
      .collection("users")
      .findOne({ _id: new ObjectId(id) });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.email === req.decoded.email) {
      return res.status(400).json({ message: "You cannot delete your own admin account" });
    }

    await req.db.collection("users").deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;

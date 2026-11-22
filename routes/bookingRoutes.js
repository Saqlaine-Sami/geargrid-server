const express = require("express");
const { ObjectId } = require("mongodb");
const Stripe = require("stripe");
const {
  verifyToken,
  verifyRenter,
  verifyOwner,
  verifyAdmin,
} = require("../middlewares/authMiddleware");
const { calculateRentalAmount } = require("../utils/pricing");

const router = express.Router();

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Create booking record and Stripe Checkout session
router.post("/checkout", verifyToken, verifyRenter, async (req, res) => {
  try {
    const {
      equipmentId,
      startDate,
      endDate,
      requiredQuantity,
      contactNumber,
      deliveryAddress,
      additionalNotes,
    } = req.body;

    if (!ObjectId.isValid(equipmentId)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }
    if (!startDate || !endDate || !requiredQuantity || !contactNumber || !deliveryAddress) {
      return res.status(400).json({ message: "All required booking fields must be filled" });
    }
    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ message: "End date must be after start date" });
    }

    const equipment = await req.db
      .collection("equipment")
      .findOne({ _id: new ObjectId(equipmentId) });
    if (!equipment || equipment.status !== "Approved") {
      return res.status(404).json({ message: "Equipment is not available for booking" });
    }

    const qty = Number(requiredQuantity);
    if (qty < 1 || qty > equipment.availableQuantity) {
      return res.status(400).json({
        message: `Only ${equipment.availableQuantity} unit(s) available right now`,
      });
    }

    const { days, units, totalAmount } = calculateRentalAmount(
      startDate,
      endDate,
      equipment.rentalPrice,
      equipment.rentalType,
      qty
    );

    const bookingDoc = {
      equipmentId: equipment._id.toString(),
      equipmentName: equipment.name,
      equipmentCategory: equipment.category,
      equipmentImage: equipment.image,
      rentalType: equipment.rentalType,
      rentalPrice: equipment.rentalPrice,
      customerName: req.currentUser.name,
      customerEmail: req.currentUser.email,
      contactNumber,
      deliveryAddress,
      additionalNotes: additionalNotes || "",
      ownerName: equipment.ownerName,
      ownerEmail: equipment.ownerEmail,
      startDate,
      endDate,
      durationDays: days,
      billingUnits: units,
      requiredQuantity: qty,
      totalAmount,
      paymentStatus: "unpaid",
      bookingStatus: "pending",
      bookingDate: new Date(),
    };

    const bookingResult = await req.db.collection("bookings").insertOne(bookingDoc);
    const bookingId = bookingResult.insertedId.toString();

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: req.currentUser.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${equipment.name} (${equipment.rentalType} Rental)`,
              description: `Duration: ${startDate} to ${endDate} | Qty: ${qty}`,
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId,
        equipmentId: equipment._id.toString(),
        customerEmail: req.currentUser.email,
        ownerEmail: equipment.ownerEmail,
      },
      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${bookingId}`,
      cancel_url: `${process.env.CLIENT_URL}/payment/cancel?bookingId=${bookingId}`,
    });

    await req.db
      .collection("bookings")
      .updateOne(
        { _id: bookingResult.insertedId },
        { $set: { stripeSessionId: session.id } }
      );

    res.json({ url: session.url, bookingId });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    res.status(500).json({ message: error.message || "Failed to initiate payment" });
  }
});

// Cleanup unpaid booking if user cancels Stripe Checkout
router.delete("/:id/cancel-unpaid", verifyToken, verifyRenter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }
    await req.db.collection("bookings").deleteOne({
      _id: new ObjectId(id),
      customerEmail: req.decoded.email,
      paymentStatus: "unpaid",
    });
    res.json({ message: "Unpaid booking removed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to clean unpaid booking" });
  }
});

// Customer: get own rental bookings
router.get("/customer", verifyToken, verifyRenter, async (req, res) => {
  try {
    const bookings = await req.db
      .collection("bookings")
      .find({ customerEmail: req.decoded.email })
      .sort({ bookingDate: -1 })
      .toArray();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch customer rentals" });
  }
});

// Owner: get rentals for owner's equipment
router.get("/owner", verifyToken, verifyOwner, async (req, res) => {
  try {
    const bookings = await req.db
      .collection("bookings")
      .find({ ownerEmail: req.decoded.email })
      .sort({ bookingDate: -1 })
      .toArray();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch owner rentals" });
  }
});

// Admin: get all rental bookings
router.get("/admin", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const bookings = await req.db
      .collection("bookings")
      .find({})
      .sort({ bookingDate: -1 })
      .toArray();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch all rentals" });
  }
});

// Owner (own equipment) or Admin: update booking status
router.patch("/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingStatus } = req.body;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }
    if (!["pending", "confirmed", "completed", "cancelled"].includes(bookingStatus)) {
      return res.status(400).json({ message: "Invalid booking status" });
    }

    const user = await req.db
      .collection("users")
      .findOne({ email: req.decoded.email });
    const booking = await req.db
      .collection("bookings")
      .findOne({ _id: new ObjectId(id) });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const isAdmin = user?.role === "Admin";
    const isOwner = user?.role === "Owner" && booking.ownerEmail === user.email;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (
      booking.bookingStatus === "confirmed" &&
      (bookingStatus === "completed" || bookingStatus === "cancelled") &&
      ObjectId.isValid(booking.equipmentId)
    ) {
      await req.db
        .collection("equipment")
        .updateOne(
          { _id: new ObjectId(booking.equipmentId) },
          { $inc: { availableQuantity: booking.requiredQuantity } }
        );
    }

    await req.db
      .collection("bookings")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { bookingStatus, updatedAt: new Date() } }
      );

    res.json({ message: `Booking status updated to ${bookingStatus}` });
  } catch (error) {
    res.status(500).json({ message: "Failed to update booking status" });
  }
});

module.exports = router;

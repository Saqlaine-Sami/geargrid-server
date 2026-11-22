const express = require("express");
const { ObjectId } = require("mongodb");
const Stripe = require("stripe");
const { verifyToken, verifyRenter } = require("../middlewares/authMiddleware");

const router = express.Router();

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Confirm Stripe Checkout payment, update booking paymentStatus, and record transaction in payments collection
router.post("/confirm", verifyToken, verifyRenter, async (req, res) => {
  try {
    const { sessionId, bookingId } = req.body;
    if (!sessionId || !bookingId || !ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: "Invalid payment confirmation data" });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment has not been completed" });
    }
    if (session.metadata?.customerEmail !== req.decoded.email) {
      return res.status(403).json({ message: "Forbidden: Payment owner mismatch" });
    }

    const existingPayment = await req.db
      .collection("payments")
      .findOne({ stripeSessionId: sessionId });
    const booking = await req.db
      .collection("bookings")
      .findOne({ _id: new ObjectId(bookingId) });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (existingPayment) {
      return res.json({
        message: "Payment already confirmed",
        booking,
        payment: existingPayment,
      });
    }

    const transactionId = session.payment_intent || session.id;

    await req.db.collection("bookings").updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          paymentStatus: "paid",
          bookingStatus: "confirmed",
          transactionId,
          paidAt: new Date(),
        },
      }
    );

    if (ObjectId.isValid(booking.equipmentId)) {
      await req.db.collection("equipment").updateOne(
        {
          _id: new ObjectId(booking.equipmentId),
          availableQuantity: { $gte: booking.requiredQuantity },
        },
        { $inc: { availableQuantity: -booking.requiredQuantity } }
      );
    }

    const paymentDoc = {
      bookingId,
      equipmentId: booking.equipmentId,
      equipmentName: booking.equipmentName,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      ownerEmail: booking.ownerEmail,
      amount: booking.totalAmount,
      transactionId,
      stripeSessionId: sessionId,
      paymentStatus: "paid",
      paidAt: new Date(),
    };

    await req.db.collection("payments").insertOne(paymentDoc);
    const updatedBooking = await req.db
      .collection("bookings")
      .findOne({ _id: new ObjectId(bookingId) });

    res.json({
      message: "Payment verified and booking confirmed",
      booking: updatedBooking,
      payment: paymentDoc,
    });
  } catch (error) {
    console.error("Payment confirmation error:", error);
    res.status(500).json({ message: "Failed to verify Stripe payment" });
  }
});

module.exports = router;

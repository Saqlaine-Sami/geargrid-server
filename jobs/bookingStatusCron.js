const cron = require("node-cron");
const { ObjectId } = require("mongodb");
const { connectDB } = require("../config/db");
const { sendBookingCompletedEmails } = require("../utils/mailer");

async function updateExpiredBookings(dbInstance = null) {
  const db = dbInstance || (await connectDB());
  const todayISO = new Date().toISOString().split("T")[0];

  const expiredBookings = await db
    .collection("bookings")
    .find({
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      endDate: { $lt: todayISO },
    })
    .toArray();

  let updatedCount = 0;

  for (const booking of expiredBookings) {
    const updateRes = await db.collection("bookings").updateOne(
      { _id: booking._id, bookingStatus: "confirmed" },
      {
        $set: {
          bookingStatus: "completed",
          autoCompleted: true,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (updateRes.modifiedCount > 0) {
      updatedCount++;

      if (ObjectId.isValid(booking.equipmentId)) {
        await db
          .collection("equipment")
          .updateOne(
            { _id: new ObjectId(booking.equipmentId) },
            { $inc: { availableQuantity: Number(booking.requiredQuantity) || 1 } }
          );
      }

      const emailRes = await sendBookingCompletedEmails(booking);
      if (emailRes.sent) {
        await db
          .collection("bookings")
          .updateOne(
            { _id: booking._id },
            { $set: { emailNotificationSent: true } }
          );
      }
    }
  }

  return {
    checkedDate: todayISO,
    matchedCount: expiredBookings.length,
    updatedCount,
  };
}

function startBookingStatusCron() {
  // Runs every hour on persistent Node servers to auto-complete expired rentals
  const task = cron.schedule("0 * * * *", async () => {
    try {
      const result = await updateExpiredBookings();
      if (result.updatedCount > 0) {
        console.log(
          `[Cron] Auto-completed ${result.updatedCount} expired booking(s) for date < ${result.checkedDate}`
        );
      }
    } catch (error) {
      console.error("[Cron] Booking status update failed:", error.message);
    }
  });

  console.log("[Cron] Scheduled hourly automated booking status update job");
  return task;
}

module.exports = { updateExpiredBookings, startBookingStatusCron };

const nodemailer = require("nodemailer");

function createTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendBookingCompletedEmails(booking) {
  const transporter = createTransporter();
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    "no-reply@geargrid-rentals.com";

  const renterMail = {
    from: `"GearGrid Rentals" <${from}>`,
    to: booking.customerEmail,
    subject: `Rental Completed: ${booking.equipmentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f766e;">Your Rental Booking is Completed</h2>
        <p>Hi <strong>${booking.customerName}</strong>,</p>
        <p>Your equipment rental booking on <strong>GearGrid</strong> has been marked as <strong>Completed</strong>.</p>
        <div style="background: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Equipment:</strong> ${booking.equipmentName}</p>
          <p style="margin: 4px 0;"><strong>Rental Period:</strong> ${booking.startDate} to ${booking.endDate}</p>
          <p style="margin: 4px 0;"><strong>Quantity:</strong> ${booking.requiredQuantity}</p>
          <p style="margin: 4px 0;"><strong>Total Paid:</strong> $${booking.totalAmount}</p>
        </div>
        <p>Thank you for choosing GearGrid! We look forward to serving your next project.</p>
      </div>
    `,
  };

  const ownerMail = {
    from: `"GearGrid Rentals" <${from}>`,
    to: booking.ownerEmail,
    subject: `Booking Completed for Your Equipment: ${booking.equipmentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f766e;">Equipment Rental Completed</h2>
        <p>Hi <strong>${booking.ownerName}</strong>,</p>
        <p>A rental booking for your listed equipment has been marked as <strong>Completed</strong> and the inventory quantity has been restored.</p>
        <div style="background: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Equipment:</strong> ${booking.equipmentName}</p>
          <p style="margin: 4px 0;"><strong>Renter:</strong> ${booking.customerName} (${booking.customerEmail})</p>
          <p style="margin: 4px 0;"><strong>Rental Period:</strong> ${booking.startDate} to ${booking.endDate}</p>
          <p style="margin: 4px 0;"><strong>Quantity:</strong> ${booking.requiredQuantity}</p>
          <p style="margin: 4px 0;"><strong>Booking Amount:</strong> $${booking.totalAmount}</p>
        </div>
        <p>View updated analytics anytime in your GearGrid Owner Dashboard.</p>
      </div>
    `,
  };

  if (!transporter) {
    console.log(
      `[Email Notification - SMTP not configured] Would send completion emails to Renter (${booking.customerEmail}) and Owner (${booking.ownerEmail}) for ${booking.equipmentName}`
    );
    return { sent: false, reason: "SMTP credentials not configured" };
  }

  try {
    await Promise.all([
      transporter.sendMail(renterMail),
      transporter.sendMail(ownerMail),
    ]);
    console.log(
      `[Email Notification] Completion emails sent to ${booking.customerEmail} and ${booking.ownerEmail}`
    );
    return { sent: true };
  } catch (error) {
    console.error("[Email Notification] Failed to send emails:", error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { sendBookingCompletedEmails };

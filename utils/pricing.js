function calculateRentalAmount(startDate, endDate, rentalPrice, rentalType, quantity) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  let units = days;
  if (rentalType === "Weekly") {
    units = Math.max(1, Math.ceil(days / 7));
  } else if (rentalType === "Monthly") {
    units = Math.max(1, Math.ceil(days / 30));
  }

  return {
    days,
    units,
    totalAmount: Number((units * Number(rentalPrice) * Number(quantity)).toFixed(2)),
  };
}

module.exports = { calculateRentalAmount };

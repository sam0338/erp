function reservationConfirmationText(property, reservation, rooms) {
  const roomLines = rooms.map(r =>
    `• ${r.room_type_name}${r.room_number ? ' (Room ' + r.room_number + ')' : ' (room to be assigned)'} — Rs.${r.rate_per_night}/night`
  ).join('\n');

  return [
    `*Booking Confirmation — ${property.name}*`,
    '',
    `Dear ${reservation.guest_name},`,
    '',
    'Your reservation is confirmed. Details below:',
    '',
    `Booking Ref: ${reservation.booking_ref}`,
    `Arrival: ${reservation.arrival_date}`,
    `Departure: ${reservation.departure_date}`,
    '',
    'Rooms:',
    roomLines,
    '',
    property.name,
    [property.address, property.city].filter(Boolean).join(', '),
    property.phone ? `Phone: ${property.phone}` : '',
    '',
    'We look forward to welcoming you.'
  ].filter(line => line !== '').join('\n');
}

function invoiceSummaryText(property, reservation, summary, folio) {
  return [
    `*Invoice — ${property.name}*`,
    '',
    `Dear ${reservation.guest_name},`,
    '',
    `Thank you for staying with us. Folio ${folio.folio_number} for booking ${reservation.booking_ref}:`,
    '',
    `Total Amount: Rs.${summary.grand_total.toFixed(2)}`,
    `Paid: Rs.${summary.paid_total.toFixed(2)}`,
    `Balance: Rs.${summary.balance.toFixed(2)}`,
    '',
    property.name,
    [property.address, property.city].filter(Boolean).join(', '),
    '',
    'We hope to host you again soon.'
  ].filter(line => line !== '').join('\n');
}

module.exports = { reservationConfirmationText, invoiceSummaryText };

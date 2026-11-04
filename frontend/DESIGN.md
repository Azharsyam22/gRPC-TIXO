# TIXO Frontend Direction

**Reading:** cinema seat booking for moviegoers, in an editorial cinema language, at ENERGY 2 / RHYTHM 2 / MOTION 1.

## Identity

TIXO should feel like a considered cinema ticket desk after the house lights go down. Petrol noir and slate surfaces create the room; silver mist keeps the schedule and seat labels readable; tungsten amber marks booking actions and selected seats. A restrained serif display face gives the screen a film-journal character; a system sans keeps the seat labels quick to scan without an external font request.

## Tokens

- Space: petrol noir (`#0D1B1E`); raised surface: slate petrol (`#1B2D32`); primary text: silver mist (`#E3E8E5`).
- Booking accent: tungsten amber (`#D99A45`), with a deeper amber for hover and emphasis.
- Available: moss green; processing: soft gold; booked: muted coral. Status always includes a text label for assistive technology.
- Selected-seat chips use a perforated ticket edge as the interface motif.

## Composition and motion

The 5×10 seat map is the main focus. The order summary sits beside it on wide screens and below it on phones. Motion only marks direct feedback: a seat press, a short status pulse while reconnecting, and the booking spinner. Reduced-motion preferences turn those effects off.

The home view starts with a full-width, automatically advancing film and promotion banner, followed by a compact Now Showing carousel and a raised slate trailer shelf. Film cards use equal vertical poster frames with rounded corners. Trailer controls use the tungsten accent as a restrained navigation signal; verified trailers play in an in-page YouTube player. Promotional copy is explicitly marked as a local simulation and never changes checkout pricing. Movie cards show their poster, edition, rating, synopsis, and a direct route to the schedule. A petrol footer groups working page navigation and the current service state. The booking view follows the selected film with studio, date, showtime, and seat controls. The local demo offers three studios; backend studio choices follow the schedule records returned by the server.

## Content boundary

Use the movie, studio, schedule IDs, seat fields, and statuses from the seed data and `proto/tixo.proto`. The project does not have account, rating, price, or payment RPCs, so the interface labels those details unavailable and keeps payment controls disabled. Demo mode must say that it does not change the database.

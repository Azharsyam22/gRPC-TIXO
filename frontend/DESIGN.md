# TIXO Frontend Direction

**Reading:** cinema seat booking for moviegoers, in an editorial cinema language, at ENERGY 2 / RHYTHM 2 / MOTION 1.

## Identity

TIXO should feel like a considered cinema ticket desk. Warm paper and dark ink give the film title room to lead. Film red marks the booking action and the selected seats. A restrained serif display face gives the screen a film-journal character; a system sans keeps the seat labels quick to scan without an external font request.

## Tokens

- Paper: `#f1eee7`; raised paper: `#fbfaf6`; ink: `#292620`.
- Booking accent: `#a43c35`.
- Available: green; processing: amber; booked: muted red. Status always includes a text label for assistive technology.
- Selected-seat chips use a perforated ticket edge as the interface motif.

## Composition and motion

The 5×10 seat map is the main focus. The order summary sits beside it on wide screens and below it on phones. Motion only marks direct feedback: a seat press, a short status pulse while reconnecting, and the booking spinner. Reduced-motion preferences turn those effects off.

The discovery header and hero keep the booking task in the same editorial frame. A CSS drawn space horizon gives the featured film a poster scale without adding a copied or generated poster asset. Date and showtime filters reflect seeded schedules only; the venue field stays singular because the seed contains one studio.

## Content boundary

Use the movie, studio, schedule IDs, seat fields, and statuses from the seed data and `proto/tixo.proto`. The project does not have account, rating, price, or payment RPCs, so the interface labels those details unavailable and keeps payment controls disabled. Demo mode must say that it does not change the database.

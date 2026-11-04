# TIXO Frontend

React 18, Vite, TypeScript, and Tailwind CSS v4 client for the TIXO ticketing system.

## Run the server-backed frontend

Start the infrastructure from the repository root:

```powershell
docker compose up -d
```

The ignored [`.env.local`](./.env.local) file configures gRPC-Web:

```dotenv
VITE_TIXO_MODE=grpc-web
VITE_TIXO_GRPC_WEB_URL=http://localhost:8080
```

Start Vite from this directory:

```powershell
npm.cmd run dev -- --port 5174
```

Open [http://localhost:5174](http://localhost:5174).

The browser connects to Envoy on port `8080`. It does not connect directly to the native gRPC backend on port `50051`.

## Main flow

- The home page loads the movie catalog and schedule data from the backend.
- The booking page shows a portrait poster, movie details, trailer, schedule filters, studio choices, and a 50-seat map.
- Booking and cancellation use the backend database through gRPC-Web.
- `PantauStatusKursi` keeps seat changes synchronized between clients.
- The browser stores its own recent booking list in local storage.

The protobuf adapter in [src/services/tixoGateway.ts](./src/services/tixoGateway.ts) keeps the contract's `snake_case` fields such as `schedule_id`, `movie_id`, and `seat_number` intact.

## Schedule and prices

Every seeded movie has the same schedule shape:

- 3 studios.
- 6 dates from 3 to 8 November 2026.
- 5 showtimes: 09.00, 13.00, 16.00, 19.30, and 22.00 WIB.
- Weekday price: Rp 40.000.
- Weekend price: Rp 45.000.

## Demo mode

If `VITE_TIXO_MODE` is not `grpc-web`, the client uses an in-memory demo gateway. Demo bookings do not change MySQL.

## Build

```powershell
npm.cmd run build
```

The build runs TypeScript checks and creates the Vite production output.

## Reset local bookings

Cancel a booking from the booking history to release one seat. To reset all local data, run these commands from the repository root:

```powershell
docker compose down -v
docker compose up -d
```

This deletes all local MySQL data and recreates the seeded schedules and seats.

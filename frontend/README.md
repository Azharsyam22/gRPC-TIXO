# TIXO Frontend

React 18, Vite, TypeScript, and Tailwind CSS v4. The seat map follows the current `proto/tixo.proto` contract. The seeded Interstellar: IMAX Special Remaster schedule has four daily slots (13.00, 16.00, 19.30, and 22.00 WIB) for 3–5 November 2026. Each slot has its own 50-seat map at Studio 1 IMAX.

## Run the local preview

```powershell
cd frontend
npm install
npm run dev
```

By default, `VITE_TIXO_MODE` is `demo`. The preview uses the same 50 seat numbers and `AVAILABLE`, `PENDING`, and `BOOKED` states as the backend. Demo reservations stay in memory and do not change MySQL.

The demo mode provides an independent in-memory seat map for every showtime. For an existing MySQL database, run `database/seed_showtimes.sql` once to add the additional schedules and their seats. The script is safe to run again. New database setups get the same schedules from `database/init.sql` or `backend/src/config/schema.sql`.

The current backend has no film/cinema catalog, age-rating, ticket-price, account, or payment RPCs. The frontend uses the single seeded film and studio, labels the age rating and price as unavailable, and shows payment methods as disabled previews. The booking button reserves seats only; it does not charge a payment method.

## Connect to the backend

The browser must connect through a gRPC-Web proxy. The Node backend listens for native gRPC on port `50051`; it does not serve gRPC-Web itself. Start the Envoy proxy when its config is available, then create `.env.local`:

```dotenv
VITE_TIXO_MODE=grpc-web
VITE_TIXO_GRPC_WEB_URL=http://localhost:8080
```

Restart Vite after changing environment values. The client reads the repository's `proto/tixo.proto` at build time, uses the `tixo.TixoService` RPC paths, sends one `PesanKursi` request per seat with a stable transaction ID across retries, and listens to `PantauStatusKursi` in gRPC-Web text mode for server streaming.

`BatalPesanan` is available for bookings recorded by this browser. The backend currently accepts a user ID but does not check that the user owns the booked seat, so the UI only offers cancellation for the browser's own recorded transactions.

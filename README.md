# GearGrid — Equipment Rental Platform (Server)

## Project Purpose
GearGrid Server is the Express.js and MongoDB backend powering the GearGrid Equipment Rental Platform. It provides secure JWT and role-based APIs for equipment listings, server-side search/filter/sorting, customer favorites, rental bookings, Stripe Checkout payments, user management, and Admin/Owner analytics.

## Live URL
- Live Client URL: https://geargrid-client-ochre.vercel.app
- Live Server URL: https://geargrid-server.vercel.app

## Key Features
- **JWT & Role-Based Access Control (RBAC):** Custom Express middlewares (`verifyToken`, `verifyRenter`, `verifyOwner`, `verifyAdmin`) securing private routes and role-specific operations.
- **Featured & All Equipment APIs:** Featured equipment endpoint using MongoDB `.limit(6)` plus server-side search (name, location, category), multi-filter (category, rental type, price range, availability), and sorting (price low-to-high, price high-to-low, recently added).
- **Owner & Admin Equipment Management:** Full CRUD for owners and Approve/Reject/Update/Delete moderation for admins.
- **Favorites Management:** Save, view, and remove customer favorite equipment in MongoDB.
- **Stripe Checkout & Payments:** Server-verified Stripe Checkout session creation, booking status update, inventory update, and transaction recording in the `payments` collection.
- **Dashboard Analytics:** Dynamic MongoDB aggregations for Admin platform metrics and Owner earnings statistics.

## NPM Packages Used
- `express` — Web framework for REST APIs
- `cors` — Cross-Origin Resource Sharing configuration
- `dotenv` — Environment variable management
- `mongodb` — Official MongoDB Node.js driver
- `jsonwebtoken` — JWT token verification
- `stripe` — Stripe Checkout payment integration
- `nodemon` — Development hot-reloading

## Environment Variables
Create a `.env` file based on `.env.example`:
```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DB_NAME=equipmentRentalDB
JWT_ACCESS_SECRET=your_random_jwt_access_secret
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
CLIENT_URL=http://localhost:3000
```

## Run Locally
```bash
npm install
npm run dev
```

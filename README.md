# BookHaven

**A web-based online bookstore marketplace connecting independent booksellers with readers.**

BookHaven lets sellers list books for sale, lets buyers search, browse, and purchase those listings, and gives a platform administrator control over listing quality through a review-and-approval workflow. It's being built from scratch as a full-stack e-commerce web application for CSE 4214.

---

## Table of Contents

- [About the Project](#about-the-project)
- [Team](#team)
- [Core Concept](#core-concept)
- [User Roles](#user-roles)
- [Full Feature Set (v1.0 Vision)](#full-feature-set-v10-vision)
- [Sprint Scope](#sprint-scope)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Nonfunctional Requirements](#nonfunctional-requirements)
- [Requirements Traceability](#requirements-traceability)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [License / Course Notice](#license--course-notice)

---

## About the Project

Small and independent booksellers often don't have the resources to build their own online storefront. BookHaven gives them a simple, low-cost way to reach readers without that overhead, while giving the platform operator (the administrator) control over listing quality, content, and trust through a mandatory review step before any listing goes live.

At a high level, BookHaven is a three-sided marketplace:

- **Sellers** list books with a title, author, ISBN, genre, condition, description, cover image, price, and stock level.
- **Buyers** search and browse those listings, purchase books, leave reviews, request returns, and maintain a wishlist.
- **Administrators** review every new or edited listing before it's published, screening for prohibited content and validating details like ISBN format, so buyers only ever see accurate, appropriate listings.

## Team

**Team BookHaven** — Cindy Cardona-Felix, Rakshit Jaiswal, Jalil Jimenez, Everett Wappler

## Core Concept

Every book on BookHaven moves through a simple lifecycle:

```
Seller creates/edits a listing
        │
        ▼
   Pending Review  ──(Admin rejects)──►  Rejected (hidden, seller notified with reason)
        │
   (Admin approves)
        │
        ▼
    Published  ──►  visible to Buyers in search/browse  ──►  purchasable
```

This review gate is central to the product: nothing a seller submits is visible to buyers until an administrator has explicitly approved it, and re-editing a published listing's title, description, or ISBN sends it back through review automatically.

## User Roles

| Role | Can do | Requires |
|---|---|---|
| **Buyer** | Register/login, search & browse, cart & checkout, request returns/refunds, write reviews, manage a wishlist | Account (self-registered) |
| **Seller** | Register/login, create/edit/remove listings, fulfill & ship orders, cancel orders, issue refunds | Account (self-registered) |
| **Administrator** | Review pending listings and accounts, approve/reject with a reason, moderate reviews, maintain the prohibited-content word list | Account (created directly by the platform operator, not self-registered) |

## Full Feature Set (v1.0 Vision)

The complete Software Requirements Specification defines nine system features, REQ-1 through REQ-57. This README summarizes them; see [`SRS_Latex__version_1__1_.pdf`](./SRS_Latex__version_1__1_.pdf) for the full requirement text, priorities, and stimulus/response sequences.

1. **User Account Management** — registration (Buyer/Seller), login/logout, 30-minute inactivity session timeout, profile editing. Account type can't be changed after registration.
2. **Book Listing Management** — sellers create, edit, and remove their own listings. ISBN is validated (ISBN-10/13 checksum) before submission. Zero-stock listings are auto-labeled "Out of Stock" and can't be added to a cart.
3. **Listing Review and Approval** — admins work a "Pending Review" queue ordered by submission date, approve or reject (with a required reason) each listing, and get an automatic flag if a listing's title/description matches a maintained prohibited-word list. ISBNs are re-validated at review time.
4. **Search and Browse** — buyers search published listings by title, author, genre, or ISBN, or browse by genre. Results are sorted alphabetically by title; unmatched searches show a clear "no results" message.
5. **Shopping Cart and Checkout** — add/remove cart items with live subtotal updates, login-gated checkout, an itemized order summary before payment, and processing through a third-party payment gateway. BookHaven never stores raw card data.
6. **Returns and Refunds** — buyers can request a return within a configurable eligibility window (e.g., 30 days), must provide a reason, and get notified when the request is approved/denied. Approval triggers a refund through the payment gateway.
7. **Order Fulfillment** — sellers process physical orders (mark "Processing," attach carrier + tracking) or cancel unshipped orders with an automatic refund. Digital listings are fulfilled automatically — the system generates and delivers an access token/license the moment payment is confirmed, no seller action needed.
8. **Reviews and Ratings** — a buyer can leave one star rating + written review per book, but only after their order for that book is marked "Delivered." Every review is screened against the prohibited-content list before publishing.
9. **Wishlist** — buyers save books for later, get notified of duplicates instead of creating them, and see saved-but-now-unavailable books marked rather than silently removed.

## Sprint Scope

### Sprint 1 — Account → listing → moderation core

- ✅ **User Account Management** (§3.1, REQ-1–7) — registration, login/logout, session handling, profile editing, role-based redirect
- ✅ **Book Listing Management** (§3.2, REQ-8–14) — seller-side create/edit/remove, ISBN validation, out-of-stock handling
- ✅ **Listing Review and Approval** (§3.3, REQ-15–20) — admin review queue, approve/reject with reason, prohibited-content flagging, ISBN re-validation

### Sprint 3 — Full development through the purchase confirmation screen

The goal of Sprint 3 is to get the web app all the way to the final confirmation button of a buyer's purchase. Deliverables:

| Area | What's included |
|---|---|
| **Admin features** | Admin-only pages; approve/deny pending accounts and pending products; view all accounts and products; disable/re-enable them; review moderation and prohibited-word management |
| **Buyer features** | Buyer-only pages; browse products; cart; checkout flow up to the final confirmation button; wishlist; write reviews |
| **Seller features** | Seller-only pages; create, view, edit, and delete products bound to the logged-in seller's account |
| **Authentication & authorization** | Login for all three roles; server-side role-based access control that denies pages a user isn't allowed to see; custom 404 page |
| **Data population script** | Seed script that loads test users (all roles), products in each status, reviews, wishlist items, and prohibited words |
| **Image/file storage** | Upload, store, and serve product cover images |

**Deferred to later sprints:** payment gateway processing and order completion, Returns & Refunds, Order Fulfillment (§3.5 payment, §3.6, §3.7). These are fully specified in the SRS.

## Tech Stack

Per the SRS's Operating Environment (§2.4), development and testing run on `localhost`:

| Layer | Technology |
|---|---|
| Frontend | Web client, modern browser (Chrome, Firefox, Safari, Edge — current + previous major version), JavaScript required |
| Backend | Node.js + Express |
| Database | PostgreSQL (local instance for development) |
| Image storage | Local file uploads served by the Express server (e.g., `multer`) |
| Payments | Third-party payment gateway (provider TBD) — no raw card data ever touches BookHaven's own servers |
| Notifications | Email / in-app notification service (provider TBD) |

A hosted production environment (cloud platform or Linux server) hasn't been selected yet and will be chosen once the core application is functional.

## System Architecture

```
 ┌──────────────┐    ┌───────────────┐    ┌───────────────┐
 │ Buyer Client │    │ Seller Client │    │  Admin Client  │
 └──────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │ Application Server │  (Node.js + Express)
                    └─────────┬──────────┘
                 ┌────────────┼─────────────┐
                 ▼                          ▼
      ┌─────────────────────┐      ┌──────────────────┐
      │ PostgreSQL Database │      │ Payment Gateway  │ (external)
      └─────────────────────┘      └──────────────────┘
```

All three client roles (Buyer, Seller, Admin) talk to a single Express application server, which enforces role-based access control (a Buyer can never hit Seller listing-management routes; a Seller can never touch another Seller's listings; only Admins can reach the review queue) and is the only component that talks to the database and the external payment gateway.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS release)
- [PostgreSQL](https://www.postgresql.org/download/) running locally
- npm (comes with Node.js)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Raksj12/Software-Engineering-Project.git
cd Software-Engineering-Project

# 2. Install backend and frontend dependencies
cd backend
npm install
cd ..\frontend
npm install
cd ..\backend

# 3. Configure your local database connection
#    Copy .env.example to .env and fill in your PostgreSQL credentials:
#      DB_HOST=localhost
#      DB_PORT=5432
#      DB_NAME=bookhaven
#      DB_USER=your_postgres_user
#      DB_PASSWORD=your_postgres_password
#      AUTH_SECRET=any_long_random_string
copy .env.example .env

# 4. Create the local BookHaven database and apply the schema
psql -U your_postgres_user -c "CREATE DATABASE bookhaven;"
psql -U your_postgres_user -d bookhaven -f sql/schema.sql

# 5. (Optional but recommended) Load test data
npm run db:seed

# 6. Start the backend
npm run dev
```

> Steps 4 and 5 use `backend/sql/schema.sql` and the `backend` `db:seed` npm script.

The seed script creates test accounts for each role so you can log in right away. The development credentials are listed below. **For development only.**

The backend runs on `http://localhost:3000` and the Vite frontend runs on `http://localhost:5173`.

### Seeded development accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookhaven.test` | `admin123` |
| Buyer | `buyer@bookhaven.test` | `buyer123` |
| Seller | `seller@bookhaven.test` | `seller123` |

### Authentication API

- `POST /api/auth/register` registers a buyer or seller as `pending`.
- `POST /api/auth/login` returns an eight-hour signed Bearer token for approved accounts.
- `POST /api/auth/logout` is the authenticated logout boundary; clients discard the token.
- `GET /api/auth/me` returns the authenticated user.
- `/api/buyer/account`, `/api/seller/account`, and `/api/admin/account` demonstrate server-side role guards.
- Unknown routes return a JSON 404 response.

Send the login token on protected requests as `Authorization: Bearer <token>`.

## Project Structure

Planned layout as the codebase is built out:

```
Software-Engineering-Project/
├── SRS_Latex__version_1__1_.pdf   # Full Software Requirements Specification (v1.0)
├── frontend/                     # React + Vite web client
│   └── src/
├── backend/                      # Node.js + Express backend
│   ├── src/                      # API, authentication, database, and seed code
│   └── sql/schema.sql            # PostgreSQL table definitions
├── backend/.env.example           # template for local environment variables
├── .gitignore
└── README.md
```

## Nonfunctional Requirements

Key commitments from SRS Chapter 4 that apply from Sprint 1 onward:

**Performance**
- Search/browse results return within 2 seconds under normal load
- Checkout completes within 5 seconds (excluding external payment-gateway latency)
- Admin review queue loads within 2 seconds regardless of pending-listing volume (paginated if needed)

**Safety**
- An order is never marked "Paid" unless the payment gateway has confirmed a successful charge
- Stock is never decremented, and a buyer is never notified of a successful purchase, unless payment actually succeeded
- Admin actions (approve, reject, refund) can't be applied twice to the same listing/order via duplicate requests

**Security**
- Passwords stored using a salted cryptographic hash — never in plain text
- All client-server traffic (login credentials, payment data) encrypted via HTTPS/TLS
- No raw payment card numbers stored — tokenized references from the payment gateway only, per PCI-DSS
- Role-based access control enforced server-side, not just hidden in the UI
- Administrative actions logged with a timestamp and the acting admin's identity

**Quality Attributes**
- **Availability:** ≥99% uptime, excluding scheduled maintenance
- **Dependability:** identical actions produce identical results regardless of who performs them or how many times, under identical conditions
- **Usability:** a first-time buyer can search and add to cart, and a first-time seller can create a listing, using only on-screen labels — no external instructions
- **Maintainability:** adding a new listing field should only require touching a small, well-defined set of files
- **Flexibility:** the data model should support adding new payment gateways or book metadata fields later without a redesign

## Requirements Traceability

Every functional requirement in the SRS (REQ-1 through REQ-57) traces back to at least one of the 13 user stories in Appendix A, covering Buyer, Seller, and Administrator perspectives. This keeps every line of the spec grounded in an actual elicited need rather than an assumption — see the SRS document for the full mapping.

## Roadmap

- [x] Sprint 1: Account management, listing management, review/approval workflow
- [ ] Sprint 2: Search & browse, shopping cart & checkout flow
- [x] Sprint 3 foundation: PostgreSQL schema, authentication/authorization, 404 page, and data population script
- [ ] Sprint 4: Payment gateway integration, order fulfillment, returns & refunds
- [ ] Production deployment environment selection

## Documentation

- [`SRS_Latex__version_1__1_.pdf`](./SRS_Latex__version_1__1_.pdf) — full Software Requirements Specification, v1.0, including all functional/nonfunctional requirements and Appendix A user stories

## License / Course Notice

This project is developed for course evaluation purposes as part of CSE 4214. All design decisions reflected in the linked SRS and this codebase are the original work of Team BookHaven.
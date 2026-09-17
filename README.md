# BookHaven

BookHaven is a web-based online bookstore e-commerce platform that connects independent booksellers with readers. Sellers create accounts and list books for sale; buyers search, browse, and purchase those listings; and an administrator reviews and moderates every listing before it goes live. Built for CSE 4214 — Team BookHaven.

**Team:** Cindy Cardona-Felix, Rakshit Jaiswal, Jalil Jimenez, Everett Wappler

## What BookHaven does

- **Buyers** register, log in, search and browse published book listings by title, author, genre, or ISBN, add books to a cart, check out with payment processing, request returns/refunds on eligible orders, leave star ratings and reviews on delivered books, and maintain a personal wishlist.
- **Sellers** register, create and manage their own book listings (title, author, ISBN, genre, condition, description, cover image, price, stock), process and ship orders, and issue cancellations/refunds when needed.
- **Administrators** review every new or materially-edited listing in a pending queue, screen for prohibited content and invalid ISBNs, and approve or reject listings before buyers ever see them.

## Sprint 1 scope

This sprint focuses on standing up the core account, listing, and moderation loop described in the SRS:

- User Account Management (§3.1) — registration, login/logout, session handling, profile editing
- Book Listing Management (§3.2) — sellers creating/editing/removing listings
- Listing Review and Approval (§3.3) — the admin pending-review queue and approve/reject flow

Search & Browse, Cart & Checkout, Returns/Refunds, Order Fulfillment, Reviews & Ratings, and Wishlist (§3.4–3.9) are specified in the SRS for the full v1.0 release and will be built out in later sprints.

## Tech stack (Sprint 1 development environment)

Per the SRS's Operating Environment (§2.4), Sprint 1 development and testing runs entirely on `localhost`:

- **Backend:** Node.js + Express
- **Database:** local MySQL instance
- **Frontend:** web client accessed through a modern browser (Chrome, Firefox, Safari, or Edge), no client-side install beyond a browser with JavaScript enabled
- **Payments:** a third-party payment gateway (selection TBD) — BookHaven never stores raw card data, per PCI-DSS considerations (§2.5, §4.3)

A production deployment target (hosted Linux server or cloud platform) has not yet been selected and will be chosen in a later sprint.

## Getting started

> This section will be filled in with exact install/run commands once the Sprint 1 codebase is scaffolded (`npm install`, environment variables for the MySQL connection, `npm run dev`, etc.). For now:

1. Install [Node.js](https://nodejs.org/) (LTS) and [MySQL](https://dev.mysql.com/downloads/mysql/) locally.
2. Clone this repository.
3. Create a local MySQL database for BookHaven and configure connection credentials (details to be added alongside the first backend commit).
4. Install dependencies and start the Express server once the initial backend scaffold is committed.

## Project structure (planned)

```
bookhaven/
├── SRS_Latex__version_1__1_.pdf   # Full Software Requirements Specification
├── client/                        # Frontend web client
├── server/                        # Node.js + Express backend
│   ├── routes/                    # Account, listing, review-queue endpoints
│   ├── models/                    # MySQL data models (users, listings, orders, ...)
│   └── middleware/                # Auth, role-based access control
└── README.md
```

## Requirements traceability

Every functional requirement in the SRS (REQ-1 through REQ-57) is derived from one of the 13 user stories in Appendix A, spanning Buyer, Seller, and Administrator roles. See the SRS document for the full requirement-to-user-story mapping.

## Key nonfunctional commitments

- Passwords are stored using a salted cryptographic hash, never in plain text (§4.3)
- All client-server traffic, including login and payment-related data, is encrypted via HTTPS/TLS (§4.3)
- Role-based access control keeps Buyers out of Seller tools, Sellers out of each other's listings, and the review queue restricted to Administrators (§4.3)
- An order is only ever marked "Paid" after the payment gateway confirms a successful charge (§4.2)
- Search/browse results return within 2 seconds and checkout completes within 5 seconds under normal load, excluding payment-gateway latency (§4.1)

## License / course notice

This project is developed for course evaluation purposes as part of CSE 4214. All design decisions in the linked SRS reflect the team's own work.

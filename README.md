# BookHaven

A web-based online bookstore e-commerce platform that connects independent booksellers with readers. Sellers list books for sale, an administrator reviews listings before they go live, and buyers search, browse, purchase, review, and manage a wishlist of books.

## Team — Group [2]
- Cindy Cardona-Felix
- Rakshit Jaiswal
- Jalil Jimenez
- Everett Wappler


## Project Overview
BookHaven allows:
- **Buyers** to register, log in, search/browse published book listings, add items to a cart, check out with payment processing, request returns/refunds, write reviews and ratings, and manage a wishlist.
- **Sellers** to register, create and manage book listings (physical and digital), and fulfill orders (shipping/tracking or automatic digital delivery).
- **Administrators** to review pending listings for policy compliance (prohibited content, valid ISBNs) and approve, reject, or request corrections before a listing is published.

## Tech Stack
- **Backend:** Node.js with the Express framework
- **Database:** MySQL
- **Frontend:** [fill in — e.g., React, plain HTML/CSS/JS]
- **Payment Processing:** Third-party payment gateway (e.g., Stripe) — no raw card data stored on our servers
- **Development Environment:** `localhost` during Sprint 1; production hosting environment to be determined in a later sprint

## Documentation
- **Software Requirements Specification (SRS):** [`docs/BookHaven_SRS.pdf`](docs/BookHaven_SRS.pdf)
- **User Stories:** Included in Appendix A of the SRS (Section after Chapter 5)
- **Meeting Minutes:** [`docs/MEETINGS.md`](docs/MEETINGS.md)

## Team Meeting Schedule
The team meets weekly on **Tuesdays and Thursdays at 12:00 PM**. Notes from each meeting are logged in [`docs/MEETINGS.md`](docs/MEETINGS.md).

## Sprint 1 Deliverables
- [x] Completed Software Requirements Specification (SRS)
- [x] User stories with acceptance criteria (Appendix A of SRS)
- [ ] GitHub Issues tracking Sprint 1 task assignments
- [ ] Meeting minutes for all Sprint 1 team meetings

## Getting Started (Local Development)
```bash
git clone https://github.com/Raksj12/Software-Engineering-Project.git
cd Software-Engineering-Project
npm install
npm start
```
The application will run on `http://localhost:[PORT]`.

## Repository Structure
```
Software-Engineering-Project/
├── docs/
│   ├── BookHaven_SRS.pdf
│   ├── BookHaven_SRS.tex
│   └── MEETINGS.md
├── src/            # application source code (in progress)
└── README.md
```

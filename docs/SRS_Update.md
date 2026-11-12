# BookHaven Software Requirements Specification — Sprint 4 Scope Revision



## ChangeLog

| Version | Date | Change |
|---|---|---|
| 1.1 | 2026-11-08 | Added cart, checkout, order history, refunds, seller fulfillment, admin oversight, and review retrieval. |
| 1.2 | 2026-11-08 | Reduced the MVP scope to the implemented local demonstration. Deferred production integrations and incomplete secondary workflows. |
| 1.3 | 2026-11-11 | Verified the checkout and order implementation, recorded the current validation result, and clarified partial/deferred requirements. |

## Committed MVP requirements

The Sprint 4 MVP includes the following requirements:

- Buyer and seller registration, login, logout, role-based access, and permitted
  profile updates.
- Seller listing creation, ownership checks, ISBN validation, stock handling,
  and listing removal.
- Admin listing moderation, approval/rejection reasons, prohibited-content
  checks, and moderation notifications.
- Buyer search, title sorting, no-results feedback, genre filtering, listing
  details, cart management, subtotal calculation, and authenticated checkout.
- Development checkout validation that creates an order, decrements stock
  transactionally, clears the cart, and does not persist raw card data.
- Buyer order history, order status visibility, refund requests with required
  reasons, and refund decision visibility.
- Seller sales/order visibility, fulfillment status updates, tracking data,
  cancellation/refund actions, and seller-side refund decisions.
- Admin platform-wide order and refund oversight.
- Product reviews and ratings subject to delivery, duplicate, rating, and
  prohibited-content checks.
- Buyer wishlist add/view/remove behavior, duplicate prevention, and visibility
  of unavailable saved items.

## Removed or deferred from the Sprint 4 SRS scope

The following requirements are explicitly not part of the current MVP. They
must not be presented as completed features:

| Original requirement area | Scope decision | Reason |
|---|---|---|
| Third-party payment gateway integration | Deferred | The demo uses a local payment-format validation stub. No external provider or real charge is made. |
| Production payment/refund processing | Deferred | Refunds update the local development order state only. |
| Full inactivity-reset semantics | Deferred | The current authentication token has a fixed lifetime; activity does not reset the expiration timer. |
| Seller password and store-name profile workflow | Deferred | These profile fields are not required for the checkout and marketplace demonstration. |
| Dedicated grouped genre-browse experience | Deferred | Genre filtering/search remains available, but a separate grouped browsing interface is not part of the MVP. |
| Complete digital-product delivery experience | Deferred | Digital delivery is not demonstrated as a complete buyer-facing product flow. |
| Full browser E2E and Newman execution | Deferred as automation work | The test collection and scripts are included, but the project does not claim that Playwright or Newman runs were completed. |
| Production hosting, email provider, and HTTPS deployment | Deferred | Sprint 4 is a local PostgreSQL/Express/Vite demonstration. |

## Status interpretation

Deferred items are intentionally out of scope, not failed implementation
requirements. They may be addressed in a later release without changing the
committed MVP behavior. The RTM and test-case documents should identify these
items as deferred/out of scope rather than completed.

## Implementation alignment

The committed scope is implemented across the backend route modules under
`backend/src/`, the PostgreSQL schema in `backend/sql/schema.sql`, and the
buyer, seller, and admin pages under `frontend/src/`. The runnable setup and
the known development limitations are documented in [`README.md`](../README.md).

## Verification status — 2026-11-11

The checkout and order code was reviewed in `backend/src/orders.ts`,
`backend/src/cart.ts`, `backend/src/fulfillmentRoutes.ts`, and the
corresponding buyer, seller, and administrator pages. The backend and frontend
production builds completed successfully after installing dependencies from
their existing lockfiles.

The checkout and order behavior currently implemented is:

- Buyer-only route protection for cart, checkout, order history, and refund
  requests.
- Cart checkout validates the shipping address and development card format,
  locks cart rows, checks and decrements stock within a database transaction,
  creates the order and order items, clears the cart after a successful
  commit, and returns an order confirmation.
- Buy-now checkout follows the same transactional stock and order-creation
  behavior.
- Raw card details are used only for format validation and are not written to
  the database.
- Order history is filtered by the authenticated buyer.
- Buyers can submit a refund request with a required reason, and seller/admin
  decisions update local refund and order status and notify the buyer.
- Sellers can view their own order items, process and ship them with carrier
  and tracking information, deliver or cancel eligible items, and notify
  buyers of fulfillment changes.

The following requirements must remain explicitly partial or deferred rather
than being reported as fully complete:

| Requirement area | Current verified state | SRS status |
|---|---|---|
| Itemized pre-payment order review | Checkout collects the shipping address and card-format fields, but does not render a separate itemized order summary before submission. | Partial; UI follow-up required |
| Payment processing and failed-payment simulation | Only local card-format validation exists. There is no payment provider, real charge, or provider-failure test. Database errors and stock conflicts are transactionally rolled back. | Deferred |
| Return-expiration enforcement | Refund eligibility is based on order state and refund status; no time-window/expiration rule is implemented. | Deferred |
| Seller notification of a new refund request | Sellers can retrieve refund requests and decide them, but the buyer refund-request route does not create a seller notification. | Partial |
| Digital delivery | The backend can create a digital-delivery token during checkout, but a complete buyer-facing delivery/access flow is not implemented. | Deferred |
| Browser E2E/Newman execution | The scripts and collection exist, but no browser or Newman run was completed during this verification. | Deferred as validation work |

### Automated verification result

`backend` `npm run build`: **passed**.

`frontend` `npm run build`: **passed**.

`backend` `npm test`: **23 passed, 0 failed** against an isolated PostgreSQL
18 test cluster. This includes authentication, order history, buyer isolation,
refund validation, review validation, and wishlist validation. The run first
exposed a PostgreSQL parameter-type defect in the missing-order refund branch;
the query was corrected to bind the refund reason separately, and the complete
suite passed after reseeding the database.

Authenticated API smoke checks also passed for cart retrieval, adding an item,
cart checkout, order creation, buyer order history, buyer refund request,
seller order visibility, and administrator order visibility. The Newman
collection executed all seven requests with no request failures, but it
contains no assertions and does not persist the login token, so protected
requests in that collection returned their expected unauthorized responses.
Browser E2E and Newman assertion coverage remain follow-up validation work.

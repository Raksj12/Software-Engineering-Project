# BookHaven Software Requirements Specification — Sprint 4 Scope Revision



## ChangeLog

| Version | Date | Change |
|---|---|---|
| 1.1 | 2026-11-08 | Added cart, checkout, order history, refunds, seller fulfillment, admin oversight, and review retrieval. |
| 1.2 | 2026-11-08 | Reduced the MVP scope to the implemented local demonstration. Deferred production integrations and incomplete secondary workflows. |
| 1.3 | 2026-11-11 | Verified the checkout and order implementation, recorded the current validation result, and clarified partial/deferred requirements. |
| 1.4 | 2026-11-11 | Added buyer comparison, quantity editing, state tax calculation, role home navigation, seller earnings, and administrator order intervention. |
| 1.5 | 2026-11-11 | Removed digital delivery and the deferred requirements no longer in scope; added seller price validation and buyer order editing/returns. |

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
- Buyer comparison of two to four approved books using price, author, genre,
  condition, stock, seller, and listing type.
- Cart quantity editing with stock limits and quantity-aware checkout totals.
- State-based sales tax calculation shown in checkout and persisted with each
  order.
- Role-specific home navigation, a cart item-quantity badge, seller earnings
  visibility with per-listing breakdown, and administrator order-status
  intervention with audit logging and buyer notification.

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
| Full browser E2E and Newman execution | Deferred as automation work | The test collection and scripts are included, but the project does not claim that Playwright or Newman runs were completed. |
| Production hosting, email provider, and HTTPS deployment | Deferred | Sprint 4 is a local PostgreSQL/Express/Vite demonstration. |
| Automatic public IP geolocation | Deferred | The application records the request IP for order audit and supports a trusted `IP_STATE_MAP` configuration, but does not send buyer IP addresses to an external geolocation provider. Buyers select their tax state at checkout. |

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
| Seller notification of a new refund request | Each seller attached to the order receives an in-app notification when the buyer submits a refund request. | Completed |
| Returns | The buyer action is labelled “Request Return / Refund,” but the implemented workflow is a local refund request with seller/admin approval. Physical return labels, shipment tracking, inspection, and restocking are not implemented. | Partial; physical-return workflow deferred |
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

## Feature additions verified after Sprint 4

- **Comparison:** `GET /api/listings/compare?ids=...` compares up to four
  approved listings. The buyer catalog provides selection controls and a
  comparison table.
- **Quantities:** cart quantities can be edited with `PATCH /api/cart/:productId`;
  buy-now and cart checkout validate whole-number quantities and available
  stock.
- **Taxes:** checkout requires a two-letter US state and applies the configured
  base state rate. Orders persist `tax_state`, `tax_rate`, `tax_amount`, and
  the final total. The request IP is stored as order audit metadata. A trusted
  deployment may configure `IP_STATE_MAP=address:STATE,...`; no external IP
  lookup is performed by default.
- **Refunds:** buyers provide a reason, sellers receive an in-app notification,
  sellers and administrators can approve or reject requests, and decisions
  update the local order/refund state and notify the buyer.
- **Order editing and returns:** buyers can edit the shipping address on paid
  orders before fulfillment, and can submit a reasoned return/refund request.
  The current return workflow updates local order state; physical return
  shipping, inspection, and restocking remain outside the MVP.
- **Role homepages:** `/home` routes authenticated users to the correct buyer,
  seller, or administrator dashboard.
- **Cart quantity badge:** the header displays the total quantity in the
  authenticated buyer's cart and refreshes after cart, login, and logout
  changes.
- **Seller earnings:** sellers can view gross sales, order count, and items sold
  through the seller dashboard, including a per-listing earnings breakdown.
- **Returns/refunds:** the buyer-facing action clearly identifies the current
  local “Return / Refund” request workflow; it does not claim a complete
  physical-return process.
- **Refund processing:** buyers select store credit or the original payment
  method. Approved refunds are automatically marked completed; store credit is
  added to the buyer balance, while original-payment processing is recorded
  locally because no payment gateway is connected. The buyer, seller, and
  administrators receive completion notifications.
- **Buyer store-credit visibility:** buyers can view their current BookHaven
  store-credit balance on the buyer home and order-history pages. Each eligible
  refund request provides an explicit destination choice between the original
  payment method and BookHaven store credit.
- **Administrator intervention:** administrators can override an order status,
  notify the buyer, and receive an `admin_actions` audit entry. Existing
  moderation and refund controls remain available.
- **Role inboxes:** administrators receive supervision messages for buyer
  orders, order edits, returns/refunds, wishlist activity, and seller actions.
  Sellers receive buyer return/refund messages and wishlist interest for their
  listings. Buyers receive order, shipping, return/refund, and account
  notifications. All roles open Inbox separately from their dashboards through
  the shared navigation, see an unread count, and mark messages read.

## Latest verification status — 2026-11-11

The latest implementation changes were validated with:

- `frontend` `npm run lint`: passed.
- `frontend` `npm run build`: passed.
- `backend` `npm run build`: passed.
- `backend` `npm test`: **23 passed, 0 failed**.

The verification confirmed that the cart badge component is mounted in the
global header, the seller breakdown endpoint is type-safe and buildable, seller
prices are validated on both client and server, and buyer order editing and
return/refund requests have explicit authorization and state checks.
Browser-level interaction tests remain outside this verification run.

# BookHaven Software Requirements Specification — Sprint 4 Scope Revision

The original SRS is available as the root-level PDF
[`SRS_Latex__version_1 (1).pdf`](../SRS_Latex__version_1%20(1).pdf). Because that
file is not an editable source document, this file is the authoritative
Sprint 4 scope revision. It removes requirements that will not be delivered
for the MVP and records the requirements that remain committed.

## ChangeLog

| Version | Date | Change |
|---|---|---|
| 1.1 | 2026-11-08 | Added cart, checkout, order history, refunds, seller fulfillment, admin oversight, and review retrieval. |
| 1.2 | 2026-11-08 | Reduced the MVP scope to the implemented local demonstration. Deferred production integrations and incomplete secondary workflows. |

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

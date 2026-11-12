# Raks Sprint 3 Contribution Report

## Contribution Summary

This contribution completed and integrated marketplace functionality for BookHaven while preserving the existing team codebase. The work focused on the buyer checkout and order journey, refunds and store credit, seller operations, administrator controls, role-specific inboxes and notifications, UI separation, testing, and project documentation.

The implementation supports a physical-book marketplace. Digital delivery was removed from the planned scope, and the requested out-of-scope requirements were removed from the traceability and test documentation.

## Buyer Features Completed

- Added a professional, itemized checkout page.
- Displayed item quantities, unit prices, line totals, subtotal, tax, order total, store credit, and amount due.
- Added a server-backed checkout summary so the displayed totals match backend calculations.
- Added store-credit balance visibility on buyer pages.
- Added the option to apply store credit first and pay any remaining balance by card.
- Added atomic store-credit deduction during checkout.
- Added checkout confirmation with a payment breakdown.
- Added buyer refund requests with required reasons.
- Added refund destination selection:
  - Original payment method
  - BookHaven store credit
- Added refund amount and processing status visibility.
- Added order return/refund status information.
- Added shipping-address editing for eligible paid orders.
- Added cart and Buy Now quantity controls with stock validation.
- Added book comparison for two to four books.
- Added buyer wishlist and notification support.
- Added a dedicated buyer inbox with unread notification indicators.

## Seller Features Completed

- Rebuilt the seller dashboard as a focused Seller Workspace.
- Added seller metrics for gross sales, active listings, fulfillment, and customer-care queues.
- Added seller earnings summaries and per-listing breakdowns.
- Added catalog and listing-status management areas.
- Added fulfillment actions to process, ship, and cancel orders.
- Added seller refund review and approval/denial controls.
- Added seller notifications and a dedicated seller inbox.
- Added buyer wishlist-related notifications for seller awareness.
- Added seller price-format validation and correction messaging so invalid prices can be fixed before listing.

## Administrator Features Completed

- Replaced the buyer-style administrator dashboard with a dedicated Admin Control Center.
- Added marketplace supervision metrics for listings, refunds, accounts, and safety queues.
- Added listing moderation controls.
- Added refund processing and denial controls.
- Added account approval and disable controls.
- Added prohibited-content rule management.
- Added pending-listing rescans.
- Added administrator audit and supervision notifications.
- Removed duplicate administrator inbox navigation.
- Added one centralized administrator supervision inbox.
- Removed buyer-oriented Browse, Cart, and Order panels from the administrator experience.

## Backend and Database Work

- Added buyer refund-request handling.
- Added refund destination validation.
- Added refund amount and processing timestamp support.
- Added completed refund processing for store-credit refunds.
- Added local recording of original-payment refunds because no external payment gateway is connected.
- Added support for the `refunded` order status.
- Replaced the legacy order-status constraint in the schema migration.
- Added migration logic to backfill legacy refund amounts from order totals.
- Added `users.store_credit` support and database-backed buyer account balances.
- Added `orders.store_credit_applied` and `orders.payment_amount`.
- Added atomic store-credit deduction under a database row lock.
- Added checkout summary calculations for subtotal, tax, total, available credit, applied credit, and payment due.
- Added tax calculation and order audit fields.
- Added seller fulfillment and transactional seller refund routes.
- Added shared notification creation and administrator notification broadcasting.
- Added role-protected routes and role-aware navigation behavior.

## Scope Changes

The following items were removed from the project scope:

- Digital delivery
- `REQ007`
- `REQ031`
- `REQ033`
- `REQ045`

The resulting implementation focuses on physical-book marketplace fulfillment, checkout, refunds, store credit, seller operations, administrator governance, and user communication.

## Documentation Updated

The implementation work was reflected in the following project documentation:

- `docs/SRS_Current.tex`
- `docs/SRS_Update.md`
- `docs/RTM.csv`
- `docs/RTM.md`
- `docs/TestCases.md`
- `docs/TestPlan.md`
- `README.md`

The SRS updates describe the completed user stories for itemized checkout, store-credit checkout, refund destinations, buyer balances, seller operations, seller fulfillment and refund controls, administrator moderation, account governance, safety scanning, the Admin Control Center, and the single supervision inbox.

## Validation Completed

The following validation passed after implementation:

- Backend TypeScript build.
- Backend automated test suite: **23 passed, 0 failed**.
- Frontend ESLint validation.
- Frontend TypeScript compilation.
- Frontend production build.
- Checkout summary and store-credit workflow verification.
- Refund request and refund processing verification.
- Store-credit refund balance verification.
- Role-specific access and navigation verification.
- Database migration verification.

## Security and Repository Safety

- Real `.env` files were not committed.
- Database credentials remain local and ignored.
- Placeholder values remain in `.env.example`.
- Existing team files and history were preserved.
- No existing files were deleted as part of this contribution.
- Changes were limited to feature implementation, related tests, documentation, and supporting configuration.

## Main Files Involved

### Backend

- `backend/sql/schema.sql`
- `backend/src/orders.ts`
- `backend/src/adminRoutes.ts`
- `backend/src/fulfillmentRoutes.ts`
- `backend/src/index.ts`
- `backend/src/notifications.ts`
- `backend/tests/orders.test.ts`

### Frontend

- `frontend/src/Buyer/Checkout.tsx`
- `frontend/src/Buyer/BuyerHome.tsx`
- `frontend/src/Buyer/OrderHistory.tsx`
- `frontend/src/Buyer/CompareBooks.tsx`
- `frontend/src/Admin/AdminHome.tsx`
- `frontend/src/Seller/SellerHome.tsx`
- `frontend/src/Components/RoleInbox.tsx`
- `frontend/src/Inbox.tsx`
- `frontend/src/App.tsx`
- `frontend/src/App.css`

## Implementation Limitation

Original-payment refunds are recorded and marked as processed locally because the project does not currently connect to an external payment provider. Store-credit refunds are applied directly to the buyer’s BookHaven balance and are available for a future checkout.

## Final Outcome

This contribution delivers a complete physical-book marketplace workflow:

1. Buyers can browse, compare, add quantities, check out, use store credit, view orders, and request refunds.
2. Sellers can manage listings, earnings, fulfillment, refunds, and customer notifications.
3. Administrators can supervise marketplace activity through a dedicated control center.
4. Buyers, sellers, and administrators each have separate inbox and notification access.
5. The SRS, requirements traceability, test cases, and test plan reflect the completed implementation.

# BookHaven Sprint 4 Test Plan

## ChangeLog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-11-08 | Team BookHaven | Initial Sprint 4 test plan covering MVP implementation and verification |
| 1.1 | 2026-11-13 | Jalil Jimenez | Added Section 7: testing for REQ-010/011, REQ-030, REQ-035, REQ-037, REQ-043, and REQ-052 (31 integration tests, 6 manual browser checks) |

## 1 Introduction

This plan defines verification for the BookHaven React/Express/PostgreSQL MVP. It covers account management, listing moderation, search, cart and checkout, orders, fulfillment, refunds, reviews, and wishlists.

### 1.1 Scope

#### 1.1.1 In-Scope

- Role-based authentication and authorization.
- Seller listings and administrator moderation.
- Buyer search, wishlist, cart, checkout, order history, and refund requests.
- Seller fulfillment and refund decisions.
- Administrator order/refund oversight.
- Backend unit/API tests, Postman checks, and critical browser flows.

#### 1.1.2 Out-of-Scope

- Production payment-provider certification.
- Production email delivery.
- Production hosting, scaling, and mobile applications.
- Real card data.

### 1.2 Quality Objective

The objective is a reliable, role-isolated MVP with transactional stock handling, explicit state transitions, clear validation errors, and traceable test evidence for every SRS functional requirement.

### 1.3 Roles and Responsibilities

| Name | Net ID | GitHub username | Role |
|---|---|---|---|
| TODO | TODO | TODO | Product owner / requirements |
| TODO | TODO | TODO | Backend and database |
| TODO | TODO | TODO | Frontend |
| TODO | TODO | TODO | QA and documentation |

## 2 Test Methodology

### 2.1 Overview

Testing follows an Agile, sprint-based workflow. Each feature is tested at the smallest useful level, then through API integration and finally through critical browser workflows. Failures are fixed before the feature is marked complete.

### 2.2 Test Levels

- Unit: password hashing, token parsing, ISBN validation, validation helpers.
- API/integration: Express routes, database state, authorization, status transitions, and error responses.
- E2E: login, search, cart, checkout, order history, refund request, seller decision.
- Manual: production-like browser and database setup checks not practical to automate.

### 2.3 Bug Triage

Critical: data loss, unauthorized access, incorrect payment/order state, or an MVP flow blocked. High: a required role workflow fails. Medium: recoverable validation or UI issue. Low: cosmetic or documentation issue. The team fixes Critical and High defects before release.

### 2.4 Suspension Criteria and Resumption Requirements

Suspend execution when the database cannot start, the API cannot boot, test data is corrupt, or authentication is unavailable. Resume after the environment is repaired, schema is applied, seed data is loaded, and the health and login checks pass.

### 2.5 Test Completeness

Completion requires every REQ-001 through REQ-057 to have an implementation mapping and at least one test case or documented manual check. All automated tests must pass, and unresolved Critical/High defects are prohibited.

## 3 Test Deliverables

- `backend/tests/*.test.ts`
- `tests/postman/sprint4_collection.json`
- `docs/TestCases.md`
- `docs/RTM.md`
- `docs/RTM.csv`
- This test plan
- Automated test output and final README commands

## 4 Resource & Environment Needs

### 4.1 Testing Tools

- Node.js LTS and npm
- TypeScript and `tsx`
- Node test runner
- PostgreSQL 16 or newer
- Postman/Newman for collection execution
- Playwright for browser E2E execution
- Chrome or another current browser

### 4.2 Test Environment

Use a local PostgreSQL database named `bookhaven_test` where possible. Configure it through environment variables and seed it with non-production accounts. The API runs on `http://localhost:3000`; Vite runs on `http://localhost:5173`.

## 5 Terms/Acronyms

- API: Application Programming Interface
- E2E: End-to-end
- MVP: Minimum Viable Product
- RTM: Requirements Traceability Matrix
- SRS: Software Requirements Specification
- UI: User Interface

## 6 Buyer Order and Refund Testing

### 6.1 Testing Completed

Cindy Cardona created seven integration tests in `backend/tests/orders.test.ts` to test buyer order history and refund requests.

The tests check:
- Login requirements for order history and refunds.
- Buyer order history responses.
- Empty order history for another buyer.
- Refund requests without a reason.
- Invalid and nonexistent order IDs.

### 6.2 Test Results

- Total tests: 7
- Passed: 7
- Failed: 0

TC-023 initially returned HTTP 500 because the refund endpoint reused one SQL
parameter as both a buyer ID and a text refund reason. The query in
`backend/src/orders.ts` was corrected to bind the refund reason separately.
The test was rerun against PostgreSQL and returned the expected HTTP 404.

The post-Sprint-4 additions (comparison, quantity/tax checkout, seller price
validation, buyer order editing/returns, and administrator order intervention) are implemented but
still require dedicated seeded integration fixtures before being marked Pass.

## 7 Post-Sprint-4 Requirement Completion Testing

### 7.1 Scope

This section covers six requirement areas that the RTM listed as In Progress and that were completed after Sprint 4:

| Requirement | Feature |
|---|---|
| REQ-010, REQ-011 | Editing a listing's title, author, description, or ISBN sends it back to admin review; sellers have an edit form |
| REQ-030 | Checkout has a separate review step, and the order is refused if the total changed after review |
| REQ-035 | Refund requests outside `REFUND_WINDOW_DAYS` (default 30) are rejected |
| REQ-037 | Each seller on an order is notified of a refund request, naming only their own items |
| REQ-043 | Sellers cancel unshipped items with a per-item refund |
| REQ-052 | The average rating is shown with the individual reviews |

### 7.2 Automated Testing Completed

31 integration tests were added. Each test starts the Express app, sends real HTTP requests, and checks the resulting PostgreSQL state. Each test file creates its own users, books, carts, and orders and deletes them afterwards, so the seeded demo data is not changed.

| Test file | Requirements | New tests | What the tests check |
|---|---|---|---|
| `backend/tests/orders.test.ts` | REQ-035, REQ-037 | 4 | Expired requests return 400 with no refund request created; a duplicate request on an old order returns 409, not 400; order history reports whether each order's window is open; only sellers on the order are notified, each about only their own books |
| `backend/tests/fulfillment.test.ts` | REQ-043 | 6 | Reason required; cancelling one item refunds only that item and leaves the order active; cancelling the last item cancels the order and returns spent store credit first; shipped items and other sellers' items cannot be cancelled; cancellation is blocked while a refund request is open; a later refund request covers only what is left |
| `backend/tests/sellerListings.test.ts` | REQ-010, REQ-011 | 12 | Price, stock, genre, and condition edits keep a listing live; title, author, description, and ISBN edits each send it to pending and notify admins; re-entering the same ISBN with hyphens is not a change; invalid ISBN and stock values are rejected; a rejected listing can be resubmitted; other sellers' listings cannot be edited; checkout refuses a listing that is pending review |
| `backend/tests/checkout.test.ts` | REQ-030 | 5 | The summary itemizes every line with the correct tax and total; unavailable and short-stock items are flagged; a total that changed after review is refused with no stock, credit, or order changes; a matching total is placed; an empty cart cannot proceed |
| `backend/tests/productReviews.test.ts` | REQ-052 | 4 | Average across several reviews (5, 4, 2 = 3.67); reviews newest first with rating, text, and reviewer; no average for a book without reviews; invalid id rejected |

### 7.3 Manual Browser Testing Completed

On 2026-11-13, Jalil Jimenez ran the browser checks TC-037 through TC-042 (see `docs/TestCases.md`). They used the seeded local database and the demo buyer, seller, and admin accounts, with the API on port 3000 and Vite on port 5173. Some checks changed the database directly in psql to set up a scenario: raising a price between review and placing an order (TC-038), and aging an order past the refund window (TC-040).

| Test case | Requirement | Result |
|---|---|---|
| TC-037 | REQ-010, REQ-011 | Pass |
| TC-038 | REQ-030 | Pass |
| TC-039 | REQ-043 | Pass |
| TC-040 | REQ-035 | Pass |
| TC-041 | REQ-037 | Pass |
| TC-042 | REQ-052 | Pass |

### 7.4 Test Results

- Backend suite (`npm test` in `backend`): 54 total, 54 passed, 0 failed. This is the 23 existing tests plus the 31 new ones.
- Manual browser checks: 6 run, 6 passed.
- The suite was run twice in a row with no failures. After each run, a database query confirmed that no test users, books, or orders were left behind.
- Frontend: `npm run build` and `eslint` pass for the changed components.

### 7.5 Defects Found and Fixed

Investigating these requirements uncovered defects in existing code. Severities follow Section 2.3.

| Severity | Area | Defect | Fix |
|---|---|---|---|
| High | REQ-035 refund window | The window check could never report an expired request. PostgreSQL returns `buyer_id` (BIGINT) as a string, and the code compared it to the numeric user id with `!==`, so every rejected request returned 404 "Order not found". | Compare as numbers; compute expiry with the database clock; check order status before expiry |
| Critical | REQ-043 cancellation | Cancelling one seller's item marked the whole multi-seller order cancelled and refunded. | Cancel and refund per item; cancel the order only when every item is cancelled |
| Critical | REQ-043 cancellation | A seller could cancel while the buyer's refund request was open, so the same money could be refunded twice. | Cancellation is refused while a refund request is open |
| High | REQ-043 cancellation | Cancellation recorded no refund amount, did not return spent store credit, and did not restock. | Refund amount recorded per item, store credit returned first, stock restored, all in one transaction |
| High | REQ-010 listings | Cart checkout did not check listing status, so a listing sent back to review could still be bought from a cart. | Checkout refuses items that are not approved |
| Medium | REQ-010 listings | Every edit, including restocking, hid an approved listing; rejected listings could never be resubmitted; ISBN could not be edited. | Only material edits trigger review; rejected listings return to pending on a material edit; ISBN is editable with checksum validation |
| Medium | REQ-030 checkout | The buyer could be charged a total they never reviewed if prices changed between loading the summary and submitting. | Checkout compares against the reviewed total and refuses on a mismatch |
| Medium | REQ-037 notifications | The refund request, order update, and seller notifications were separate queries, so a failure could leave a request no seller was told about. | All three run in one transaction |
| Low | REQ-035 configuration | `REFUND_WINDOW_DAYS=0` silently became 30, and a fractional value caused a server error. | Only positive whole numbers are accepted; otherwise the default of 30 is used |

### 7.6 Remaining Gaps

- **No unit tests for the new logic.** The new tests are integration tests only. These pure calculations could be moved into small helper functions and unit tested on their own: the refund amount and store-credit split (REQ-043), the material-change check (REQ-010), and the client-side card format check (REQ-030).
- **TC-011 is still Partial.** The process, ship, and deliver fulfillment transitions have no automated test.
- **Browser checks are manual.** TC-037 through TC-042 are not yet automated with Playwright.
- **Schema change for other environments.** REQ-043 added `order_items.refund_amount` and `order_items.refunded_at`, so other databases must run `backend/sql/schema.sql` again before the tests will pass.

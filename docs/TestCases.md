# BookHaven Sprint 4 Test Cases

Actual results below reflect the validation performed during Sprint 4 implementation. Browser and Newman cases remain Not Run until those tools are installed and executed against a clean seeded database. Deferred cases are explicitly out of the current MVP scope.

| Test Case ID | Requirement ID(s) | Title | Type (Unit/Integration/E2E/Manual) | Preconditions | Steps | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|---|---|
| TC-001 | REQ-001, REQ-003 | Buyer authentication | Integration | Seeded database | Login with buyer account | buyer@bookhaven.test / buyer123 | Token returned and buyer route allowed | Existing login implementation verified | Pass |
| TC-002 | REQ-004 | Invalid login is generic | Integration | API running | Submit wrong password | Wrong password | 401 without identifying the bad field | Existing API returns generic error | Pass |
| TC-003 | REQ-009 | ISBN validation | Unit | Test runner available | Validate valid and invalid ISBNs | ISBN-13 and malformed value | Valid checksum accepted; malformed value rejected | Existing ISBN helper present | Pass |
| TC-004 | REQ-015, REQ-16, REQ-17 | Listing moderation | Integration | Admin account and pending listing | Load queue, approve/reject | Pending listing | Queue is ordered; actions change status | Existing admin API implemented | Pass |
| TC-005 | REQ-021, REQ-022, REQ-023, REQ-026 | Search and no-results | Integration | Seeded published products | Search title and nonsense term | `Dune`, `not-a-book` | Published results sorted; no-results message returned | Existing search API implemented | Pass |
| TC-006 | REQ-027, REQ-028 | Cart add/remove | Integration | Buyer token and approved product | Add, read, remove cart item | Product 1, quantity 1 | Cart reflects item and subtotal; removal succeeds | Cart API implemented; automated run pending | Not Run |
| TC-007 | REQ-029, REQ-030, REQ-032 | Cart checkout | E2E | Buyer, stock, payment stub | Login, add item, checkout | Demo card and address | Order created, cart cleared, stock decremented | Frontend and API implemented; browser run pending | Not Run |
| TC-008 | REQ-033 | Checkout stock failure | Integration | Product stock below requested quantity | Submit checkout | Quantity greater than stock | 409; no order is created | API branch implemented; automated run pending | Not Run |
| TC-009 | REQ-34, REQ-35, REQ-36, REQ-37 | Refund request validation | Integration | Buyer order | Submit empty, duplicate, and valid reasons | Damaged item | Invalid requests rejected; valid request is created and seller notified | API implemented; automated run pending | Not Run |
| TC-010 | REQ-39 | Seller refund decision | E2E | Requested refund and seller token | Open refund, approve or deny | Refund request | Buyer sees resulting status/notification | API/UI implemented; browser run pending | Not Run |
| TC-011 | REQ-040, REQ-041, REQ-042, REQ-044 | Fulfillment transitions | Integration | Seller order | Process, ship, deliver/cancel | USPS / DEMO123456 | Valid transitions update order and notify buyer | API implemented; automated run pending | Not Run |
| TC-012 | REQ-047, REQ-048, REQ-049, REQ-051 | Review rules | Integration | Delivered order | Submit valid, duplicate, prohibited, and invalid rating | Rating 5 and prohibited phrase | Only eligible clean review is stored | Existing tests passed validation branches | Pass |
| TC-013 | REQ-052 | Read product reviews | Manual | Product with review | Open product detail | Seeded product | Reviews display newest first | UI/API implemented; browser run pending | Not Run |
| TC-014 | REQ-053, REQ-054, REQ-055, REQ-056, REQ-057 | Wishlist lifecycle | Integration | Buyer token | Add duplicate, view, remove unavailable item | Product 1 | Duplicate is rejected; unavailable item remains visible | Existing wishlist tests passed | Pass |
| TC-015 | REQ-006, REQ-007 | Profile and inactivity | Manual | Authenticated account | Edit profile and wait for timeout | Name/email | Permitted profile changes persist; inactivity reset is deferred | Profile update is available; inactivity-reset semantics are deferred from MVP | Not Run |
| TC-016 | REQ-045, REQ-046 | Digital fulfillment | Manual | Digital product fixture | Complete digital order | Digital listing | Access token delivered and seller notified | Complete digital delivery is deferred from MVP | Not Run |

<!-- Test cases TC-017 through TC-023 by Cindy Cardona -->

| TC-017 | Sprint 4 SRS: Buyer Order History | Order history requires login | Integration | API available | Request order history without a token | No token | 401 Unauthorized | Returned 401 | Pass |
| TC-018 | Sprint 4 SRS: Buyer Order History | Buyer can view order history | Integration | Buyer logged in | Request buyer order history | Buyer token | 200 and orders array | Returned 200 with orders array | Pass |
| TC-019 | Sprint 4 SRS: Buyer Order History | Buyer with no orders sees empty history | Integration | Another buyer (ID 999999) has no orders | Request order history using another buyer's token | Another buyer token (ID 999999) | 200 and an empty orders array | Returned 200 with an empty orders array | Pass |
| TC-020 | Sprint 4 SRS: Buyer Refund Requests | Refund requires login | Integration | API available | Request refund without a token | Order ID 1 | 401 Unauthorized | Returned 401 | Pass |
| TC-021 | REQ-036 | Refund requires reason | Integration | Buyer logged in | Submit an empty refund reason | Empty reason | 400 Bad Request | Returned 400 | Pass |
| TC-022 | Sprint 4 SRS: Buyer Refund Requests | Invalid refund order ID | Integration | Buyer logged in | Submit refund with a negative order ID | Order ID -1 | 400 Bad Request | Returned 400 | Pass |
| TC-023 | REQ-034 | Missing refund order | Integration | Buyer logged in | Request refund for a nonexistent order | Order ID 999999 | 404 Not Found | Returned 500 due to SQL parameter type error | Fail |

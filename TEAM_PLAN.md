# BookHaven Team Plan

## Cindy Cardona-Felix
- [x] Implement user account registration/login/logout/profile editing
- [x] Add role-based redirects and session timeout behavior
- [x] Implement reviews/ratings submission and validation rules
- [x] Implement wishlist add/view/remove and unavailable-item behavior
- [x] Add tests for buyer account and buyer engagement features

## Rakshit Jaiswal
- [x] Bootstrap Node.js/Express baseline project structure
- [x] Add starter CI workflow for pull requests and pushes
- [x] Implement cart API baseline (add, view, remove)
- [x] Implement checkout API baseline with payment abstraction
- [x] Add automated tests for cart and checkout success/failure flows
- [x] Add authentication requirement for cart and checkout baseline routes
- [x] Add concurrency-safe reservation/rollback logic for stock during checkout
- [x] Add PostgreSQL schema and seed data for shared Sprint 3 tables
- [x] Implement database-backed login and role-based route protection

## Jalil Jimenez
- [x] Implement seller listing create/edit/remove APIs
- [x] Add ISBN-10/ISBN-13 validation in listing flow
- [x] Enforce seller ownership on listing modifications
- [x] Implement return/refund request and policy checks
- [x] Add persistence models/migrations for listings and returns

## Everett Wappler
- [x] Implement admin listing moderation queue and actions
- [x] Implement prohibited words/phrases list management
- [ ] Implement search/browse by title/author/genre/ISBN
- [x] Implement order fulfillment (processing, shipping, tracking, cancel)
- [x] Add notifications for moderation and fulfillment updates

## Sprint 5
- [x] Add private seller warehouse webhook configuration and signed event delivery
- [x] Add API mutation shape, JSON, authentication, and field validation hardening
- [x] Modernize warehouse settings and responsive seller UI
- [x] Add security/regression test coverage and JUnit CI artifacts

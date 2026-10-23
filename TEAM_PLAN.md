# BookHaven Team Plan

## Cindy Cardona-Felix
- [ ] Implement user account registration/login/logout/profile editing
- [ ] Add role-based redirects and session timeout behavior
- [ ] Implement reviews/ratings submission and validation rules
- [ ] Implement wishlist add/view/remove and unavailable-item behavior
- [ ] Add tests for buyer account and buyer engagement features

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
- [ ] Implement seller listing create/edit/remove APIs
- [ ] Add ISBN-10/ISBN-13 validation in listing flow
- [ ] Enforce seller ownership on listing modifications
- [ ] Implement return/refund request and policy checks
- [ ] Add persistence models/migrations for listings and returns

## Everett Wappler
- [x] Implement admin listing moderation queue and actions
- [x] Implement prohibited words/phrases list management
- [ ] Implement search/browse by title/author/genre/ISBN
- [x] Implement order fulfillment (processing, shipping, tracking, cancel)
- [x] Add notifications for moderation and fulfillment updates

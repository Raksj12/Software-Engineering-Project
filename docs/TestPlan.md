# BookHaven Sprint 4 Test Plan

## ChangeLog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-11-08 | Team BookHaven | Initial Sprint 4 test plan covering MVP implementation and verification |

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

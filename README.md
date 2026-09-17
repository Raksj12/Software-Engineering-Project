# LoanScope

LoanScope is a browser-based, single-page application that visualizes how a loan's payoff date, total interest, and remaining-balance curve change as you adjust the starting principal, annual interest rate, and monthly payment — in real time, with no page reload. Built to the CSE 4214 Software Requirements Specification, v1.0.

**Tech stack:** React (Vite) frontend · Node.js + Express backend · a shared, framework-independent amortization engine used by both.

## Project structure

This is an npm-workspaces monorepo with three packages:

```
loanscope/
├── packages/
│   ├── calc-engine/   # Pure amortization math (no DOM, no Express) — shared by frontend & backend
│   ├── backend/       # Express REST/JSON API (stateless, no database)
│   └── frontend/      # React + Vite single-page app (Recharts for the chart)
└── package.json       # Workspace root
```

**Why the engine is imported directly by the frontend, not just called over the API:** the SRS requires the chart and summary to update within 200ms of an input change (REQ-14) and the full 1,200-month schedule to recompute within 100ms *in the browser* (Performance Requirements, §4.1). To hit that, the same pure `@loanscope/calc-engine` module is bundled straight into the frontend for instant local recalculation, and is separately `require`d by the Express backend so the documented client-server REST/JSON architecture (§2.1) and CSV export endpoint are still real and independently testable. This is exactly what the SRS's Portability requirement (§4.4) asks for: one calculation module, reused by both sides without duplication.

## Requirements

- Node.js **18+** (LTS) and npm **9+**
- No database, no accounts, no external services — everything runs locally

## Setup

Clone the repo and install all workspace dependencies from the repo root (this installs the frontend, backend, and shared engine's dependencies in one step):

```bash
git clone <this-repo-url>
cd loanscope
npm install
```

## Running the project

You need **two terminals** — one for the backend API, one for the frontend dev server.

**Terminal 1 — backend** (starts on `http://localhost:4000`):

```bash
npm run dev:backend
```

**Terminal 2 — frontend** (starts on `http://localhost:5173`):

```bash
npm run dev:frontend
```

Then open **http://localhost:5173** in your browser. The frontend dev server proxies any `/api/*` request to the backend, so no CORS configuration is needed in development.

> The SRS's security requirement to use HTTPS/TLS is explicitly waived for local grading/development ("For this assignment you will be localhosting, therefore you do not need to worry about setting up HTTPS" — §4.3), so both servers run over plain HTTP on localhost as written above.

### Building for production

```bash
npm run build:frontend
```

This outputs a static, deployable bundle to `packages/frontend/dist/`. The backend is run the same way in production as in development: `npm run dev:backend` (or `node packages/backend/src/server.js`).

### Running the engine's test suite

```bash
npm run test:engine
```

This exercises the core amortization math directly (30-year mortgage amortizing to $0, the non-amortizing-payment rejection, the 1,200-month horizon cap, integer-cents precision, and the 0% APR edge case).

## Using the app

1. Adjust **starting principal**, **annual interest rate**, and **monthly payment** with either the slider or the linked numeric field. Numeric field edits are debounced 300ms; slider drags recalculate immediately.
2. The **payoff date, loan term, and total interest** update live above an interactive balance-over-time chart. Toggle "Overlay cumulative interest" to see both curves. Hover any point on the chart for exact figures at that month.
3. Expand the **Amortization schedule** panel to see the full month-by-month breakdown, filter it to a single year, or **Export CSV**.
4. Click **Share scenario** to copy a link that reproduces your exact inputs — anyone who opens it lands on the same scenario.
5. If a monthly payment wouldn't even cover the interest accrued each month, the app rejects it with an explanation rather than silently accepting it (it would never pay off the loan).

## Requirements coverage

| SRS Section | Status |
|---|---|
| 3.1 Loan Parameter Input and Control (REQ-1–5) | Implemented — linked slider/numeric pairs, range validation, non-amortizing rejection, 300ms debounce |
| 3.2 Real-Time Amortization Calculation Engine (REQ-6–10) | Implemented — pure module, integer-cents math, 1,200-month cap |
| 3.3 Interactive Lifetime and Balance Visualization (REQ-11–14) | Implemented — Recharts line chart, interest overlay toggle, hover tooltips, headline stats |
| 3.4 Amortization Schedule Table and Export (REQ-15–18) | Implemented — expandable table, year filter, pagination, CSV export |
| 3.5 Sharing Scenarios (REQ-19–21) | Implemented — URL-param based scenario loading and sharing, with safe-default fallback for invalid params |
| §4 Nonfunctional Requirements | Addressed — persistent disclaimer, no PII collection/storage, locale-aware currency/date formatting, keyboard-operable controls |

## Notes / known limitations

- Per the SRS (§2.5), automated frontend/backend integration tests are deferred to a later version; only the calculation engine has an automated test suite in v1.0.
- WCAG 2.1 AA contrast/labeling and full keyboard operability were designed for throughout, but a formal accessibility audit has not been performed.
- The exact disclaimer wording is marked **TBD-1** in the SRS pending legal review; the current wording is a placeholder.

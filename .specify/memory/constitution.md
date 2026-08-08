<!--
Sync Impact Report
Version change: 1.0.0 → 1.0.1
Modified principles: none (Core Principles I–V unchanged)
Modified sections:
  - Technology Stack Constraints: narrowed Redis's declared role from "cache/guest
    cart/rate limiting" to "guest cart storage only", per validated research
    (specs/001-core-store-mvp/research.md §§3, 9). Checkout stock reservation moved to
    Postgres (`StockHold` entity, transactional, race-condition-safe) instead of Redis TTL.
    Rate limiting clarified as in-memory (@nestjs/throttler), not Redis-backed, for the
    current single-instance deployment target.
Added sections: none
Removed sections: none
Deferred TODOs: none
Rationale for PATCH bump: clarifies/narrows an existing stack constraint to match validated
design decisions; no Core Principle was added, removed, or redefined.
-->
# TechStore Constitution

## Core Principles

### I. API-First Contract
Backend and frontend are separate deployables (Render / Vercel) communicating only through
the versioned REST API (`/api/v1`). No frontend code MUST reach into backend internals
(database, filesystem, environment) directly. Every new endpoint MUST be usable and testable
independently of the frontend before UI work begins.
**Rationale**: keeps the two apps independently deployable and prevents hidden coupling that
breaks portfolio demos when one side changes.

### II. Type Safety End-to-End
TypeScript strict mode is mandatory in both `backend/` and `frontend/`. TypeORM entities are
the single source of truth for data shape; DTOs MUST be validated with `class-validator` at
every controller boundary. `any` is prohibited except at verified third-party integration
edges (e.g. raw Stripe webhook payloads), and MUST be narrowed immediately after entry.
**Rationale**: catches data-shape mismatches (product variants, order fulfillment types) at
compile time instead of in production.

### III. Test-First for Critical Flows (NON-NEGOTIABLE)
Auth, cart, checkout, payments (Stripe), and order fulfillment (DELIVERY/PICKUP) MUST have
tests written before implementation and MUST fail before the fix/feature lands. Other CRUD
surfaces (catalog browsing, wishlist) may follow tests-after but MUST NOT ship untested.
**Rationale**: these flows move money and state that is expensive to debug after the fact;
everything else is lower-risk portfolio surface area.

### IV. Security & Data Integrity
JWT + role checks guard every mutating endpoint. Stripe webhook signatures MUST be verified
before trusting payload contents. Secrets (`DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`,
`UPSTASH_REDIS_REST_TOKEN`, etc.) MUST NEVER be committed; `.env` / `.env.local` stay
gitignored. All external input (body, query, params) is validated at the controller boundary,
never trusted downstream.
**Rationale**: this is an e-commerce app handling payments and user accounts; a single leaked
secret or unverified webhook is a full-trust breach.

### V. Simplicity & Portfolio Scope (YAGNI)
This is a portfolio project, not an enterprise system. Prefer the smallest change that
satisfies the spec over speculative abstraction, extra microservices, or config layers for
hypothetical future needs. Three similar lines beat a premature abstraction. Complexity
(new services, queues, caching layers beyond what's already in the stack) MUST be justified
against a concrete, current requirement — not "might need it later."
**Rationale**: portfolio value comes from a working, readable system, not from architectural
ceremony.

## Technology Stack Constraints

Locked stack (changes require a constitution amendment, not an ad-hoc PR):
- Backend: NestJS 11 + TypeORM on Neon Postgres (source of truth for all state, including
  checkout stock reservations — see `StockHold` in `specs/001-core-store-mvp/data-model.md`),
  Upstash Redis (REST) scoped to **guest cart storage only**, JWT + roles with a NextAuth
  bridge for OAuth, Stripe Checkout Sessions + webhooks, API versioned by URI. Catalog caching
  and rate limiting are NOT Redis-backed by default — rate limiting uses in-memory
  `@nestjs/throttler` (single-instance deployment); either may move to Redis only if a
  concrete, measured need arises (Principle V) and the constitution is amended accordingly.
- Frontend: Next.js 16 (App Router) + React 19, NextAuth (Credentials + Google), Tailwind CSS.
- No Docker requirement — Postgres and Redis are managed cloud services (Neon, Upstash).
- Deployment: backend on Render, frontend on Vercel.

## Development Workflow

- `npm run lint` and `npm run build` MUST pass in both `backend/` and `frontend/` before a
  feature is considered done.
- Schema changes go through TypeORM migrations (`npm run migration:run`) against Neon — no
  manual/ad-hoc production schema edits.
- Environment variables follow the two documented files (`backend/.env`,
  `frontend/.env.local`); new variables MUST be added to the README's env tables in the same
  change that introduces them.

## Governance

This constitution supersedes ad-hoc conventions for anything it covers. Amendments are made by
editing this file, incrementing the version per semantic versioning (MAJOR: incompatible
principle removal/redefinition; MINOR: new principle or materially expanded guidance; PATCH:
wording/clarification only), and updating `Last Amended`. Spec Kit artifacts
(`/speckit-plan`, `/speckit-tasks`, `/speckit-implement`) MUST verify compliance with these
principles before marking work complete; deviations MUST be justified in the plan's
Complexity Tracking section, not silently introduced.

**Version**: 1.0.1 | **Ratified**: 2026-08-07 | **Last Amended**: 2026-08-07

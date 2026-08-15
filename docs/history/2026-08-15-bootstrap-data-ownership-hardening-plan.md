# High-priority bootstrap and data ownership hardening plan

## Decision

The persisted-plan write gate fixed a real pre-hydration `localStorage` race, but the investigation found a larger lifecycle problem: `SupabaseProvider`, the calculator layout, the print route, auth callbacks, and both Zustand stores can independently coordinate hydration, identity changes, and database sync.

The project will treat this as a high-priority Phase 9.4 architecture hardening item rather than adding another timing guard. The implementation plan is [Bootstrap and Data Ownership Hardening](../superpowers/plans/2026-08-15-bootstrap-data-ownership-hardening.md).

## Scope

The plan centralizes bootstrap ownership, serializes auth transitions, gates protected work on MFA assurance, separates guest and user persistence scopes, guards delayed remote mutations, and adds reload/account-switch/MFA regression coverage.

Phase 3 and Phase 4 remain marked complete; this is a post-completion hardening follow-up spanning authentication and data persistence.

## Addendum: Task 1 targets XState

Task 1 (the bootstrap coordinator contract) was revised to implement its state machine with XState 5 instead of a hand-rolled `generation` counter + `queue[]`/`drain()` loop. `xstate` is a new dependency, scoped to `lib/auth/bootstrap-machine.ts` only — no other part of the plan depends on it.

Rationale: the plan's own generation-check mechanism (re-verify `gen !== generation` before every `commit()`) is exactly what XState's per-actor event serialization plus automatic cancellation of a superseded state's in-flight `invoke` gives for free, and `mfa-required` becomes a real state instead of an early-return branch. This was chosen over introducing WatermelonDB for offline storage, which was rejected as the wrong tool — WatermelonDB targets large indexed relational datasets, not the single-JSON-blob-per-user shape of the calculator and expenses stores.

The coordinator's external surface (`getState`, `start`, `enqueueAuthEvent`, `flush`, `BootstrapState`) is unchanged, via a thin `bootstrap-coordinator.ts` adapter over the machine actor, so Tasks 2-6 of the implementation plan required no changes. A non-authoritative sketch of the machine shape lives at `docs/sketches/bootstrap-machine-sketch.ts`.

## Status

Planned only. No application code, database schema, or runtime behaviour was changed by this planning entry.

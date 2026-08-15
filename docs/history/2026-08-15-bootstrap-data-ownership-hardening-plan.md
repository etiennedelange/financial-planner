# High-priority bootstrap and data ownership hardening plan

## Decision

The persisted-plan write gate fixed a real pre-hydration `localStorage` race, but the investigation found a larger lifecycle problem: `SupabaseProvider`, the calculator layout, the print route, auth callbacks, and both Zustand stores can independently coordinate hydration, identity changes, and database sync.

The project will treat this as a high-priority Phase 9.4 architecture hardening item rather than adding another timing guard. The implementation plan is [Bootstrap and Data Ownership Hardening](../superpowers/plans/2026-08-15-bootstrap-data-ownership-hardening.md).

## Scope

The plan centralizes bootstrap ownership, serializes auth transitions, gates protected work on MFA assurance, separates guest and user persistence scopes, guards delayed remote mutations, and adds reload/account-switch/MFA regression coverage.

Phase 3 and Phase 4 remain marked complete; this is a post-completion hardening follow-up spanning authentication and data persistence.

## Status

Planned only. No application code, database schema, or runtime behaviour was changed by this planning entry.

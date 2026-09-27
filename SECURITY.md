# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report them privately through GitHub's
[private vulnerability reporting](../../security/advisories/new)
("Report a vulnerability" on the Security tab). Include steps to reproduce
and the impact you observed.

## Scope

In scope: this repository's code and the production deployment built from it,
especially authentication, row-level security, and anything that could expose
one user's data to another.

Out of scope: the local-development credentials in `.env.example` and
`.github/workflows/ci.yml`. These are Supabase's published local demo keys and
Cloudflare's published Turnstile test keys. They are public by design and do
not grant access to any real system.

Please do not run automated scanners, load tests, or denial-of-service
attempts against the production site.

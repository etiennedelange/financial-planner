# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report them privately through GitHub's
[private vulnerability reporting](../../security/advisories/new)
("Report a vulnerability" on the Security tab). Include steps to reproduce
and the impact you observed.

## Scope

In scope: this repository's code and the production deployment built from it,
especially the handling of the user's own AI provider API key in the browser
(see `docs/security/byok-llm-key-handling.md`), the Content Security Policy, and
anything that could expose a user's locally stored plan data.

The app has no accounts and no server-side database: plan data is stored only in
the user's browser, and the optional AI feature calls the user's chosen provider
directly with a key the user supplies. There are no maintainer-held credentials in
this repository.

Please do not run automated scanners, load tests, or denial-of-service
attempts against the production site.

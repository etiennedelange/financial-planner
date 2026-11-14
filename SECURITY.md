# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report them privately through GitHub's
[private vulnerability reporting](../../security/advisories/new)
("Report a vulnerability" on the Security tab). Include steps to reproduce
and the impact you observed.

## Scope

In scope: this repository's code and the production deployment built from it,
especially the Content Security Policy (which must keep the app from contacting any other
origin) and anything that could expose a user's locally stored plan data.

The app has no accounts, no server-side database, no analytics and makes no outbound requests:
plan data is stored only in the user's browser, and "Explain my plan" only builds a prompt for the
user to copy. There are no maintainer-held credentials in this repository.

Please do not run automated scanners, load tests, or denial-of-service
attempts against the production site.

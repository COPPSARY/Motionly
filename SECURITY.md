# Security Policy

Motionly is a local, browser-first renderer. It still handles user-provided scene files and assets, so security reports are welcome.

## Supported Versions

The current `main` branch is the supported development target until formal releases begin.

## Reporting a Vulnerability

Please do not open a public issue for sensitive security problems.

Report privately through the maintainer contact links in the README, or open a minimal GitHub issue asking for a private disclosure channel without including exploit details.

Helpful reports include:

- A clear description of the issue.
- Steps to reproduce.
- A minimal `.motion` file or asset when relevant.
- Browser and operating system details.
- Expected impact.

## Scope

In scope:

- Unsafe parsing behavior.
- Asset handling issues.
- Export issues that write unexpected data.
- Cross-site scripting or unsafe HTML/script injection in the preview UI.

Out of scope:

- Vulnerabilities in local files supplied by the user outside Motionly's control.
- Browser bugs unrelated to Motionly.
- Denial-of-service reports based only on extremely large local assets unless they expose a fixable parser or renderer flaw.

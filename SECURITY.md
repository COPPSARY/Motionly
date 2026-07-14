# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Motionly, please report it by:

1. **DO NOT** open a public issue
2. Email the maintainers with details
3. Include steps to reproduce if possible
4. Allow time for a fix before public disclosure

We take security seriously and will respond promptly to legitimate reports.

## Security Best Practices

When using Motionly:

- Only load `.motion` files from trusted sources
- Validate user-provided content before parsing
- Be cautious with assets from untrusted sources
- Keep dependencies up to date

## Known Security Considerations

- The `.motion` parser does not execute arbitrary code
- Asset loading is restricted to images and SVGs
- Export functionality runs in browser sandbox

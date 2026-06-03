# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **nithinp150@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce it
- The potential impact

You can expect an acknowledgement within 48 hours and a fix or mitigation plan within 14 days.

## Scope

In scope:
- Prompt injection via repo content
- Path traversal in repo fetching or file serving
- API key / secret exposure
- Authenticated endpoint bypass

Out of scope:
- Vulnerabilities in third-party dependencies (report those upstream)
- Denial-of-service via large repos (known limitation, not a security issue)

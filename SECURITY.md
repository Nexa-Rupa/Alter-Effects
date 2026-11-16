# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately through GitHub: open the repository's **Security** tab, then **Report a vulnerability**. Include:

- what is affected (page, API route, worker job or package)
- steps to reproduce or a proof of concept
- the impact you expect (data exposure, account takeover, payment bypass, etc.)

We aim to acknowledge reports within **3 working days** and to ship a fix or mitigation for confirmed high-severity issues within **30 days**. We'll credit you in the release notes unless you'd rather stay anonymous.

## Supported versions

Only the latest `main` branch is supported. Self-hosters should update regularly.

## Scope

In scope: this repository's code: the web app, the worker, the engine, the AI adapters, the CLI and the free in-browser tools.

Out of scope:
- vulnerabilities in third-party services (Razorpay, AI providers, Hugging Face, your S3 provider)
- reports that need a compromised device or browser
- missing hardening that has no demonstrated impact

## How the app protects data (for reviewers)

- **AI provider keys** are encrypted at rest with AES-256-GCM (`KEY_ENCRYPTION_KEY`) and only decrypted in the worker or server action that uses them.
- **Passwords** are hashed with bcrypt. A password reset sends a single-use link that expires in 1 hour; only its SHA-256 is stored. Changing the password ends every other session.
- **Rate limits** (Postgres, shared across instances) cover sign-in (per IP and per email, enforced inside the credentials check), sign-up, password reset, uploads, payment orders and invites.
- **Multi-tenancy:** every query is scoped to the caller's organisation, and members can be limited to specific brands.
- **Payments:** Razorpay checkout and webhook signatures are verified with HMAC-SHA256 and a constant-time comparison. Credits are granted once per order.
- **Headers:** strict Content-Security-Policy, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy, and HSTS when served over HTTPS.
- **Free tools:** video and audio are processed in the browser and never uploaded. The speech-model runtime is served from the app's own origin. Only the model weights are downloaded, once, from the Hugging Face Hub.

# Security Agent Report

Owner: Backend Security Specialist
Date: 2026-04-01
Scope: Production hardening baseline for authentication, authorization, secrets, and abuse controls.

## Security Technologies In Use

- Node.js + Express API
- Sequelize ORM (parameterized SQL operations)
- bcrypt password hashing
- JWT session tokens in HttpOnly cookies
- Helmet HTTP security headers
- CORS allowlist with credential support
- validator input sanitization
- express-rate-limit with identity-aware keying strategy

## Security Policies Enforced

- JWT signing and verification now require a strong environment secret.
- JWT fallback secrets are forbidden.
- Protected routes require authenticated users.
- Role-based access control (RBAC) is enforced server-side for sensitive operations.
- Debug routes are disabled by default and can only be enabled explicitly.
- When debug routes are enabled, admin role is required.
- Default admin account seeding is disabled unless explicitly enabled by environment flags.

## Implemented Hardening Batches

### Batch 1: Secret Management Hardening

Files:

- server/utils/jwt.js
- server/middleware/authMiddleware.js
- server/routes/auth.js
- server/server.js

Changes:

- Added centralized JWT secret policy helper.
- Server startup fails fast if JWT secret is missing or too short.
- Removed fallback JWT secret behavior.

Environment policy:

- Required: JWT_SECRET (minimum 32 chars).

### Batch 2: Authorization Hardening

Files:

- server/routes/attendance.js
- server/routes/users.js
- server/routes/auth.js

Changes:

- Added global attendance route authentication.
- Added role checks for attendance generation, manual mark, bulk mark, and class attendance views.
- Added ownership check for student attendance submission and student data views.
- Added role checks for user role changes and user deletion.
- Added restrictions on auth user-list/profile routes.

### Batch 3: Debug and Seed Safety Hardening

Files:

- server/server.js

Changes:

- Removed duplicate debug seed routes.
- Gated debug routes with ENABLE_DEBUG_ROUTES=true.
- Added admin-only checks for debug routes.
- Reworked admin seeding to explicit opt-in only.

### Batch 4: Identity-Based Brute-Force Protection

Files:

- server/middleware/rateLimiters.js
- server/server.js
- server/routes/auth.js
- server/routes/attendance.js

Changes:

- Added global identity-aware API limiter to reduce abusive request bursts.
- Added login brute-force limiter with `skipSuccessfulRequests` to avoid penalizing valid users.
- Added attendance code-attempt limiter on OTP validation to reduce token-guessing attacks.
- Identity keys prioritize authenticated user ID, then login identifier, then IP fallback.

Why this is campus Wi-Fi safe:

- Shared IPs are common on university networks; pure IP throttling can lock out many users.
- Identity-first keying limits abusive actors without forcing unrelated students to logout.

Environment policy:

- Optional: ENABLE_DEBUG_ROUTES=true
- Optional: SEED_DEFAULT_ADMIN=true
- Required when seeding: DEFAULT_ADMIN_PASSWORD (minimum 12 chars)

## Operational Security Checklist

- Use HTTPS and secure cookies in production.
- Rotate JWT_SECRET during releases according to policy.
- Keep ENABLE_DEBUG_ROUTES unset in production.
- Keep SEED_DEFAULT_ADMIN unset in production.
- Use strong seeded admin password if temporary bootstrap is required.
- Restrict CORS origins to trusted domains only.
- Add centralized request audit logging for privileged actions.
- Monitor rate-limit `429` metrics and tune limits based on semester traffic.

## Brute-Force Threat Model and Prevention

- Login brute-force: mitigated with identity-based login limiter and failed-attempt throttling.
- OTP guessing attacks: mitigated with attendance validation limiter and short-lived TOTP windows.
- Credential stuffing from shared networks: mitigated by identity keys rather than broad IP blocks.
- API flood bursts: mitigated with global identity-aware API limiter.

## Known Residual Risks and Next Actions

- Add progressive lockout escalation for repeated failed login attempts by the same identity.
- Add challenge flow (captcha or equivalent) after repeated auth failures.
- Add automated authorization tests for all admin and attendance endpoints.
- Add security event logs for role changes and deletion operations.

## Related Report

See docs/IMPLEMENTATION_REPORT.md for consolidated backend, design, and smoke validation details.

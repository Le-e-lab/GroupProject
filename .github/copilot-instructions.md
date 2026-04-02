# Agent Rulebook for UPath

These rules apply to all agents working in this repository.

## Change Safety Rule (Mandatory)

Before changing any feature area, agents must:

1. Read the existing implementation in that area first.
2. Identify recent fixes and keep them intact.
3. Avoid reverting security, auth, i18n, map, and attendance safeguards unless explicitly requested.
4. Make minimal targeted edits and preserve current APIs unless a migration is intentional.
5. Validate changed files and run smoke checks for impacted flows.

## Attendance Integrity Rule

1. Do not mark attendance complete unless both check-in and check-out are valid.
2. Preserve manual lecturer override paths for edge cases.
3. Keep device verification and identity verification checks active for attendance validation.

## Performance Rule

1. Prefer cached or selective queries for heavy dashboard/class endpoints.
2. Avoid loading unnecessary columns and avoid N+1 loops where possible.

## Documentation Rule

1. Update README and docs whenever behavior or API contracts change.
2. Include operational notes for security-sensitive defaults.

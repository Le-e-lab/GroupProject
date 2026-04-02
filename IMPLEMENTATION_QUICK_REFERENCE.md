# Implementation Quick Reference

## Primary Objectives

- Keep AI assistant stable and scoped.
- Ensure mobile responsiveness for tabs and key navigation.
- Keep language preference behavior consistent.
- Reduce diagnostics and lint warnings.

## Core Files

- `server/routes/ai.js`: AI provider integration, scope checks, and fallback responses.
- `public/js/ai-assistant.js`: Floating AI panel behavior and close interactions.
- `public/css/theme.css`: Shared responsive styles for tabs and layout.
- `public/pages/admin/dashboard.html`: Admin panel and AI diagnostics view.

## Validation Commands

```powershell
npm start
npm run smoke:admin
```

## Smoke Validation Expectations

- Server starts without syntax/runtime errors.
- Admin smoke script exits with status `0`.
- AI failures from provider return graceful JSON fallback in-app.

## Open Operational Constraint

- Gemini provider quota or model access can still block real answer generation.
- The app should present user-friendly fallback text and suggest retry.
